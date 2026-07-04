"""投票 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.core.visibility import Visibility


class VoteCreate(BaseModel):
    title: str
    description: str | None = None
    options: list[str]
    allow_multiple: bool = False
    deadline: str | None = None
    visibility: Visibility = Visibility.PRIVATE
    restricted_users: list[str] | None = None
    restricted_tags: list[str] | None = None


class VoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None
    options: list[str]
    allow_multiple: bool
    status: str
    deadline: datetime | None
    owner_id: uuid.UUID
    visibility: str
    restricted_users: list[str] | None = None
    restricted_tags: list[str] | None = None
    created_at: datetime
    updated_at: datetime


class VoteListResponse(BaseModel):
    items: list[VoteResponse]
    total: int


class VoteSubmit(BaseModel):
    selected_options: list[str]


class VoteResult(BaseModel):
    option: str
    count: int
    percentage: float
