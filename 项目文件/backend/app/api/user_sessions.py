"""用户会话管理 API — 设备终端列表与撤销。"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.user_session import UserSession
from app.schemas.common import UnifiedResponse
from app.schemas.user_session import SessionResponse

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
