"""项目待办 Pydantic 模型"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProjectTodoCreate(BaseModel):
    """创建项目待办请求"""

    project_id: uuid.UUID
    number: str
    title: str
    description: str | None = None
    priority: str = "P2"
    status: str = "pending"
    assignee_id: uuid.UUID | None = None
    proposal_id: uuid.UUID | None = None
    due_date: datetime | None = None


class ProjectTodoUpdate(BaseModel):
    """更新项目待办请求"""

    number: str | None = None
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    status: str | None = None
    assignee_id: uuid.UUID | None = None
    proposal_id: uuid.UUID | None = None
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
    due_date: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ProjectTodoListResponse(BaseModel):
    """项目待办列表响应"""

    items: list[ProjectTodoResponse]
    total: int
