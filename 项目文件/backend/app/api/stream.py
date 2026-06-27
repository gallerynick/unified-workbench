"""推流配置 API"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.stream import (
    get_stream_config,
    get_user_stream_key,
    reset_user_stream_key,
    update_stream_config,
)

router = APIRouter(prefix="/stream", tags=["推流配置"])


class StreamConfigUpdate(BaseModel):
    """推流配置更新请求体"""

    server_url: str | None = None
    server_port: int | None = None
    default_bitrate: int | None = None
    default_resolution: str | None = None
    default_fps: int | None = None
    max_bitrate: int | None = None
    min_bitrate: int | None = None
    enable_auth: bool | None = None


@router.get("/config")
async def api_get_stream_config(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取推流配置"""
    config = await get_stream_config(db)
    if "server_url" not in config or not config["server_url"]:
        config["server_url"] = f"rtmp://{request.url.hostname}:1935/live"
    return {"code": 0, "msg": "", "data": config}


@router.put("/config")
async def api_update_stream_config(
    updates: StreamConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新推流配置"""
    config = await update_stream_config(db, updates.model_dump(exclude_none=True))
    return {"code": 0, "msg": "推流配置已更新", "data": config}


@router.get("/key")
async def api_get_stream_key(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取当前用户的推流密钥"""
    key = await get_user_stream_key(db, current_user.id)
    config = await get_stream_config(db)
    server_url = config.get("server_url") or f"rtmp://{request.url.hostname}:1935/live"
    return {
        "code": 0,
        "msg": "",
        "data": {"stream_key": key, "push_url": f"{server_url}/{key}"},
    }


@router.post("/key/reset")
async def api_reset_stream_key(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """重置当前用户的推流密钥"""
    new_key = await reset_user_stream_key(db, current_user.id)
    config = await get_stream_config(db)
    server_url = config.get("server_url") or f"rtmp://{request.url.hostname}:1935/live"
    return {
        "code": 0,
        "msg": "推流密钥已重置",
        "data": {"stream_key": new_key, "push_url": f"{server_url}/{new_key}"},
    }
