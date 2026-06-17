"""系统配置 API 路由"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.common import UnifiedResponse
from app.schemas.system_config import SystemConfigResponse, SystemConfigUpdate
from app.services.system_config import get_config, update_config

router = APIRouter()


@router.get("/{key}", response_model=UnifiedResponse[SystemConfigResponse])
async def get_config_endpoint(
    key: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取系统配置"""
    value = await get_config(db, key)
    if value is None:
        raise HTTPException(status_code=404, detail="配置不存在")
    return UnifiedResponse(data=SystemConfigResponse(key=key, value=value))


@router.put("/{key}", response_model=UnifiedResponse[SystemConfigResponse])
async def update_config_endpoint(
    key: str,
    data: SystemConfigUpdate,
    current_user=Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """更新系统配置（仅管理员）"""
    config = await update_config(db, key, data.value)
    return UnifiedResponse(data=SystemConfigResponse(key=config.key, value=config.value))
