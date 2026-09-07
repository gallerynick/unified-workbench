"""WebAuthn 服务：指纹/面容/安全钥匙注册与验证。"""

import json
import os
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.user import User
from app.models.user_webauthn import UserWebAuthnCredential
from app.schemas.auth import (
    WebAuthnAuthStartResponse,
    WebAuthnCredentialResponse,
    WebAuthnRegisterStartResponse,
)

import webauthn
import webauthn.helpers
from webauthn.helpers.structs import (
    AuthenticatorTransport,
    CollectedClientData,
    PublicKeyCredentialDescriptor,
    PublicKeyCredentialUserEntity,
    PublicKeyCredentialParameters,
    PublicKeyCredentialRpEntity,
    UserVerificationRequirement,
)


async def generate_registration_options(
    db: AsyncSession, user: User, label: str
) -> WebAuthnRegisterStartResponse:
    """生成 WebAuthn 注册选项（发给浏览器 navigator.credentials.create）。"""
    settings = get_settings()
    rp_id = settings.WEBAUTHN_RP_ID or "localhost"

    rp = PublicKeyCredentialRpEntity(
        name=settings.WEBAUTHN_RP_NAME or "一站式工作台",
        id=rp_id,
    )

    webauthn_user = PublicKeyCredentialUserEntity(
        id=user.id.bytes,
        name=user.username,
        display_name=user.nickname or user.username,
    )

    pub_key_cred_params = [
        PublicKeyCredentialParameters(type="public-key", alg=-7),  # ES256
    ]

    options = await webauthn.helpers.generate_registration_options(
        rp=rp,
        user=webauthn_user,
        pub_key_cred_params=pub_key_cred_params,
        authenticator_selection={
            "authenticator_attachment": "platform",
            "resident_key": "preferred",
            "user_verification": "preferred",
        },
    )

    # 序列化 challenge
    challenge_b64 = webauthn.helpers.base64url.b64encode(options.challenge).decode()

    return WebAuthnRegisterStartResponse(
        challenge=challenge_b64,
        rp={"id": rp.id, "name": rp.name},
        user={
            "id": webauthn.helpers.base64url.b64encode(webauthn_user.id).decode(),
            "name": webauthn_user.name,
            "displayName": webauthn_user.display_name,
        },
        pub_key_cred_params=[
            {"type": p.type, "alg": p.alg} for p in pub_key_cred_params
        ],
        timeout=options.timeout,
    )


