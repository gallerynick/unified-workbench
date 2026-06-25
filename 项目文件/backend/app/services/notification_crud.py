"""通知服务"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


async def list_notifications(
    db: AsyncSession,
    user_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
    unread_only: bool = False,
) -> tuple[list[Notification], int]:
    """获取通知列表"""
    query = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        query = query.where(Notification.read == False)
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Notification.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def mark_as_read(
    db: AsyncSession, notification_id: uuid.UUID, user_id: uuid.UUID
) -> bool:
    """标记通知为已读"""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == user_id
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        return False
    notification.read = True
    await db.flush()
    return True


async def mark_all_as_read(db: AsyncSession, user_id: uuid.UUID) -> int:
    """标记所有通知为已读"""
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == user_id, Notification.read == False
        )
    )
    notifications = list(result.scalars().all())
    for n in notifications:
        n.read = True
    await db.flush()
    return len(notifications)


async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    message: str,
    notification_type: str = "info",
) -> Notification:
    """创建通知"""
    notification = Notification(
        user_id=user_id,
        message=message,
        type=notification_type,
    )
    db.add(notification)
    await db.flush()
    await db.refresh(notification)
    return notification
