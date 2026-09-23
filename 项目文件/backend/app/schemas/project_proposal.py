"""项目提案 Pydantic 模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ProjectProposalCreate(BaseModel):
    """创建项目提案请求"""

    project_id: uuid.UUID
    number: str = Field(max_length=50)
    title: str = Field(max_length=200)
    type: str = Field(default="feature", max_length=50)
    priority: str = Field(default="P2", max_length=10)
    description: str | None = None
    status: str = Field(default="pending", max_length=20)
    reject_reason: str | None = None
    attachment_links: list[dict[str, Any]] = []
    assignee_id: uuid.UUID | None = None
    meeting_id: uuid.UUID | None = None


class ProjectProposalUpdate(BaseModel):
    """更新项目提案请求"""

    number: str | None = Field(default=None, max_length=50)
    title: str | None = Field(default=None, max_length=200)
    type: str | None = Field(default=None, max_length=50)
    priority: str | None = Field(default=None, max_length=10)
    description: str | None = None
    status: str | None = Field(default=None, max_length=20)
    reject_reason: str | None = None
    attachment_links: list[dict[str, Any]] | None = None
    assignee_id: uuid.UUID | None = None
    meeting_id: uuid.UUID | None = None


class ProjectProposalResponse(BaseModel):
    """项目提案响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    number: str
    title: str
    type: str
    priority: str
    description: str | None = None
    status: str
    reject_reason: str | None = None
    attachment_links: list[Any] = []
    creator_id: uuid.UUID
    assignee_id: uuid.UUID | None = None
    meeting_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime


class ProjectProposalListResponse(BaseModel):
    """项目提案列表响应"""

    items: list[ProjectProposalResponse]
    total: int
