"""WebAuthn 服务：指纹/面容/安全钥匙注册与验证。"""

import base64
import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete as sql_delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.user import User
from app.models.user_webauthn import UserWebAuthnCredential
from app.schemas.auth import (
    WebAuthnAuthStartResponse,
    WebAuthnCredentialResponse,
    WebAuthnRegisterStartResponse,
)

import webauthn.helpers
from webauthn.helpers.parse_attestation_statement import parse_attestation_statement
from webauthn.helpers.structs import (
    AttestationConveyancePreference,
    AuthenticatorAttachment,
    AuthenticatorSelectionCriteria,
    AuthenticatorTransport,
    COSEAlgorithmIdentifier,
    PublicKeyCredentialCreationOptions,
    PublicKeyCredentialDescriptor,
    PublicKeyCredentialParameters,
    PublicKeyCredentialRequestOptions,
    PublicKeyCredentialRpEntity,
    PublicKeyCredentialUserEntity,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)


def _b64url_encode(data: bytes) -> str:
    """将字节编码为 base64url 字符串。"""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64url_decode(data: str) -> bytes:
    """将 base64url 字符串解码为字节。"""
    padding = 4 - len(data) % 4
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data)


def _sha256(data: bytes) -> bytes:
    """计算 SHA-256 哈希。"""
    return hashlib.sha256(data).digest()


