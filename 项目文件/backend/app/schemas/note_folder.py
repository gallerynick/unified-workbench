"""笔记文件夹 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NoteFolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    sort_order: int = 0


class NoteFolderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    sort_order: int | None = None


class NoteFolderBrief(BaseModel):
    """笔记响应中内嵌的文件夹简要信息"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class NoteFolderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    sort_order: int
    owner_id: uuid.UUID
    visibility: str
    created_at: datetime
    updated_at: datetime
    # 该文件夹下当前用户可见的笔记数，由服务端聚合后填充
    note_count: int = 0


class NoteFolderListResponse(BaseModel):
    items: list[NoteFolderResponse]
    total: int


class NoteFolderSetRequest(BaseModel):
    """全量替换某笔记的文件夹归属；传空列表表示把笔记移出全部文件夹。"""

    folder_ids: list[uuid.UUID] = Field(default_factory=list)
