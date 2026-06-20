"""提醒 API 路由"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.reminder import (
    ReminderCreate,
    ReminderListResponse,
    ReminderResponse,
    ReminderUpdate,
)
from app.services.reminder import (
    create_reminder,
    delete_reminder,
    get_reminder,
    list_reminders,
    update_reminder,
)

router = APIRouter()


@router.post("/", response_model=UnifiedResponse[ReminderResponse])
async def create_reminder_endpoint(
    data: ReminderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建提醒"""
    reminder = await create_reminder(db, data, current_user.id)
    return UnifiedResponse(data=ReminderResponse.model_validate(reminder))


@router.get("/", response_model=UnifiedResponse[ReminderListResponse])
async def list_reminders_endpoint(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出提醒"""
    items, total = await list_reminders(
        db, current_user, filter_status=status, page=page, page_size=page_size
    )
    return UnifiedResponse(
        data=ReminderListResponse(
            items=[ReminderResponse.model_validate(i) for i in items],
            total=total,
        )
    )


@router.get("/{reminder_id}", response_model=UnifiedResponse[ReminderResponse])
async def get_reminder_endpoint(
    reminder_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取单个提醒"""
    reminder = await get_reminder(db, reminder_id, current_user)
    return UnifiedResponse(data=ReminderResponse.model_validate(reminder))


@router.put("/{reminder_id}", response_model=UnifiedResponse[ReminderResponse])
async def update_reminder_endpoint(
    reminder_id: uuid.UUID,
    data: ReminderUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新提醒"""
    reminder = await update_reminder(db, reminder_id, data, current_user)
    return UnifiedResponse(data=ReminderResponse.model_validate(reminder))


@router.delete("/{reminder_id}", response_model=UnifiedResponse[None])
async def delete_reminder_endpoint(
    reminder_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除提醒"""
    await delete_reminder(db, reminder_id, current_user)
    return UnifiedResponse(msg="提醒删除成功")
