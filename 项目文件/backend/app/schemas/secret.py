"""密钥 Pydantic 模型"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SecretCreate(BaseModel):
    """创建密钥请求"""

    name: str
    secret_type: str = "other"
    category_id: uuid.UUID | None = None
    sub_category: str = ""
    data: dict
    note: str = ""


class SecretResponse(BaseModel):
    """密钥元数据响应（不含加密数据）"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    secret_type: str
    category_id: uuid.UUID | None
    sub_category: str
    note: str
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class SecretListResponse(BaseModel):
    """密钥列表响应"""

    items: list[SecretResponse]
    total: int


class SecretVerifyResponse(BaseModel):
    """密钥验证后解密响应"""

    id: uuid.UUID
    name: str
    secret_type: str
    data: dict
    note: str
    created_at: datetime


class PasswordVerifyRequest(BaseModel):
    """密码验证请求"""

    password: str
