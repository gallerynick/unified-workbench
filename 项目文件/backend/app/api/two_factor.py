"""双因素认证（2FA）管理 API 路由。"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import verify_password
from app.models.user import User
from app.schemas.auth import (
    TwoFAActivateRequest,
    TwoFADeviceResponse,
    TwoFARecoveryCodesRequest,
    TwoFARemoveDeviceRequest,
    TwoFASetupRequest,
    TwoFAStatusResponse,
)
from app.schemas.common import UnifiedResponse
from app.services import two_factor

router = APIRouter()


def _verify_login_password(user: User, password: str) -> None:
    """校验当前用户登录密码（敏感操作二次确认）。"""
    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="登录密码错误"
        )


@router.get("/status", response_model=UnifiedResponse[TwoFAStatusResponse])
async def get_status_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前用户 2FA 状态。"""
    devices = await two_factor.list_active_devices(db, current_user.id)
    remaining = await two_factor.count_unused_recovery_codes(db, current_user.id)
    return UnifiedResponse(
        data=TwoFAStatusResponse(
            enabled=len(devices) > 0,
            device_count=len(devices),
            recovery_codes_remaining=remaining,
        )
    )


@router.get("/devices", response_model=UnifiedResponse[list[TwoFADeviceResponse]])
async def list_devices_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出当前用户已绑定的认证器设备。"""
    devices = await two_factor.list_active_devices(db, current_user.id)
    return UnifiedResponse(
        data=[
            TwoFADeviceResponse(
                id=d.id,
                label=d.label,
                is_active=d.is_active,
                created_at=d.created_at,
                last_used_at=d.last_used_at,
            )
            for d in devices
        ]
    )


@router.post("/setup", response_model=UnifiedResponse[dict])
async def setup_endpoint(
    request: TwoFASetupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建新的待绑定认证器设备，返回明文密钥与 otpauth URI（仅此一次）。"""
    _verify_login_password(current_user, request.password)
    device, secret, uri = await two_factor.create_pending_device(
        db, current_user, request.label or "认证器"
    )
    await db.commit()
    return UnifiedResponse(
        data={"device_id": str(device.id), "secret": secret, "otpauth_uri": uri}
    )


@router.post("/activate", response_model=UnifiedResponse[dict])
async def activate_endpoint(
    request: TwoFAActivateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """用动态码激活待绑定设备。"""
    ok = await two_factor.verify_and_activate_device(
        db, current_user, request.device_id, request.code
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="动态码错误，请重试"
        )
    await db.commit()
    return UnifiedResponse(msg="认证器绑定成功")


@router.post("/devices/{device_id}/remove", response_model=UnifiedResponse[None])
async def remove_device_endpoint(
    device_id: uuid.UUID,
    request: TwoFARemoveDeviceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除某个已绑定的认证器设备（需校验登录密码）。"""
    _verify_login_password(current_user, request.password)
    await two_factor.remove_device(db, current_user.id, device_id)
    await db.commit()
    return UnifiedResponse(msg="已删除该认证器")


@router.post("/disable", response_model=UnifiedResponse[None])
async def disable_endpoint(
    request: TwoFARecoveryCodesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """关闭 2FA：校验密码后删除全部已激活设备与恢复码。"""
    _verify_login_password(current_user, request.password)
    await two_factor.remove_all_active_devices(db, current_user.id)
    await two_factor.delete_recovery_codes(db, current_user.id)
    await db.commit()
    return UnifiedResponse(msg="已关闭双因素认证")


@router.post("/recovery-codes", response_model=UnifiedResponse[dict])
async def generate_recovery_codes_endpoint(
    request: TwoFARecoveryCodesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """重新生成一批恢复码，返回明文（仅此一次展示）。"""
    _verify_login_password(current_user, request.password)
    codes = await two_factor.generate_recovery_codes(db, current_user.id)
    await db.commit()
    return UnifiedResponse(data={"codes": codes})
