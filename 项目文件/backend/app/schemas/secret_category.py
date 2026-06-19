"""密钥分类 Schema。"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SecretCategoryResponse(BaseModel):
    """密钥分类响应。"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str
    owner_id: uuid.UUID
    created_at: datetime


class SecretCategoryCreateRequest(BaseModel):
    """创建密钥分类请求。"""

    name: str
    description: str = ""


class SecretCategoryUpdateRequest(BaseModel):
    """更新密钥分类请求。"""

    name: str | None = None
    description: str | None = None


class SecretCategoryListResponse(BaseModel):
    """密钥分类列表响应。"""

    items: list[SecretCategoryResponse]
    total: int
