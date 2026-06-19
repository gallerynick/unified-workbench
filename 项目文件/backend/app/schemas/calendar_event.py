"""日历事件 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

VALID_REPEATS = {"none", "daily", "weekly", "monthly", "yearly"}


class CalendarEventCreate(BaseModel):
    title: str
    description: str | None = None
    start_time: str
    end_time: str | None = None
    all_day: bool = False
    location: str | None = None
    repeat: str = "none"
    color: str | None = None

    @field_validator("repeat")
    @classmethod
    def validate_repeat(cls, v: str) -> str:
        if v not in VALID_REPEATS:
            raise ValueError(f"repeat 必须是 {VALID_REPEATS} 之一")
        return v


class CalendarEventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    all_day: bool | None = None
    location: str | None = None
    repeat: str | None = None
    color: str | None = None

    @field_validator("repeat")
    @classmethod
    def validate_repeat(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_REPEATS:
            raise ValueError(f"repeat 必须是 {VALID_REPEATS} 之一")
        return v


class CalendarEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None
    start_time: datetime
    end_time: datetime | None
    all_day: bool
    location: str | None
    repeat: str
    color: str | None
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class CalendarEventListResponse(BaseModel):
    items: list[CalendarEventResponse]
    total: int
