"""服务器管理 Schema"""

from __future__ import annotations

import ipaddress
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

VALID_SERVER_TYPES = {"SINGLE", "MULTI"}
VALID_STATUSES = {"active", "maintenance", "retired"}


class ServerCreate(BaseModel):
    """创建服务器请求"""

    name: str = Field(min_length=1, max_length=200)
    purpose: str | None = None
    location: str | None = None
    ip: str | None = None
    port: int | None = None
    description: str | None = None
    notes: str | None = None
    status: str = "active"
    server_type: str
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

    @field_validator("port")
    @classmethod
    def validate_port(cls, v: int | None) -> int | None:
        if v is None:
            return v
        if not 1 <= v <= 65535:
            raise ValueError(f"port 必须在 1~65535 之间，收到: {v}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status 必须是 {VALID_STATUSES} 之一")
        return v

    @field_validator("server_type")
    @classmethod
    def validate_server_type(cls, v: str) -> str:
        if v not in VALID_SERVER_TYPES:
            raise ValueError(f"server_type 必须是 {VALID_SERVER_TYPES} 之一")
        return v


class ServerUpdate(BaseModel):
    """更新服务器请求"""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    purpose: str | None = None
    location: str | None = None
    ip: str | None = None
    port: int | None = None
    description: str | None = None
    notes: str | None = None
    status: str | None = None
    server_type: str | None = None
    deploy_status: Literal["NORMAL", "PENDING_REDEPLOY", "REDEPLOYING"] | None = None
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

    @field_validator("port")
    @classmethod
    def validate_port(cls, v: int | None) -> int | None:
        if v is None:
            return v
        if not 1 <= v <= 65535:
            raise ValueError(f"port 必须在 1~65535 之间，收到: {v}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status 必须是 {VALID_STATUSES} 之一")
        return v

    @field_validator("server_type")
    @classmethod
    def validate_server_type(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_SERVER_TYPES:
            raise ValueError(f"server_type 必须是 {VALID_SERVER_TYPES} 之一")
        return v


class ServerResponse(BaseModel):
    """服务器响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    purpose: str | None
    location: str | None
    ip: str | None
    port: int | None
    description: str | None
    notes: str | None
    status: str
    server_type: str
    deploy_status: str | None = None
    system_id: uuid.UUID | None = None
    maintainer_ids: list[str]
    created_at: datetime
    updated_at: datetime


class ServerListResponse(BaseModel):
    """服务器列表响应"""

    items: list[ServerResponse]
    total: int


class ChangeServerTypeRequest(BaseModel):
    """变更服务器类型请求"""

    server_type: str = Field(min_length=1)

    @field_validator("server_type")
    @classmethod
    def validate_server_type(cls, v: str) -> str:
        if v not in VALID_SERVER_TYPES:
            raise ValueError(f"server_type 必须是 {VALID_SERVER_TYPES} 之一")
        return v
