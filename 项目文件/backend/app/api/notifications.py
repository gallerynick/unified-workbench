"""通知 API 路由"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.notification import NotificationListResponse, NotificationResponse
from app.services import notification_crud as notification_service

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[NotificationListResponse])
async def list_notifications_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取通知列表"""
    items, total = await notification_service.list_notifications(
        db, current_user.id, page, page_size, unread_only
    )
    return UnifiedResponse(
        data=NotificationListResponse(
            items=[NotificationResponse.model_validate(i) for i in items], total=total
        )
    )


@router.put("/{notification_id}/read", response_model=UnifiedResponse[None])
async def mark_as_read_endpoint(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """标记通知为已读"""
    success = await notification_service.mark_as_read(
        db, notification_id, current_user.id
    )
    if not success:
        raise HTTPException(status_code=404, detail="通知不存在")
    return UnifiedResponse(msg="已标记")


@router.put("/read-all", response_model=UnifiedResponse[None])
async def mark_all_as_read_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """标记所有通知为已读"""
    count = await notification_service.mark_all_as_read(db, current_user.id)
    return UnifiedResponse(msg=f"已标记{count}条")
