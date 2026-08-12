"""用户会话 Schema。"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SessionResponse(BaseModel):
    """会话响应。"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    device_name: str | None
    device_type: str | None
    ip_address: str | None
    device_token: str | None = None
    last_active_at: datetime
    created_at: datetime


class DeviceResponse(BaseModel):
    """设备响应（按 device_token 分组统计）。"""

    device_token: str
    device_name: str | None
    device_type: str | None
    ip_address: str | None
    session_count: int
    last_active_at: datetime
