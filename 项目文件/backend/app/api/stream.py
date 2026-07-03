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
)


def _get_host(request: Request) -> str:
    """从请求中获取客户端可访问的主机地址"""
    host = request.headers.get("host")
    if host:
        return host.split(":")[0]
    hostname = request.url.hostname
    return hostname if hostname else "localhost"

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
    audio_sample_rate: int | None = None
    audio_channels: int | None = None
    audio_processing_mode: str | None = None
    audio_noise_suppression: bool | None = None
    audio_echo_cancellation: bool | None = None
    audio_auto_gain_control: bool | None = None
    audio_highpass_freq: int | None = None
    audio_compressor_threshold: int | None = None
    audio_compressor_ratio: int | None = None
    audio_limiter_threshold: int | None = None
    audio_output_gain: float | None = None


@router.get("/config")
async def api_get_stream_config(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """[已废弃] 获取推流配置 — 请使用 /api/v1/stream/rooms 配置每个直播间"""
    config = await get_stream_config(db)
    host = _get_host(request)
    if not config.get("server_url"):
        config["server_url"] = f"http://{host}:8889"
    if not config.get("watch_url"):
        config["watch_url"] = f"http://{host}:8889"
    return {"code": 0, "msg": "已废弃，请使用 /api/v1/stream/rooms 管理直播间", "data": config}


@router.put("/config")
async def api_update_stream_config(
    updates: StreamConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """[已废弃] 更新推流配置 — 请在每个直播间内配置推流参数"""
    return {"code": 1, "msg": "已废弃，请在每个直播间内配置推流参数", "data": None}


@router.get("/key")
async def api_get_stream_key(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """[已废弃] 获取当前用户的推流密钥 — 请使用 /api/v1/stream/rooms 管理直播间"""
    return {"code": 1, "msg": "已废弃，请使用 /api/v1/stream/rooms 管理直播间", "data": None}


@router.post("/key/reset")
async def api_reset_stream_key(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """[已废弃] 重置当前用户的推流密钥 — 请使用 /api/v1/stream/rooms 管理直播间"""
    return {"code": 1, "msg": "已废弃，请使用 /api/v1/stream/rooms 管理直播间", "data": None}


@router.post("/speedtest")
async def api_speedtest_upload(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """网络测速 — 接收上传数据并返回接收字节数"""
    body = await request.body()
    return {"code": 0, "msg": "ok", "data": {"received_bytes": len(body)}}


@router.get("/speedtest/download")
async def api_speedtest_download(
    request: Request,
    size: int = 1024 * 1024,
    current_user: User = Depends(get_current_user),
):
    """网络测速 — 返回指定大小的随机数据"""
    from fastapi.responses import Response
    import os
    actual_size = max(128 * 1024, min(size, 16 * 1024 * 1024))
    return Response(content=os.urandom(actual_size), media_type="application/octet-stream")