async def verify_registration_and_store(
    db: AsyncSession,
    user: User,
    credential_id: str,
    raw_id: str,
    response: dict[str, Any],
    client_json: str,
    label: str,
) -> UserWebAuthnCredential:
    """验证 WebAuthn 注册并存储凭据。"""
    settings = get_settings()
    rp_id = settings.WEBAUTHN_RP_ID or "localhost"

    rp = PublicKeyCredentialRpEntity(
        name=settings.WEBAUTHN_RP_NAME or "一站式工作台",
        id=rp_id,
    )

    registration_response = webauthn.helpers.structs.CredentialCreationOptionsResponse(
        id=credential_id,
        raw_id=webauthn.helpers.base64url.b64decode(raw_id),
        response=webauthn.helpers.structs.AuthenticatorResponse(
            client_data_json=client_json.encode("utf-8"),
            attestation_object=webauthn.helpers.base64url.b64decode(
                response["attestationObject"]
            ),
        ),
        type="public-key",
    )

    verification = await webauthn.helpers.verify_registration_response(
        registration_response=registration_response,
        expected_challenge=webauthn.helpers.base64url.b64decode(
            _get_challenge_from_response(client_json)
        ),
        expected_origin=settings.WEBAUTHN_ORIGIN or f"https://{settings.HOST}",
        rp_id=rp_id,
    )

    # 存储凭据
    credential = UserWebAuthnCredential(
        user_id=user.id,
        credential_id=credential_id,
        public_key=webauthn.helpers.base64url.b64encode(
            verification.credential.public_key
        ).decode(),
        counter=verification.credential.counter,
        label=label or "认证器",
        transports=",".join(
            t.value for t in registration_response.response.get("transports", [])
        )
        if hasattr(registration_response.response, "get")
        else "",
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

    allow_credentials = [
        PublicKeyCredentialDescriptor(
            type="public-key",
            id=webauthn.helpers.base64url.b64decode(cid),
            transports=[
                AuthenticatorTransport.INTERNAL,
                AuthenticatorTransport.USB,
                AuthenticatorTransport.NFC,
            ],
        )
        for cid in cred_ids
    ]

    options = await webauthn.helpers.generate_authentication_options(
        challenge=os.urandom(32),
        rp_id=rp_id,
        allow_credentials=allow_credentials,
        user_verification=UserVerificationRequirement.PREFERRED,
    )

    challenge_b64 = webauthn.helpers.base64url.b64encode(options.challenge).decode()

    return WebAuthnAuthStartResponse(
        challenge=challenge_b64,
        rp_id=rp_id,
        timeout=options.timeout,
        allow_credentials=cred_ids,
        user_verification="preferred",
    )


async def verify_authentication(
    db: AsyncSession,
    credential_id: str,
    raw_id: str,
    response: dict[str, Any],
    client_json: str,
) -> UserWebAuthnCredential | None:
    """验证 WebAuthn 认证并更新计数器。"""
    settings = get_settings()
    rp_id = settings.WEBAUTHN_RP_ID or "localhost"

    # 查找凭据
    result = await db.execute(
        select(UserWebAuthnCredential).where(
            UserWebAuthnCredential.credential_id == credential_id
        )
    )
    credential = result.scalar_one_or_none()
    if not credential:
        return None

    # 构建验证响应
    authentication_response = webauthn.helpers.structs.CredentialRequestOptionsResponse(
        id=credential_id,
        raw_id=webauthn.helpers.base64url.b64decode(raw_id),
        response=webauthn.helpers.structs.AuthenticatorAssertionResponse(
            client_data_json=client_json.encode("utf-8"),
            authenticator_data=webauthn.helpers.base64url.b64decode(
                response["authenticatorData"]
            ),
            signature=webauthn.helpers.base64url.b64decode(response["signature"]),
            user_handle=(
                webauthn.helpers.base64url.b64decode(response["userHandle"])
                if "userHandle" in response
                else None
            ),
        ),
        type="public-key",
    )

    # 构造 stored credential 用于验证
    from webauthn.helpers.structs import PublicKeyCredential

    stored_credential = PublicKeyCredential(
        id=credential.credential_id,
        raw_id=webauthn.helpers.base64url.b64decode(credential.credential_id),
        type="public-key",
        public_key=webauthn.helpers.base64url.b64decode(credential.public_key),
        counter=credential.counter,
    )

    verification = await webauthn.helpers.verify_authentication_response(
        assertion=authentication_response,
        credential=stored_credential,
        expected_challenge=webauthn.helpers.base64url.b64decode(
            _get_challenge_from_response(client_json)
        ),
        expected_rp_id=rp_id,
        expected_origin=settings.WEBAUTHN_ORIGIN or f"https://{settings.HOST}",
    )

    # 更新计数器
    credential.counter = verification.credential.counter
    credential.last_used_at = __import__("datetime").datetime.now(
        __import__("datetime").timezone.utc
    )

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
    from sqlalchemy import delete as sql_delete

    query = sql_delete(UserWebAuthnCredential).where(
        UserWebAuthnCredential.user_id == user_id
    )
    if credential_id:
        query = query.where(UserWebAuthnCredential.credential_id == credential_id)
    await db.execute(query)


def _get_challenge_from_response(client_json: str) -> str:
    """从 client_data_json 中提取 challenge（base64url 编码）。"""
    try:
        data = json.loads(client_json)
        return data.get("challenge", "")
    except (json.JSONDecodeError, AttributeError):
        return ""