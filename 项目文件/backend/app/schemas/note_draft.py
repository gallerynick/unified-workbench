"""笔记草稿 Schema。"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class DraftSave(BaseModel):
    """保存草稿请求。

    note_id 为空表示「尚未关联笔记的新笔记草稿」，发布时再绑定。
    """

    note_id: uuid.UUID | None = None
    title: str | None = None
    body: dict[str, Any]


class DraftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    note_id: uuid.UUID | None
    title: str | None = None
    body: dict[str, Any] | None = None
    saved_at: datetime