async def generate_registration_options(
    db: AsyncSession, user: User, label: str
) -> WebAuthnRegisterStartResponse:
    """生成 WebAuthn 注册选项（发给浏览器 navigator.credentials.create）。"""
    settings = get_settings()
    rp_id = settings.WEBAUTHN_RP_ID or "localhost"

    challenge = webauthn.helpers.generate_challenge()
    user_id = user.id.bytes

    options = PublicKeyCredentialCreationOptions(
        rp=PublicKeyCredentialRpEntity(
            name=settings.WEBAUTHN_RP_NAME or "一站式工作台",
            id=rp_id,
        ),
        user=PublicKeyCredentialUserEntity(
            id=user_id,
            name=user.username,
            display_name=user.nickname or user.username,
        ),
        challenge=challenge,
        pub_key_cred_params=[
            PublicKeyCredentialParameters(
                type="public-key",
                alg=COSEAlgorithmIdentifier.ECDSA_SHA_256,
            ),
        ],
        authenticator_selection=AuthenticatorSelectionCriteria(
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
        timeout=60000,
        attestation=AttestationConveyancePreference.NONE,
    )

    # 序列化为 JSON 发给前端
    json_dict = webauthn.helpers.options_to_json_dict(options)

    return WebAuthnRegisterStartResponse(
        challenge=json_dict["challenge"],
        rp={"id": json_dict["rp"]["id"], "name": json_dict["rp"]["name"]},
        user={
            "id": json_dict["user"]["id"],
            "name": json_dict["user"]["name"],
            "displayName": json_dict["user"]["displayName"],
        },
        pub_key_cred_params=json_dict["pubKeyCredParams"],
        timeout=json_dict["timeout"],
    )


async def verify_registration_and_store(
    db: AsyncSession,
    user: User,
    credential_id: str,
    raw_id: str,
    response: dict[str, Any],
    client_json: str,
    label: str,
    request_origin: str | None = None,
) -> UserWebAuthnCredential:
    """验证 WebAuthn 注册并存储凭据。"""
    settings = get_settings()
    rp_id = settings.WEBAUTHN_RP_ID or "localhost"
    expected_origin = request_origin or settings.WEBAUTHN_ORIGIN or "http://localhost"

    # 解析前端传来的 credential JSON
    registration_json = {
        "id": credential_id,
        "rawId": raw_id,
        "response": {
            "clientDataJSON": _b64url_encode(client_json.encode("utf-8")),
            "attestationObject": response.get("attestationObject", ""),
        },
        "type": "public-key",
    }

    parsed = webauthn.helpers.parse_registration_credential_json(registration_json)

    # 解析 clientDataJSON 验证 origin 和 type
    client_data = webauthn.helpers.parse_client_data_json(
        parsed.response.client_data_json
    )
    if client_data.type != "webauthn.create":
        raise ValueError("clientDataJSON type must be 'webauthn.create'")
    if client_data.origin not in [o.strip() for o in expected_origin.split(',')]:
        raise ValueError(
            f"Origin mismatch: expected {expected_origin}, got {client_data.origin}"
        )

    # 计算 clientDataJSON 的 SHA-256 哈希
    client_data_hash = _sha256(parsed.response.client_data_json)

    # 解析 attestationObject
    attestation = webauthn.helpers.parse_attestation_object(
        parsed.response.attestation_object
    )

    authenticator_data = attestation.auth_data

    # 验证 RP ID（SHA-256 哈希比对）
    expected_rp_id_hash = _sha256(rp_id.encode("utf-8"))
    if authenticator_data.rp_id_hash != expected_rp_id_hash:
        raise ValueError(
            f"RP ID hash mismatch: expected hash of '{rp_id}', "
            f"got {authenticator_data.rp_id_hash.hex()}, "
            f"expected {expected_rp_id_hash.hex()}"
        )

    # 验证 attestation statement

    # 获取 attested credential data
    acd = authenticator_data.attested_credential_data
    if not acd:
        raise ValueError("Missing attested credential data")

    # 存储凭据
    transports_str = ",".join(
        t.value for t in parsed.response.transports
    ) if parsed.response.transports else ""

    credential = UserWebAuthnCredential(
        user_id=user.id,
        credential_id=_b64url_encode(acd.credential_id),
        public_key=_b64url_encode(acd.credential_public_key),
        counter=authenticator_data.sign_count,
        label=label or "认证器",
        transports=transports_str,
    )
    db.add(credential)
    return credential


async def generate_authentication_options(
    db: AsyncSession, user: User, credential_ids: list[str] | None = None
) -> WebAuthnAuthStartResponse:
    """生成 WebAuthn 认证选项（发给浏览器 navigator.credentials.get）。"""
    settings = get_settings()
    rp_id = settings.WEBAUTHN_RP_ID or "localhost"

    # 获取用户的凭据
    cred_ids = credential_ids or []
    if not cred_ids:
        result = await db.execute(
            select(UserWebAuthnCredential).where(
                UserWebAuthnCredential.user_id == user.id
            )
        )
        creds = result.scalars().all()
        cred_ids = [c.credential_id for c in creds]

    challenge = webauthn.helpers.generate_challenge()

    allow_credentials = [
        PublicKeyCredentialDescriptor(
            id=_b64url_decode(cid),
            transports=[
                AuthenticatorTransport.INTERNAL,
                AuthenticatorTransport.USB,
                AuthenticatorTransport.NFC,
            ],
        )
        for cid in cred_ids
    ]

    options = PublicKeyCredentialRequestOptions(
        challenge=challenge,
        rp_id=rp_id,
        allow_credentials=allow_credentials,
        user_verification=UserVerificationRequirement.PREFERRED,
        timeout=60000,
    )

    json_dict = webauthn.helpers.options_to_json_dict(options)

    return WebAuthnAuthStartResponse(
        challenge=json_dict["challenge"],
        rp_id=rp_id,
        timeout=json_dict["timeout"],
        allow_credentials=cred_ids,
        user_verification="preferred",
    )


async def verify_authentication(
    db: AsyncSession,
    credential_id: str,
    raw_id: str,
    response: dict[str, Any],
    client_json: str,
    request_origin: str | None = None,
) -> UserWebAuthnCredential | None:
    """验证 WebAuthn 认证并更新计数器。"""
    settings = get_settings()
    rp_id = settings.WEBAUTHN_RP_ID or "localhost"
    expected_origin = request_origin or settings.WEBAUTHN_ORIGIN or "http://localhost"

    # 查找凭据
    result = await db.execute(
        select(UserWebAuthnCredential).where(
            UserWebAuthnCredential.credential_id == credential_id
        )
    )
    credential = result.scalar_one_or_none()
    if not credential:
        return None

    # 解析前端传来的 assertion JSON
    assertion_json = {
        "id": credential_id,
        "rawId": raw_id,
        "response": {
            "clientDataJSON": _b64url_encode(client_json.encode("utf-8")),
            "authenticatorData": response.get("authenticatorData", ""),
            "signature": response.get("signature", ""),
            "userHandle": response.get("userHandle", ""),
        },
        "type": "public-key",
    }

    parsed = webauthn.helpers.parse_authentication_credential_json(assertion_json)

    # 解析 clientDataJSON
    client_data = webauthn.helpers.parse_client_data_json(
        parsed.response.client_data_json
    )
    if client_data.type != "webauthn.get":
        raise ValueError("clientDataJSON type must be 'webauthn.get'")
    if client_data.origin not in [o.strip() for o in expected_origin.split(',')]:
        raise ValueError(
            f"Origin mismatch: expected {expected_origin}, got {client_data.origin}"
        )

    # 计算 clientDataJSON 的 SHA-256 哈希
    client_data_hash = _sha256(parsed.response.client_data_json)

    # 解析 authenticatorData
    authenticator_data = webauthn.helpers.parse_authenticator_data(
        parsed.response.authenticator_data
    )

    # 验证 RP ID（SHA-256 哈希比对）
    expected_rp_id_hash = _sha256(rp_id.encode("utf-8"))
    if authenticator_data.rp_id_hash != expected_rp_id_hash:
        raise ValueError(
            f"RP ID hash mismatch: expected hash of '{rp_id}', "
            f"got {authenticator_data.rp_id_hash.hex()}"
        )

    # 解码公钥并获取算法标识
    decoded_key = webauthn.helpers.decode_credential_public_key(
        _b64url_decode(credential.public_key)
    )

    # 根据密钥类型构造 cryptography 公钥对象
    from webauthn.helpers.cose import COSEKTY, COSECRV
    if decoded_key.kty == COSEKTY.EC2:
        # EC2 密钥
        if decoded_key.crv == COSECRV.SECP256R1:
            curve = SECP256R1()
        elif decoded_key.crv == COSECRV.SECP384R1:
            curve = SECP384R1()
        elif decoded_key.crv == COSECRV.SECP521R1:
            curve = SECP521R1()
        else:
            raise ValueError(f"Unsupported curve: {decoded_key.crv}")
        public_key = EllipticCurvePublicKey.from_encoded_point(curve, decoded_key.x, decoded_key.y)
    elif decoded_key.kty == COSEKTY.OKP:
        # OKP 密钥 (Ed25519)
        if decoded_key.crv == COSECRV.EdDSA:
            public_key = Ed25519PublicKey.from_public_bytes(decoded_key.x)
        else:
            raise ValueError(f"Unsupported OKP curve: {decoded_key.crv}")
    elif decoded_key.kty == COSEKTY.RSA:
        # RSA 密钥
        rsa_num = RSAPublicNumber(
            n=decoded_key.n,
            e=decoded_key.e,
        )
        public_key = rsa_num.public_key()
    else:
        raise ValueError(f"Unsupported key type: {decoded_key.kty}")

    # 验证签名（data = authenticator_data + client_data_hash）
    try:
        webauthn.helpers.verify_signature(
            public_key=public_key,
            signature_alg=decoded_key.alg,
            signature=parsed.response.signature,
            data=parsed.response.authenticator_data + client_data_hash,
        )
    except InvalidSignature:
        raise ValueError("Signature verification failed")

    # 验证计数器（防止克隆设备）
    if authenticator_data.sign_count < credential.counter:
        raise ValueError("Counter mismatch: possible cloned authenticator")

    # 更新计数器
    credential.counter = authenticator_data.sign_count
    credential.last_used_at = datetime.now(timezone.utc)

    return credential


async def list_credentials(
    db: AsyncSession, user: User
) -> list[UserWebAuthnCredential]:
    """列出用户的所有 WebAuthn 凭据。"""
    result = await db.execute(
        select(UserWebAuthnCredential).where(UserWebAuthnCredential.user_id == user.id)
    )
    return list(result.scalars().all())


async def remove_credentials(
    db: AsyncSession, user_id: uuid.UUID, credential_id: str | None = None
) -> None:
    """删除用户的所有或指定 WebAuthn 凭据。"""
    query = sql_delete(UserWebAuthnCredential).where(
        UserWebAuthnCredential.user_id == user_id
    )
    if credential_id:
        query = query.where(UserWebAuthnCredential.credential_id == credential_id)
    await db.execute(query)

async def generate_login_authentication_options(
    db: AsyncSession, request_origin: str | None = None
) -> WebAuthnAuthStartResponse:
    """生成登录用 WebAuthn 认证选项（无需用户上下文，用于 discoverable credentials 直接登录）。"""
    from app.models.user_webauthn import UserWebAuthnCredential

    settings = get_settings()
    rp_id = settings.WEBAUTHN_RP_ID or "localhost"

    # 获取所有已注册的凭据 ID（discoverable credentials）
    result = await db.execute(select(UserWebAuthnCredential.credential_id))
    cred_ids = [row[0] for row in result.all()]

    challenge = webauthn.helpers.generate_challenge()

    allow_credentials = [
        PublicKeyCredentialDescriptor(
            id=_b64url_decode(cid),
            transports=[
                AuthenticatorTransport.INTERNAL,
                AuthenticatorTransport.USB,
                AuthenticatorTransport.NFC,
            ],
        )
        for cid in cred_ids
    ]

    options = PublicKeyCredentialRequestOptions(
        challenge=challenge,
        rp_id=rp_id,
        allow_credentials=allow_credentials,
        user_verification=UserVerificationRequirement.PREFERRED,
        timeout=60000,
    )

    json_dict = webauthn.helpers.options_to_json_dict(options)

    return WebAuthnAuthStartResponse(
        challenge=json_dict["challenge"],
        rp_id=rp_id,
        timeout=json_dict["timeout"],
        allow_credentials=cred_ids,
        user_verification="preferred",
    )


async def verify_login_by_credential(
    db: AsyncSession,
    credential_id: str,
    raw_id: str,
    response: dict[str, Any],
    client_json: str,
    request_origin: str | None = None,
) -> User:
    """通过 WebAuthn 凭据验证登录并返回用户。"""
    from app.models.user_webauthn import UserWebAuthnCredential
    from app.models.user import User

    settings = get_settings()
    rp_id = settings.WEBAUTHN_RP_ID or "localhost"
    expected_origin = request_origin or settings.WEBAUTHN_ORIGIN or "http://localhost"

    # 查找凭据
    result = await db.execute(
        select(UserWebAuthnCredential).where(
            UserWebAuthnCredential.credential_id == credential_id
        )
    )
    credential = result.scalar_one_or_none()
    if not credential:
        raise ValueError("凭据未找到")

    # 查找用户
    user_result = await db.execute(select(User).where(User.id == credential.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise ValueError("用户未找到")

    # 验证 WebAuthn 签名
    verified_credential = await verify_authentication(
        db,
        credential_id,
        raw_id,
        response,
        client_json,
        request_origin,
    )
    if not verified_credential:
        raise ValueError("WebAuthn 验证失败")

    await db.commit()
    return user