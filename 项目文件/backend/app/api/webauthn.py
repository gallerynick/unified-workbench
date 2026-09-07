"""WebAuthn（指纹/面容/安全钥匙）API 路由。"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import verify_password
from app.models.user import User
from app.schemas.auth import (
    WebAuthnAuthFinishRequest,
    WebAuthnAuthStartRequest,
    WebAuthnAuthStartResponse,
    WebAuthnCredentialResponse,
    WebAuthnRegisterFinishRequest,
    WebAuthnRegisterStartRequest,
    WebAuthnRegisterStartResponse,
)
from app.schemas.common import UnifiedResponse
from app.services import webauthn_service
from app.services.auth import verify_2fa_webauthn

router = APIRouter()


def _verify_login_password(user: User, password: str) -> None:
    """校验当前用户登录密码（敏感操作二次确认）。"""
    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="登录密码错误"
        )


@router.get(
    "/credentials",
    response_model=UnifiedResponse[list[WebAuthnCredentialResponse]],
)
async def list_credentials_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出当前用户已注册的 WebAuthn 凭据。"""
    credentials = await webauthn_service.list_credentials(db, current_user)
    return UnifiedResponse(
        data=[
            WebAuthnCredentialResponse(
                id=str(c.id),
                credential_id=c.credential_id,
                label=c.label,
                transports=c.transports,
                created_at=c.created_at,
                last_used_at=c.last_used_at,
            )
            for c in credentials
        ]
    )


@router.post(
    "/register/start",
    response_model=UnifiedResponse[WebAuthnRegisterStartResponse],
)
async def register_start_endpoint(
    request: WebAuthnRegisterStartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """发起 WebAuthn 注册：返回浏览器注册配置。"""
    options = await webauthn_service.generate_registration_options(
        db, current_user, request.label
    )
    return UnifiedResponse(data=options)


@router.post(
    "/register/finish",
    response_model=UnifiedResponse[dict],
)
async def register_finish_endpoint(
    request: WebAuthnRegisterFinishRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """完成 WebAuthn 注册：验证并存储凭据。"""
    credential = await webauthn_service.verify_registration_and_store(
        db,
        current_user,
        request.credential_id,
        request.raw_id,
        request.response,
        request.client_json,
        request.label,
    )
    await db.commit()
    return UnifiedResponse(
        data={"id": str(credential.id), "label": credential.label},
        msg="凭据注册成功",
    )


@router.post(
    "/authenticate/start",
    response_model=UnifiedResponse[WebAuthnAuthStartResponse],
)
async def authenticate_start_endpoint(
    request: WebAuthnAuthStartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """发起 WebAuthn 认证：返回浏览器认证配置。"""
    options = await webauthn_service.generate_authentication_options(
        db, current_user, request.credential_ids
    )
    return UnifiedResponse(data=options)


@router.post(
    "/authenticate/finish",
    response_model=UnifiedResponse[dict],
)
async def authenticate_finish_endpoint(
    request: WebAuthnAuthFinishRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """完成 WebAuthn 认证：验证签名并更新计数器。"""
    credential = await webauthn_service.verify_authentication(
        db,
        request.credential_id,
        request.raw_id,
        request.response,
        request.client_json,
    )
    if not credential:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="凭据未找到或验证失败",
        )
    await db.commit()
    return UnifiedResponse(msg="WebAuthn 验证成功")


@router.post(
    "/credentials/{credential_id}/remove",
    response_model=UnifiedResponse[None],
)
async def remove_credential_endpoint(
    credential_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除指定的 WebAuthn 凭据。"""
    await webauthn_service.remove_credentials(
        db, current_user.id, credential_id
    )
    await db.commit()
    return UnifiedResponse(msg="已删除该凭据")

@router.post(
    "/verify-login",
    response_model=UnifiedResponse[dict],
)
async def verify_login_endpoint(
    request: dict,
    req: Request,
    db: AsyncSession = Depends(get_db),
):
    """WebAuthn 登录验证（第二步：用指纹/面容完成二次验证）。"""
    from app.services.auth import verify_2fa_webauthn
    from app.schemas.auth import LoginResponse

    ip = req.client.host if req.client else None
    user_agent = req.headers.get("User-Agent", "")
    device_token = req.headers.get("X-Device-Token", "")
    tokens = await verify_2fa_webauthn(db, request, ip, user_agent, device_token)
    return UnifiedResponse(data=tokens)
