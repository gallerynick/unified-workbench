"""项目成员 Pydantic 模型"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProjectMemberCreate(BaseModel):
    """创建项目成员请求"""

    project_id: uuid.UUID
    user_id: uuid.UUID
    role_title: str | None = None
    notes: str | None = None
    is_owner: bool = False
    is_active: bool = True
    joined_at: datetime | None = None
    left_at: datetime | None = None


class ProjectMemberUpdate(BaseModel):
    """更新项目成员请求"""

    role_title: str | None = None
    notes: str | None = None
    is_owner: bool | None = None
    is_active: bool | None = None
    joined_at: datetime | None = None
    left_at: datetime | None = None


class ProjectMemberResponse(BaseModel):
    """项目成员响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    role_title: str | None = None
    notes: str | None = None
    is_owner: bool
    is_active: bool
    joined_at: datetime | None = None
    left_at: datetime | None = None
    created_at: datetime


class ProjectMemberListResponse(BaseModel):
    """项目成员列表响应"""

    items: list[ProjectMemberResponse]
    total: int
