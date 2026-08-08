"""用户通知配置业务逻辑"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_notification_config import UserNotificationConfig
from app.schemas.user_notification_config import UserNotificationConfigUpdate


async def get_config(
    db: AsyncSession, user_id: uuid.UUID
) -> UserNotificationConfig | None:
    """获取用户的通知配置"""
    result = await db.execute(
        select(UserNotificationConfig).where(
            UserNotificationConfig.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def upsert_config(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: UserNotificationConfigUpdate,
) -> UserNotificationConfig:
    """创建或更新用户的通知配置"""
    config = await get_config(db, user_id)
    if config:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(config, field, value)
    else:
        config = UserNotificationConfig(
            user_id=user_id,
            **data.model_dump(exclude_unset=True),
        )
        db.add(config)
    await db.flush()
    return config
