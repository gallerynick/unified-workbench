"""笔记 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NoteCreate(BaseModel):
    title: str
    content: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    is_pinned: bool = False
    parent_id: uuid.UUID | None = None


class NoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    is_pinned: bool | None = None
    parent_id: uuid.UUID | None = None


class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    content: str | None
    category: str | None
    tags: list[str] | None
    is_pinned: bool
    parent_id: uuid.UUID | None
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class NoteListResponse(BaseModel):
    items: list[NoteResponse]
    total: int
