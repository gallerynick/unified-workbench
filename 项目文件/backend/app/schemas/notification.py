"""通知 Pydantic 模式"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    """通知响应"""

    id: uuid.UUID
    message: str
    type: str
    read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    """通知列表响应"""

    items: list[NotificationResponse]
    total: int
