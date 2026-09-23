"""服务器管理 Schema"""

from __future__ import annotations

import ipaddress
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import INT4_MAX, MAX_CPU_CORES

VALID_STATUSES = {"active", "maintenance", "retired"}
VALID_STORAGE_UNITS = {"KB", "MB", "GB", "TB"}

# 容量字段上限取 PostgreSQL int4 上限（common.INT4_MAX）：校验上限不得超过
# 列的存储上限，否则请求能通过 Pydantic 却被 asyncpg 拒绝并抛 500，前端只能
# 看到笼统的 "Request failed"。不设人为业务上限，KB/MB/GB/TB 各单位均可表达。


class ServerCreate(BaseModel):
    """创建服务器请求"""

    name: str = Field(min_length=1, max_length=200)
    hostname: str | None = Field(default=None, max_length=200)
    purpose: str | None = Field(default=None, max_length=500)
    location: str | None = Field(default=None, max_length=200)
    ip: str | None = Field(default=None, max_length=45)
    os: str | None = Field(default=None, max_length=100)
    cpu_cores: int | None = Field(default=None, ge=1, le=MAX_CPU_CORES)
    ram_capacity: int | None = Field(default=None, ge=1, le=INT4_MAX)
    ram_unit: Literal["KB", "MB", "GB", "TB"] | None = None
    disk_capacity: int | None = Field(default=None, ge=1, le=INT4_MAX)
    disk_unit: Literal["KB", "MB", "GB", "TB"] | None = None
    model: str | None = Field(default=None, max_length=200)
    serial_number: str | None = Field(default=None, max_length=100)
    tags: list[str] = Field(default_factory=list)
    description: str | None = None
    notes: str | None = None
    status: str = "active"
    maintainer_ids: list[uuid.UUID] = Field(default_factory=list)
    hardware_specs: list[dict[str, object]] | None = None

    @field_validator("ip")
    @classmethod
    def validate_ip(cls, v: str | None) -> str | None:
        if v is None:
            return v
        try:
            ipaddress.ip_address(v)
        except ValueError:
            raise ValueError(f"ip 必须是合法的 IPv4 或 IPv6 地址，收到: {v}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status 必须是 {VALID_STATUSES} 之一")
        return v


class ServerUpdate(BaseModel):
    """更新服务器请求"""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    hostname: str | None = Field(default=None, max_length=200)
    purpose: str | None = Field(default=None, max_length=500)
    location: str | None = Field(default=None, max_length=200)
    ip: str | None = Field(default=None, max_length=45)
    os: str | None = Field(default=None, max_length=100)
    cpu_cores: int | None = Field(default=None, ge=1, le=MAX_CPU_CORES)
    ram_capacity: int | None = Field(default=None, ge=1, le=INT4_MAX)
    ram_unit: Literal["KB", "MB", "GB", "TB"] | None = None
    disk_capacity: int | None = Field(default=None, ge=1, le=INT4_MAX)
    disk_unit: Literal["KB", "MB", "GB", "TB"] | None = None
    model: str | None = Field(default=None, max_length=200)
    serial_number: str | None = Field(default=None, max_length=100)
    tags: list[str] | None = None
    description: str | None = None
    notes: str | None = None
    status: str | None = None
    maintainer_ids: list[uuid.UUID] | None = None
    hardware_specs: list[dict[str, object]] | None = None

    @field_validator("ip")
    @classmethod
    def validate_ip(cls, v: str | None) -> str | None:
        if v is None:
            return v
        try:
            ipaddress.ip_address(v)
        except ValueError:
            raise ValueError(f"ip 必须是合法的 IPv4 或 IPv6 地址，收到: {v}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status 必须是 {VALID_STATUSES} 之一")
        return v


class ServerResponse(BaseModel):
    """服务器响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    hostname: str | None = None
    purpose: str | None = None
    location: str | None = None
    ip: str | None = None
    os: str | None = None
    cpu_cores: int | None = None
    ram_capacity: int | None = None
    ram_unit: str = "GB"
    disk_capacity: int | None = None
    disk_unit: str = "GB"
    model: str | None = None
    serial_number: str | None = None
    tags: list[str] = []
    description: str | None = None
    notes: str | None = None
    status: str
    maintainer_ids: list[str] = []
    hardware_specs: list[dict[str, object]] = []
    created_at: datetime
    updated_at: datetime


class ServerListResponse(BaseModel):
    """服务器列表响应"""

    items: list[ServerResponse]
    total: int
