"""推流配置业务逻辑"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.system_config import get_config, update_config

DEFAULT_STREAM_CONFIG: dict = {
    "server_url": "rtmp://localhost:1935/live",
    "server_port": 1935,
    "default_bitrate": 2500,
    "default_resolution": "1920x1080",
    "default_fps": 30,
    "max_bitrate": 10000,
    "min_bitrate": 500,
    "enable_auth": True,
}


async def get_stream_config(db: AsyncSession) -> dict:
    """获取推流配置，不存在则返回默认值"""
    config = await get_config(db, "stream_config")
    if config and isinstance(config, dict):
        return {**DEFAULT_STREAM_CONFIG, **config}
    return DEFAULT_STREAM_CONFIG


async def update_stream_config(db: AsyncSession, updates: dict) -> dict:
    """更新推流配置"""
    current = await get_stream_config(db)
    updated = {**current, **updates}
    await update_config(db, "stream_config", updated)
    return updated


async def get_user_stream_key(db: AsyncSession, user_id: uuid.UUID) -> str:
    """获取用户的推流密钥，不存在则自动生成"""
    keys = await get_config(db, "stream_keys")
    if not keys or not isinstance(keys, dict):
        keys = {}
    uid = str(user_id)
    user_key = keys.get(uid)
    if not user_key:
        user_key = str(uuid.uuid4())
        keys[uid] = user_key
        await update_config(db, "stream_keys", keys)
    return user_key


async def reset_user_stream_key(db: AsyncSession, user_id: uuid.UUID) -> str:
    """重置用户的推流密钥"""
    keys = await get_config(db, "stream_keys")
    if not keys or not isinstance(keys, dict):
        keys = {}
    uid = str(user_id)
    new_key = str(uuid.uuid4())
    keys[uid] = new_key
    await update_config(db, "stream_keys", keys)
    return new_key
