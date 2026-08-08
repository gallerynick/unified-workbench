"""用户通知配置 API 路由"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.user_notification_config import (
    UserNotificationConfigResponse,
    UserNotificationConfigUpdate,
)
from app.services.user_notification_config import get_config, upsert_config

router = APIRouter()


@router.get(
    "/",
    response_model=UnifiedResponse[UserNotificationConfigResponse],
)
async def get_notification_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前用户的通知配置"""
    config = await get_config(db, current_user.id)
    if config is None:
        return UnifiedResponse(data=UserNotificationConfigResponse())
    return UnifiedResponse(
        data=UserNotificationConfigResponse.model_validate(config)
    )


@router.put(
    "/",
    response_model=UnifiedResponse[UserNotificationConfigResponse],
)
async def update_notification_config(
    data: UserNotificationConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新当前用户的通知配置"""
    config = await upsert_config(db, current_user.id, data)
    return UnifiedResponse(
        data=UserNotificationConfigResponse.model_validate(config)
    )
