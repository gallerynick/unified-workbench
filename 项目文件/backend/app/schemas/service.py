"""服务管理 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

VALID_TARGET_TYPES = {"DEVICE", "PERSONNEL", "ORGANIZATION"}


def _validate_port(v: int | None) -> int | None:
    """校验服务端口范围 1-65535（None 表示未提供）"""
    if v is not None and not (1 <= v <= 65535):
        raise ValueError("port 必须在 1-65535 之间")
    return v


class ServiceCreate(BaseModel):
    """创建服务请求"""

    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    system_id: uuid.UUID
    target_type: str | None = None
    target_name: str | None = None
    port: int | None = None
    maintainer_ids: list[uuid.UUID] = Field(default_factory=list)

    @field_validator("target_type")
    @classmethod
    def validate_target_type(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_TARGET_TYPES:
            raise ValueError(f"target_type 必须是 {VALID_TARGET_TYPES} 之一")
        return v

    @field_validator("port")
    @classmethod
    def validate_port(cls, v: int | None) -> int | None:
        return _validate_port(v)


class ServiceUpdate(BaseModel):
    """更新服务请求"""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    system_id: uuid.UUID | None = None
    target_type: str | None = None
    target_name: str | None = None
    port: int | None = None
    maintainer_ids: list[uuid.UUID] | None = None

    @field_validator("target_type")
    @classmethod
    def validate_target_type(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_TARGET_TYPES:
            raise ValueError(f"target_type 必须是 {VALID_TARGET_TYPES} 之一")
        return v

    @field_validator("port")
    @classmethod
    def validate_port(cls, v: int | None) -> int | None:
        return _validate_port(v)


class ServiceResponse(BaseModel):
    """服务响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    system_id: uuid.UUID
    name: str
    description: str | None
    target_type: str | None
    target_name: str | None
    port: int | None
    maintainer_ids: list[str]
    created_at: datetime
    updated_at: datetime


class ServiceListResponse(BaseModel):
    """服务列表响应"""

    items: list[ServiceResponse]
    total: int
