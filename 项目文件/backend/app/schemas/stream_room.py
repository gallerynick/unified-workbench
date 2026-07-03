"""直播间 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class StreamRoomConfig(BaseModel):
    """直播间配置"""

    default_bitrate: int = Field(default=8000, ge=0)
    default_resolution: str = Field(default="1920x1080")
    default_fps: int = Field(default=30, ge=0)
    audio_sample_rate: int = Field(default=48000, ge=0)
    audio_channels: int = Field(default=2, ge=0)
    audio_processing_mode: str = Field(default="standard")
    audio_noise_suppression: bool = True
    audio_echo_cancellation: bool = True
    audio_auto_gain_control: bool = True
    audio_highpass_freq: int = Field(default=80, ge=0)
    audio_compressor_threshold: int = Field(default=-24)
    audio_compressor_ratio: int = Field(default=12)
    audio_limiter_threshold: int = Field(default=-3)
    audio_output_gain: float = Field(default=0.85)


class StreamRoomCreate(BaseModel):
    """创建直播间请求"""

    name: str = Field(min_length=1, max_length=100)
    mode: str = Field(default="builtin")
    room_type: str = Field(default="permanent")
    is_open: bool = True
    config: StreamRoomConfig | None = None


class StreamRoomUpdate(BaseModel):
    """更新直播间请求"""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    mode: str | None = None
    room_type: str | None = None
    is_open: bool | None = None
    is_active: bool | None = None
    config: StreamRoomConfig | None = None


class StreamRoomResponse(BaseModel):
    """直播间响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    creator_id: uuid.UUID
    creator_nickname: str
    mode: str
    room_type: str
    config: dict | None = None
    is_open: bool
    is_active: bool
    pusher_id: uuid.UUID | None = None
    last_active_at: datetime | None = None
    created_at: datetime
    pusher_nickname: str | None = None
    push_url: str = ""
    watch_url: str = ""
    rtmp_url: str = ""


class StreamRoomListResponse(BaseModel):
    """直播间列表响应"""

    items: list[StreamRoomResponse]
    total: int
