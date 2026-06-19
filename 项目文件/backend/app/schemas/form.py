"""表单 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FormField(BaseModel):
    key: str
    type: str  # text, textarea, number, select, radio, checkbox
    label: str
    required: bool = False
    options: list[str] | None = None
    placeholder: str | None = None


class FormCreate(BaseModel):
    title: str
    description: str | None = None
    fields: list[FormField]


class FormResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None
    fields: list[dict]
    is_active: bool
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class FormListResponse(BaseModel):
    items: list[FormResponse]
    total: int


class FormSubmit(BaseModel):
    data: dict
