"""项目 Pydantic 模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.core.visibility import Visibility


class ProjectCreate(BaseModel):
    """创建项目请求"""

    number: str | None = Field(default=None, max_length=50)
    owner_id: uuid.UUID | None = None
    title: str = Field(max_length=200)
    description: str | None = None
    content: dict[str, Any] = {}
    status: str = Field(default="draft", max_length=20)
    visibility: Visibility = Visibility.PRIVATE
    restricted_users: list[str] | None = None
    restricted_tags: list[str] | None = None
    member_ids: list[str] | None = None
    member_permissions: dict | None = None
    department: str | None = Field(default=None, max_length=50)
    language: str | None = Field(default=None, max_length=30)
    is_open_source: bool | None = None
    priority: str | None = Field(default=None, max_length=20)
    project_type: str | None = Field(default=None, max_length=30)
    goals: str | None = None
    requirements: str | None = None
    additional_req: str | None = None
    modules: str | None = None
    related_projects: str | None = None
    dev_process: str | None = None
    repo_url: str | None = Field(default=None, max_length=500)


class ProjectUpdate(BaseModel):
    """更新项目请求"""

    number: str | None = Field(default=None, max_length=50)
    title: str | None = Field(default=None, max_length=200)
    description: str | None = None
    content: dict[str, Any] | None = None
    status: str | None = Field(default=None, max_length=20)
    visibility: Visibility | None = None
    restricted_users: list[str] | None = None
    restricted_tags: list[str] | None = None
    member_ids: list[str] | None = None
    member_permissions: dict | None = None
    department: str | None = Field(default=None, max_length=50)
    language: str | None = Field(default=None, max_length=30)
    is_open_source: bool | None = None
    priority: str | None = Field(default=None, max_length=20)
    project_type: str | None = Field(default=None, max_length=30)
    goals: str | None = None
    requirements: str | None = None
    additional_req: str | None = None
    modules: str | None = None
    related_projects: str | None = None
    dev_process: str | None = None
    repo_url: str | None = Field(default=None, max_length=500)


class ProjectResponse(BaseModel):
    """项目响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    number: str | None = None
    title: str
    description: str | None = None
    content: dict[str, Any]
    status: str
    owner_id: uuid.UUID
    owner_name: str
    visibility: Visibility
    restricted_users: list[str] | None = None
    restricted_tags: list[str] | None = None
    member_ids: list[str] | None = None
    member_permissions: dict | None = None
    department: str | None = None
    language: str | None = None
    is_open_source: bool = False
    priority: str = "待定"
    project_type: str | None = None
    goals: str | None = None
    requirements: str | None = None
    additional_req: str | None = None
    modules: str | None = None
    related_projects: str | None = None
    dev_process: str | None = None
    repo_url: str | None = None
    created_at: datetime
    updated_at: datetime
    status_log: list[dict] | None = None


class ProjectListResponse(BaseModel):
    """项目列表响应"""

    items: list[ProjectResponse]
    total: int
