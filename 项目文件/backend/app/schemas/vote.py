"""投票 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class VoteCreate(BaseModel):
    title: str
    description: str | None = None
    options: list[str]
    allow_multiple: bool = False
    deadline: str | None = None


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
