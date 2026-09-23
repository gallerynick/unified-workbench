"""项目事件 Pydantic 模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ProjectEventCreate(BaseModel):
    """创建项目事件请求"""

    project_id: uuid.UUID
    number: str = Field(max_length=50)
    event_type: str = Field(max_length=50)
    title: str = Field(max_length=200)
    details: dict[str, Any] = {}


class ProjectEventUpdate(BaseModel):
    """更新项目事件请求"""

    number: str | None = Field(default=None, max_length=50)
    event_type: str | None = Field(default=None, max_length=50)
    title: str | None = Field(default=None, max_length=200)
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
