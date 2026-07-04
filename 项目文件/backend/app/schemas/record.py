"""记录 Pydantic 模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.record import RecordStatus, RecordType


class RecordCreate(BaseModel):
    """创建记录请求"""

    template_id: uuid.UUID
    title: str
    data: dict[str, Any] = {}
    type: RecordType = RecordType.RECORD
    visibility: str = "private"
    restricted_users: list[str] | None = None
    restricted_tags: list[str] | None = None


class RecordUpdate(BaseModel):
    """更新记录请求"""

    title: str | None = None
    data: dict[str, Any] | None = None
    visibility: str | None = None
    restricted_users: list[str] | None = None
    restricted_tags: list[str] | None = None


class RecordStatusUpdate(BaseModel):
    """更新记录状态请求"""

    status: RecordStatus


class RecordResponse(BaseModel):
    """记录响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    template_id: uuid.UUID
    template_snapshot: Any
    data: dict[str, Any]
    type: str
    title: str
    status: str
    owner_id: uuid.UUID
    owner_name: str
    visibility: str
    restricted_users: list[str] | None = None
    restricted_tags: list[str] | None = None
    created_at: datetime
    updated_at: datetime


class RecordListResponse(BaseModel):
    """记录列表响应"""

    items: list[RecordResponse]
    total: int
