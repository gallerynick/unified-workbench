"""系统管理 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SystemCreate(BaseModel):
    """创建系统请求"""

    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    server_id: uuid.UUID
    maintainer_ids: list[uuid.UUID] = Field(default_factory=list)


class SystemUpdate(BaseModel):
    """更新系统请求"""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    server_id: uuid.UUID | None = None
    maintainer_ids: list[uuid.UUID] | None = None


class SystemResponse(BaseModel):
    """系统响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    server_id: uuid.UUID
    name: str
    description: str | None
    maintainer_ids: list[str]
    created_at: datetime
    updated_at: datetime


class SystemListResponse(BaseModel):
    """系统列表响应"""

    items: list[SystemResponse]
    total: int
