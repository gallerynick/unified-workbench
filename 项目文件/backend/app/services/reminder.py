"""提醒业务逻辑"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reminder import Reminder
from app.models.user import User
from app.schemas.reminder import ReminderCreate, ReminderUpdate


async def create_reminder(
    db: AsyncSession,
    data: ReminderCreate,
    creator_id: uuid.UUID,
) -> Reminder:
    """创建提醒"""
    reminder = Reminder(
        title=data.title,
        content=data.content,
        trigger_type=data.trigger_type,
        event_type=data.event_type,
        trigger_time=data.trigger_time,
        target_users=data.target_users,
        channels=data.channels,
        creator_id=creator_id,
    )
    db.add(reminder)
    await db.flush()
    return reminder


async def list_reminders(
    db: AsyncSession,
    current_user: User,
    filter_status: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Reminder], int]:
    """列出当前用户的提醒，支持状态过滤"""
    query = select(Reminder).where(Reminder.creator_id == current_user.id)
    count_query = (
        select(func.count())
        .select_from(Reminder)
        .where(Reminder.creator_id == current_user.id)
    )

    if filter_status:
        query = query.where(Reminder.status == filter_status)
        count_query = count_query.where(Reminder.status == filter_status)

    # 总数
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # 分页
    query = query.order_by(Reminder.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    reminders = list(result.scalars().all())

    return reminders, total


async def get_reminder(db: AsyncSession, reminder_id: uuid.UUID, current_user: User) -> Reminder:
    """获取单个提醒，仅创建者可访问。"""
    reminder = await db.get(Reminder, reminder_id)
    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="提醒不存在"
        )
    if reminder.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="提醒不存在"
        )
    return reminder


async def update_reminder(
    db: AsyncSession,
    reminder_id: uuid.UUID,
    data: ReminderUpdate,
    current_user: User,
) -> Reminder:
    """更新提醒，仅创建者可修改。"""
    reminder = await get_reminder(db, reminder_id, current_user)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(reminder, field, value)

    await db.flush()
    return reminder


async def delete_reminder(db: AsyncSession, reminder_id: uuid.UUID, current_user: User) -> None:
    """删除提醒，仅创建者可删除。"""
    reminder = await get_reminder(db, reminder_id, current_user)
    await db.delete(reminder)
    await db.flush()
