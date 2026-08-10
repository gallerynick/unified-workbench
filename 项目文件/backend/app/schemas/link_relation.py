"""关联关系 Pydantic 模型"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LinkRelationCreate(BaseModel):
    """创建关联关系请求"""

    source_type: str
    source_id: uuid.UUID
    target_type: str
    target_id: uuid.UUID


class LinkRelationResponse(BaseModel):
    """关联关系响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_type: str
    source_id: uuid.UUID
    target_type: str
    target_id: uuid.UUID
    created_at: datetime


class LinkRelationListResponse(BaseModel):
    """关联关系列表响应"""

    items: list[LinkRelationResponse]
    total: int
