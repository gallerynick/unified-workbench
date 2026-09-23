"""客户/联系人 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

VALID_TYPES = {"customer", "supplier", "partner", "other"}


class ContactCreate(BaseModel):
    name: str = Field(max_length=200)
    company: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = None
    contact_type: str = "customer"
    tags: list[str] | None = None
    notes: str | None = None

    @field_validator("contact_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in VALID_TYPES:
            raise ValueError(f"contact_type 必须是 {VALID_TYPES} 之一")
        return v


class ContactUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = None
    contact_type: str | None = None
    tags: list[str] | None = None
    notes: str | None = None

    @field_validator("contact_type")
    @classmethod
    def validate_type(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_TYPES:
            raise ValueError(f"contact_type 必须是 {VALID_TYPES} 之一")
        return v


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
    created_at: datetime
    updated_at: datetime


class ContactListResponse(BaseModel):
    items: list[ContactResponse]
    total: int
