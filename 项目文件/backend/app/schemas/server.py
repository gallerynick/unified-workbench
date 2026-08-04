"""服务器管理 Schema"""

from __future__ import annotations

import ipaddress
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

VALID_STATUSES = {"active", "maintenance", "retired"}


class ServerCreate(BaseModel):
    """创建服务器请求"""

    name: str = Field(min_length=1, max_length=200)
    hostname: str | None = None
    purpose: str | None = None
    location: str | None = None
    ip: str | None = None
    os: str | None = None
    cpu_cores: int | None = None
    ram_gb: int | None = None
    disk_gb: int | None = None
    model: str | None = None
    serial_number: str | None = None
    tags: list[str] = Field(default_factory=list)
    description: str | None = None
    notes: str | None = None
    status: str = "active"
    maintainer_ids: list[uuid.UUID] = Field(default_factory=list)

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
    hostname: str | None = None
    purpose: str | None = None
    location: str | None = None
    ip: str | None = None
    os: str | None = None
    cpu_cores: int | None = None
    ram_gb: int | None = None
    disk_gb: int | None = None
    model: str | None = None
    serial_number: str | None = None
    tags: list[str] | None = None
    description: str | None = None
    notes: str | None = None
    status: str | None = None
    maintainer_ids: list[uuid.UUID] | None = None

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
    ram_gb: int | None = None
    disk_gb: int | None = None
    model: str | None = None
    serial_number: str | None = None
    tags: list[str] = []
    description: str | None = None
    notes: str | None = None
    status: str
    maintainer_ids: list[str] = []
    created_at: datetime
    updated_at: datetime


class ServerListResponse(BaseModel):
    """服务器列表响应"""

    items: list[ServerResponse]
    total: int
