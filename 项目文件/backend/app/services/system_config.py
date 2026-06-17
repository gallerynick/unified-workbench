"""系统配置业务逻辑"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_config import SystemConfig


async def get_config(db: AsyncSession, key: str) -> dict | None:
    """获取系统配置"""
    config = await db.get(SystemConfig, key)
    return config.value if config else None


async def update_config(db: AsyncSession, key: str, value: dict) -> SystemConfig:
    """更新系统配置（不存在则创建）"""
    config = await db.get(SystemConfig, key)
    if config:
        config.value = value
    else:
        config = SystemConfig(key=key, value=value)
        db.add(config)
    await db.flush()
    return config
