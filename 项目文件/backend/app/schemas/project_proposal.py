"""项目提案 Pydantic 模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ProjectProposalCreate(BaseModel):
    """创建项目提案请求"""

    project_id: uuid.UUID
    number: str
    title: str
    type: str = "feature"
    priority: str = "P2"
    description: str | None = None
    status: str = "pending"
    reject_reason: str | None = None
    attachment_links: list[dict[str, Any]] = []
    assignee_id: uuid.UUID | None = None


class ProjectProposalUpdate(BaseModel):
    """更新项目提案请求"""

    number: str | None = None
    title: str | None = None
    type: str | None = None
    priority: str | None = None
    description: str | None = None
    status: str | None = None
    reject_reason: str | None = None
    attachment_links: list[dict[str, Any]] | None = None
    assignee_id: uuid.UUID | None = None


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
    created_at: datetime
    updated_at: datetime


class ProjectProposalListResponse(BaseModel):
    """项目提案列表响应"""

    items: list[ProjectProposalResponse]
    total: int
