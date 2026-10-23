"""客户/联系人 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.visibility import Visibility

# 联系人类型预设（前端下拉建议项）；contact_type 列本身为 VARCHAR(100)，
# 除预设外也允许自由填写自定义类型，长度由 max_length 约束
PRESET_TYPES: tuple[str, ...] = ("customer", "supplier", "partner")


class ContactCreate(BaseModel):
    name: str = Field(max_length=200)
    company: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = None
    # 预设 customer / supplier / partner，也允许任意自定义文本（最长 100 字符）
    contact_type: str = Field(default="customer", max_length=100)
    tags: list[str] | None = None
    notes: str | None = None
    visibility: Visibility = Visibility.PRIVATE
    restricted_users: list[str] | None = None


class ContactUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = None
    contact_type: str | None = Field(default=None, max_length=100)
    tags: list[str] | None = None
    notes: str | None = None
    visibility: Visibility | None = None
    restricted_users: list[str] | None = None


class ContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    company: str | None
    email: str | None
    phone: str | None
    address: str | None
    contact_type: str
    tags: list[str] | None
    notes: str | None
    owner_id: uuid.UUID
    visibility: Visibility
    restricted_users: list[str] | None = None
    created_at: datetime
    updated_at: datetime


class ContactListResponse(BaseModel):
    items: list[ContactResponse]
    total: int
