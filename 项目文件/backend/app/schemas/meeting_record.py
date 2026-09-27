"""会议记录 Pydantic 模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class MeetingRecordCreate(BaseModel):
    """创建会议记录请求"""

    title: str = Field(max_length=500)
    visibility: str = Field(default="private", max_length=20)
    restricted_users: list[uuid.UUID] = []
    restricted_tags: list[uuid.UUID] = []


class MeetingRecordUpdate(BaseModel):
    """更新会议记录请求"""

    title: str | None = Field(default=None, max_length=500)
    visibility: str | None = Field(default=None, max_length=20)
    restricted_users: list[uuid.UUID] | None = None
    restricted_tags: list[uuid.UUID] | None = None
    notes: str | None = None


class MeetingTranscriptSegmentResponse(BaseModel):
    """转录句子响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    meeting_id: uuid.UUID
    seq: int
    text: str
    audio_start_ms: int
    audio_end_ms: int | None = None
    speaker: str | None = None
    created_at: datetime


class MeetingMinutesResponse(BaseModel):
    """AI 纪要响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    meeting_id: uuid.UUID
    summary: str
    key_points: list[Any] = []
    todos: list[Any] = []
    model_used: str
    generated_at: datetime
    created_at: datetime
    updated_at: datetime


class MeetingRecordResponse(BaseModel):
    """会议记录响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    number: str
    title: str
    owner_id: uuid.UUID
    visibility: str
    restricted_users: list[Any] = []
    restricted_tags: list[Any] = []
    status: str
    paused_reason: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_seconds: int
    audio_file_path: str | None = None
    diarization_status: str
    minutes_status: str
    minutes_reviewed: bool
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    segments: list[MeetingTranscriptSegmentResponse] = []
    minutes: MeetingMinutesResponse | None = None


class MeetingRecordListResponse(BaseModel):
    """会议记录列表响应"""

    items: list[MeetingRecordResponse]
    total: int
