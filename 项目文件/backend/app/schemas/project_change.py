"""项目变更 Pydantic 模型"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProjectChangeCreate(BaseModel):
    """创建项目变更请求"""

    project_id: uuid.UUID
    number: str
    title: str
    date: datetime
    category_major: str
    category_minor: str | None = None
    category_detail: str | None = None
    content: str | None = None
    status: str = "pending"


class ProjectChangeUpdate(BaseModel):
    """更新项目变更请求"""

    number: str | None = None
    title: str | None = None
    date: datetime | None = None
    category_major: str | None = None
    category_minor: str | None = None
    category_detail: str | None = None
    content: str | None = None
    status: str | None = None


class ProjectChangeResponse(BaseModel):
    """项目变更响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    number: str
    title: str
    date: datetime
    category_major: str
    category_minor: str | None = None
    category_detail: str | None = None
    content: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime


class ProjectChangeListResponse(BaseModel):
    """项目变更列表响应"""

    items: list[ProjectChangeResponse]
    total: int
