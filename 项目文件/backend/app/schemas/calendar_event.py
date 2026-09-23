"""日历事件 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.calendar_event import EventRepeat
from app.schemas.common import INT4_MAX

VALID_REPEATS = {"none", "daily", "weekly", "monthly", "yearly"}


class CalendarEventCreate(BaseModel):
    title: str = Field(max_length=200)
    description: str | None = None
    start_time: str
    end_time: str | None = None
    all_day: bool = False
    location: str | None = Field(default=None, max_length=200)
    repeat: EventRepeat = EventRepeat.NONE
    color: str | None = Field(default=None, max_length=20)
    reminder_enabled: bool = False
    reminder_minutes: int = Field(default=15, le=INT4_MAX)

    @field_validator("repeat")
    @classmethod
    def validate_repeat(cls, v: str) -> str:
        if v not in VALID_REPEATS:
            raise ValueError(f"repeat 必须是 {VALID_REPEATS} 之一")
        return v


class CalendarEventUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    description: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    all_day: bool | None = None
    location: str | None = Field(default=None, max_length=200)
    repeat: EventRepeat | None = None
    color: str | None = Field(default=None, max_length=20)
    reminder_enabled: bool | None = None
    reminder_minutes: int | None = Field(default=None, le=INT4_MAX)

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
    repeat: EventRepeat
    color: str | None
    owner_id: uuid.UUID
    reminder_enabled: bool
    reminder_minutes: int
    reminded: bool
    created_at: datetime
    updated_at: datetime


class CalendarEventListResponse(BaseModel):
    items: list[CalendarEventResponse]
    total: int
