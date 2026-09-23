"""笔记 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class NoteCreate(BaseModel):
    title: str = Field(max_length=200)
    content: str | None = None
    # Tiptap 文档树；plain_text 由服务端从 body 派生，不接受客户端传入
    body: dict[str, Any] | None = None
    category: str | None = Field(default=None, max_length=100)
    tags: list[str] | None = None
    restricted_tags: list[str] | None = None
    is_pinned: bool = False
    parent_id: uuid.UUID | None = None


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    content: str | None = None
    body: dict[str, Any] | None = None
    category: str | None = Field(default=None, max_length=100)
    tags: list[str] | None = None
    restricted_tags: list[str] | None = None
    is_pinned: bool | None = None
    parent_id: uuid.UUID | None = None


class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    content: str | None
    # Tiptap 文档树（JSON），嵌套结构不定，故用 dict[str, Any]
    body: dict[str, Any] | None = None
    plain_text: str | None = None
    category: str | None
    tags: list[str] | None
    is_pinned: bool
    parent_id: uuid.UUID | None
    owner_id: uuid.UUID
    visibility: str
    # 受限可见的用户 id 列表；JSONB 存 UUID 字符串。列已存在，按计划保持必填
    restricted_users: list[str] | None
    # P1 迁移前 note 表尚无该列，必须先给默认值避免 from_attributes 读取报错
    restricted_tags: list[str] | None = None
    created_at: datetime
    updated_at: datetime


class NoteListResponse(BaseModel):
    items: list[NoteResponse]
    total: int
