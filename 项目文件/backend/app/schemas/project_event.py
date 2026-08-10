"""项目事件 Pydantic 模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ProjectEventCreate(BaseModel):
    """创建项目事件请求"""

    project_id: uuid.UUID
    number: str
    event_type: str
    title: str
    details: dict[str, Any] = {}


class ProjectEventUpdate(BaseModel):
    """更新项目事件请求"""

    number: str | None = None
    event_type: str | None = None
    title: str | None = None
    details: dict[str, Any] | None = None


class ProjectEventResponse(BaseModel):
    """项目事件响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    number: str
    event_type: str
    title: str
    details: dict[str, Any]
    operator_id: uuid.UUID
    created_at: datetime


class ProjectEventListResponse(BaseModel):
    """项目事件列表响应"""

    items: list[ProjectEventResponse]
    total: int
