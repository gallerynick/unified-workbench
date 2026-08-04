"""系统管理 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

VALID_SYSTEM_STATUSES = {"running", "stopped", "paused", "error"}
VALID_ENVIRONMENTS = {"production", "staging", "development", "testing"}


class SystemCreate(BaseModel):
    """创建系统请求 — server_id 必填；parent_system_id 非空表示 VM（深度=1）"""

    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    server_id: uuid.UUID
    parent_system_id: uuid.UUID | None = None
    ip: str | None = None
    os_type: str | None = None
    os_version: str | None = None
    cpu_allocated: int | None = None
    ram_allocated: int | None = None
    disk_allocated: int | None = None
    status: str = "running"
    environment: str = "production"
    tags: list[str] = Field(default_factory=list)
    notes: str | None = None
    maintainer_ids: list[uuid.UUID] = Field(default_factory=list)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_SYSTEM_STATUSES:
            raise ValueError(f"status 必须是 {VALID_SYSTEM_STATUSES} 之一")
        return v

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        if v not in VALID_ENVIRONMENTS:
            raise ValueError(f"environment 必须是 {VALID_ENVIRONMENTS} 之一")
        return v


class SystemUpdate(BaseModel):
    """更新系统请求"""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    server_id: uuid.UUID | None = None
    parent_system_id: uuid.UUID | None = None
    ip: str | None = None
    os_type: str | None = None
    os_version: str | None = None
    cpu_allocated: int | None = None
    ram_allocated: int | None = None
    disk_allocated: int | None = None
    status: str | None = None
    environment: str | None = None
    tags: list[str] | None = None
    notes: str | None = None
    maintainer_ids: list[uuid.UUID] | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_SYSTEM_STATUSES:
            raise ValueError(f"status 必须是 {VALID_SYSTEM_STATUSES} 之一")
        return v

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_ENVIRONMENTS:
            raise ValueError(f"environment 必须是 {VALID_ENVIRONMENTS} 之一")
        return v


class SystemResponse(BaseModel):
    """系统响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    server_id: uuid.UUID
    parent_system_id: uuid.UUID | None = None
    name: str
    description: str | None = None
    ip: str | None = None
    os_type: str | None = None
    os_version: str | None = None
    cpu_allocated: int | None = None
    ram_allocated: int | None = None
    disk_allocated: int | None = None
    status: str = "running"
    environment: str = "production"
    tags: list[str] = []
    notes: str | None = None
    maintainer_ids: list[str] = []
    created_at: datetime
    updated_at: datetime

    @property
    def is_vm(self) -> bool:
        """parent_system_id 非空则为 VM（深度=1）"""
        return self.parent_system_id is not None


class SystemListResponse(BaseModel):
    """系统列表响应"""

    items: list[SystemResponse]
    total: int
