"""模板 Pydantic 模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# 支持的字段类型
FIELD_TYPES = (
    "text",
    "textarea",
    "richtext",
    "number",
    "datetime",
    "select",
    "multiselect",
    "boolean",
    "file",
    "image",
    "divider",
)


class TemplateField(BaseModel):
    """模板字段定义"""

    key: str
    type: str
    label: str
    required: bool = False
    default_value: Any = None
    placeholder: str | None = None
    sort_order: int = 0
    options: list[dict[str, Any]] | None = None
    config: dict[str, Any] | None = None


class TemplateCreate(BaseModel):
    """创建模板请求"""

    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(max_length=100)
    category: str = Field(default="默认", max_length=50)
    location: str = Field(default="global", max_length=20)
    schema_: list[TemplateField] = Field(alias="schema")


class TemplateUpdate(BaseModel):
    """更新模板请求"""

    model_config = ConfigDict(populate_by_name=True)

    name: str | None = Field(default=None, max_length=100)
    category: str | None = Field(default=None, max_length=50)
    location: str | None = Field(default=None, max_length=20)
    schema_: list[TemplateField] | None = Field(default=None, alias="schema")


class TemplateResponse(BaseModel):
    """模板响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: str
    location: str
    schema_: list[dict[str, Any]] = Field(alias="schema")
    version: int
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class TemplateListResponse(BaseModel):
    """模板列表响应"""

    items: list[TemplateResponse]
    total: int
