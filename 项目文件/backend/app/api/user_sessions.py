"""用户会话管理 API — 设备终端列表与撤销。"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.user_session import UserSession
from app.schemas.common import UnifiedResponse
from app.schemas.user_session import DeviceResponse, SessionResponse

router = APIRouter()


@router.get("/me/sessions", response_model=UnifiedResponse[list[SessionResponse]])
async def list_my_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前用户的所有登录会话。按最近活跃时间倒序排列。"""
    result = await db.execute(
        select(UserSession)
        .where(
            UserSession.user_id == current_user.id,
            UserSession.is_revoked == False,
        )
        .order_by(UserSession.last_active_at.desc())
    )
    sessions = result.scalars().all()
    return UnifiedResponse(
        data=[SessionResponse.model_validate(s) for s in sessions]
    )


@router.delete("/me/sessions/{session_id}", response_model=UnifiedResponse[None])
async def revoke_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """撤销指定会话（从设备终端退出）。

    仅允许撤销当前用户自己的会话。
    """
    result = await db.execute(
        select(UserSession).where(
            UserSession.id == session_id,
            UserSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    if session.is_revoked:
        raise HTTPException(status_code=400, detail="会话已被撤销")

    session.is_revoked = True
    await db.commit()
    return UnifiedResponse(data=None)


@router.get("/me/devices", response_model=UnifiedResponse[list[DeviceResponse]])
async def list_my_devices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前用户的登录设备（按 device_token 分组统计）。

    有 device_token 的会话按设备分组；无 device_token 的历史会话（旧数据）
    合并为一个 device_token="" 的"历史会话"组，置于列表末尾。
    """
    result = await db.execute(
        select(
            UserSession.device_token,
            func.max(UserSession.device_name).label("device_name"),
            func.max(UserSession.device_type).label("device_type"),
            func.max(UserSession.ip_address).label("ip_address"),
            func.count().label("session_count"),
            func.max(UserSession.last_active_at).label("last_active_at"),
        )
        .where(
            UserSession.user_id == current_user.id,
            UserSession.is_revoked == False,
            UserSession.device_token.is_not(None),
        )
        .group_by(UserSession.device_token)
        .order_by(func.max(UserSession.last_active_at).desc())
    )
    devices = [
        DeviceResponse(
            device_token=row.device_token,
            device_name=row.device_name,
            device_type=row.device_type,
            ip_address=row.ip_address,
            session_count=row.session_count,
            last_active_at=row.last_active_at,
        )
        for row in result.all()
    ]

    # 无 device_token 的历史会话（旧数据）合并为一组
    legacy_result = await db.execute(
        select(
            func.max(UserSession.device_name).label("device_name"),
            func.max(UserSession.device_type).label("device_type"),
            func.max(UserSession.ip_address).label("ip_address"),
            func.count().label("session_count"),
            func.max(UserSession.last_active_at).label("last_active_at"),
        ).where(
            UserSession.user_id == current_user.id,
            UserSession.is_revoked == False,
            UserSession.device_token.is_(None),
        )
    )
    legacy = legacy_result.one()
    if legacy.session_count:
        devices.append(
            DeviceResponse(
                device_token="",
                device_name="历史会话",
                device_type=None,
                ip_address=legacy.ip_address,
                session_count=legacy.session_count,
                last_active_at=legacy.last_active_at,
            )
        )

    return UnifiedResponse(data=devices)


@router.get("/me/devices/{token}/sessions", response_model=UnifiedResponse[list[SessionResponse]])
async def list_device_sessions(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取指定设备最近 20 条登录会话。token 为空表示历史会话。"""
    if token == "":
        result = await db.execute(
            select(UserSession)
            .where(
                UserSession.user_id == current_user.id,
                UserSession.is_revoked == False,
                UserSession.device_token.is_(None),
            )
            .order_by(UserSession.last_active_at.desc())
            .limit(20)
        )
    else:
        result = await db.execute(
            select(UserSession)
            .where(
                UserSession.user_id == current_user.id,
                UserSession.is_revoked == False,
                UserSession.device_token == token,
            )
            .order_by(UserSession.last_active_at.desc())
            .limit(20)
        )
    sessions = result.scalars().all()
    return UnifiedResponse(
        data=[SessionResponse.model_validate(s) for s in sessions]
    )


@router.delete("/me/devices/{token}", response_model=UnifiedResponse[dict])
async def revoke_device(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """批量撤销指定设备的所有会话，返回被撤销的会话数。

    撤销后这些会话的 jti 进入黑名单，对应请求将自动失效（强制下线）。
    """
    if token == "":
        raise HTTPException(status_code=400, detail="历史会话不支持批量撤销")
    result = await db.execute(
        update(UserSession)
        .where(
            UserSession.user_id == current_user.id,
            UserSession.device_token == token,
            UserSession.is_revoked == False,
        )
        .values(is_revoked=True)
    )
    await db.commit()
    return UnifiedResponse(data={"affected_count": result.rowcount})  # type: ignore[attr-defined]
