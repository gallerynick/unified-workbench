"""客户/联系人 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

VALID_TYPES = {"customer", "supplier", "partner", "other"}


class ContactCreate(BaseModel):
    name: str
    company: str | None = None
    email: str | None = None
    phone: str | None = None
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
    name: str | None = None
    company: str | None = None
    email: str | None = None
    phone: str | None = None
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
