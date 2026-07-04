"""内容 Pydantic 模型"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.core.visibility import Visibility


class ContentCreateRequest(BaseModel):
    """创建内容请求。"""

    title: str
    body: dict  # Tiptap JSON
    visibility: Visibility = Visibility.PRIVATE
    restricted_users: list[str] | None = None
    restricted_tags: list[str] | None = None
    tags: list[str] | None = None
    file_ids: list[str] | None = None  # 关联的文件 ID 列表


class ContentUpdateRequest(BaseModel):
    """更新内容请求。"""

    title: str | None = None
    body: dict | None = None
    visibility: str | None = None
    restricted_users: list[str] | None = None
    restricted_tags: list[str] | None = None
    tags: list[str] | None = None
    file_ids: list[str] | None = None


class ContentResponse(BaseModel):
    """内容响应。"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    body: dict
    owner_id: uuid.UUID
    visibility: str
    restricted_users: list[str] | None = None
    restricted_tags: list[str] | None = None
    tags: list[str] | None = None
    created_at: datetime
    updated_at: datetime


class ContentListResponse(BaseModel):
    """内容列表响应。"""

    items: list[ContentResponse]
    total: int
