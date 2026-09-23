"""表单 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.visibility import Visibility

# 计数项：选项类为 {"option": "男", "count": 3}；数值分箱为 {"label": "0 ~ 1", "count": 2}
CountItem = dict[str, str | int]


class FormField(BaseModel):
    key: str
    type: str  # text, textarea, number, select, radio, checkbox
    label: str
    required: bool = False
    options: list[str] | None = None
    placeholder: str | None = None


class FormCreate(BaseModel):
    title: str = Field(max_length=200)
    description: str | None = None
    fields: list[FormField]
    visibility: Visibility = Visibility.RESTRICTED
    allow_visitor: bool = False
    restricted_users: list[str] | None = None
    restricted_tags: list[str] | None = None


class FormUpdate(BaseModel):
    """表单元信息更新。

    字段结构（fields）创建后不可修改，因此本模型**故意不包含 fields**：
    后端对携带 fields 的更新请求一律拒绝，避免绕过前端的锁定约定。
    """

    title: str | None = Field(default=None, max_length=200)
    description: str | None = None
    allow_visitor: bool | None = None
    visibility: Visibility | None = None
    restricted_users: list[str] | None = None
    restricted_tags: list[str] | None = None
    is_active: bool | None = None


class FormResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None
    fields: list[dict[str, object]]
    is_active: bool
    allow_visitor: bool
    owner_id: uuid.UUID
    visibility: Visibility
    restricted_users: list[str] | None = None
    restricted_tags: list[str] | None = None
    response_count: int = 0
    created_at: datetime
    updated_at: datetime


class FormListResponse(BaseModel):
    items: list[FormResponse]
    total: int


class FormSubmit(BaseModel):
    data: dict[str, object]


class FormStatsField(BaseModel):
    """单个字段的统计结果。"""

    key: str
    type: str
    label: str
    required: bool = False
    answered_count: int = 0
    answer_rate: float = 0.0
    # select / radio / checkbox：各选项计数
    option_counts: list[CountItem] | None = None
    # number：描述统计（count/mean/median/min/max/stdev）
    number_stats: dict[str, float] | None = None
    # number：分箱分布
    bins: list[CountItem] | None = None


class FormStatsResponse(BaseModel):
    form_id: uuid.UUID
    title: str
    description: str | None = None
    total_responses: int = 0
    visitor_count: int = 0
    first_response_at: datetime | None = None
    last_response_at: datetime | None = None
    field_stats: list[FormStatsField] = Field(default_factory=list)


class FormMyResponse(BaseModel):
    """填写者查看自己已提交内容的响应体。"""

    id: uuid.UUID
    data: dict[str, object]
    created_at: datetime
