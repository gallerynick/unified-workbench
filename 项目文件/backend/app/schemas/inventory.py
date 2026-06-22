"""物品管理 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

VALID_STATUSES = {"available", "in_use", "maintenance", "retired"}


class InventoryCreate(BaseModel):
    """创建物品请求"""

    name: str
    category: str | None = None
    quantity: int = Field(default=0, ge=0)
    location: str | None = None
    description: str | None = None
    status: str = "available"
    tags: list[str] | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status 必须是 {VALID_STATUSES} 之一")
        return v


class InventoryUpdate(BaseModel):
    """更新物品请求"""

    name: str | None = None
    category: str | None = None
    quantity: int | None = Field(default=None, ge=0)
    location: str | None = None
    description: str | None = None
    status: str | None = None
    tags: list[str] | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status 必须是 {VALID_STATUSES} 之一")
        return v


class InventoryResponse(BaseModel):
    """物品响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: str | None
    quantity: int
    location: str | None
    description: str | None
    status: str
    tags: list[str] | None
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class InventoryListResponse(BaseModel):
    """物品列表响应"""

    items: list[InventoryResponse]
    total: int
