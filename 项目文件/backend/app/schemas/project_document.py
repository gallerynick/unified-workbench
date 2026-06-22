"""项目文档 Pydantic 模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ProjectDocumentCreate(BaseModel):
    """创建项目文档请求"""

    project_id: uuid.UUID
    title: str
    content: dict[str, Any] = {}
    template_id: uuid.UUID | None = None


class ProjectDocumentUpdate(BaseModel):
    """更新项目文档请求"""

    title: str | None = None
    content: dict[str, Any] | None = None


class ProjectDocumentResponse(BaseModel):
    """项目文档响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    content: dict[str, Any]
    template_id: uuid.UUID | None
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class ProjectDocumentListResponse(BaseModel):
    """项目文档列表响应"""

    items: list[ProjectDocumentResponse]
    total: int
