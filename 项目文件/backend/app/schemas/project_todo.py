"""项目待办 Pydantic 模型"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProjectTodoCreate(BaseModel):
    """创建项目待办请求"""

    project_id: uuid.UUID
    number: str = Field(max_length=50)
    title: str = Field(max_length=200)
    description: str | None = None
    priority: str = Field(default="P2", max_length=10)
    status: str = Field(default="pending", max_length=20)
    assignee_id: uuid.UUID | None = None
    proposal_id: uuid.UUID | None = None
    meeting_id: uuid.UUID | None = None
    due_date: datetime | None = None


class ProjectTodoUpdate(BaseModel):
    """更新项目待办请求"""

    number: str | None = Field(default=None, max_length=50)
    title: str | None = Field(default=None, max_length=200)
    description: str | None = None
    priority: str | None = Field(default=None, max_length=10)
    status: str | None = Field(default=None, max_length=20)
    assignee_id: uuid.UUID | None = None
    proposal_id: uuid.UUID | None = None
    meeting_id: uuid.UUID | None = None
    due_date: datetime | None = None


class ProjectTodoResponse(BaseModel):
    """项目待办响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    number: str
    title: str
    description: str | None = None
    priority: str
    status: str
    assignee_id: uuid.UUID | None = None
    creator_id: uuid.UUID
    proposal_id: uuid.UUID | None = None
    meeting_id: uuid.UUID | None = None
    due_date: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ProjectTodoListResponse(BaseModel):
    """项目待办列表响应"""

    items: list[ProjectTodoResponse]
    total: int
