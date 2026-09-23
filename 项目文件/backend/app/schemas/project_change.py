"""项目变更 Pydantic 模型"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProjectChangeCreate(BaseModel):
    """创建项目变更请求"""

    project_id: uuid.UUID
    number: str = Field(max_length=50)
    title: str = Field(max_length=200)
    date: datetime
    category_major: str = Field(max_length=50)
    category_minor: str | None = Field(default=None, max_length=50)
    category_detail: str | None = Field(default=None, max_length=200)
    content: str | None = None
    status: str = Field(default="pending", max_length=20)


class ProjectChangeUpdate(BaseModel):
    """更新项目变更请求"""

    number: str | None = Field(default=None, max_length=50)
    title: str | None = Field(default=None, max_length=200)
    date: datetime | None = None
    category_major: str | None = Field(default=None, max_length=50)
    category_minor: str | None = Field(default=None, max_length=50)
    category_detail: str | None = Field(default=None, max_length=200)
    content: str | None = None
    status: str | None = Field(default=None, max_length=20)


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
