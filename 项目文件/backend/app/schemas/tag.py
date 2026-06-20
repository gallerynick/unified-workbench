"""标签 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TagCreateRequest(BaseModel):
    name: str
    color: str | None = None


class TagUpdateRequest(BaseModel):
    name: str | None = None
    color: str | None = None


class TagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: str | None
    created_at: datetime


class TagListResponse(BaseModel):
    items: list[TagResponse]
    total: int
