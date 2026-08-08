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
    last_active_at: datetime
    created_at: datetime
