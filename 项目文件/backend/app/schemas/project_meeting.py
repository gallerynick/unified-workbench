"""项目会议 Pydantic 模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ProjectMeetingCreate(BaseModel):
    """创建项目会议请求"""

    project_id: uuid.UUID
    number: str
    type: str
    started_at: datetime
    speaker: str | None = None
    participants: list[str] = []
    content: str | None = None
    notes: list[Any] = []


class ProjectMeetingUpdate(BaseModel):
    """更新项目会议请求"""

    number: str | None = None
    type: str | None = None
    started_at: datetime | None = None
    speaker: str | None = None
    participants: list[str] | None = None
    content: str | None = None
    notes: list[Any] | None = None


class ProjectMeetingResponse(BaseModel):
    """项目会议响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    number: str
    type: str
    started_at: datetime
    speaker: str | None = None
    participants: list[Any] = []
    content: str | None = None
    notes: list[Any] = []
    created_at: datetime
    updated_at: datetime


class ProjectMeetingListResponse(BaseModel):
    """项目会议列表响应"""

    items: list[ProjectMeetingResponse]
    total: int
