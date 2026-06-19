"""公告 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AnnouncementCreate(BaseModel):
    title: str
    content: str
    is_pinned: bool = False
    is_published: bool = True


class AnnouncementUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    is_pinned: bool | None = None
    is_published: bool | None = None


class AnnouncementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    content: str
    is_pinned: bool
    is_published: bool
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class AnnouncementListResponse(BaseModel):
    items: list[AnnouncementResponse]
    total: int
