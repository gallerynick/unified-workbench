"""提醒 Pydantic 模型"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ReminderCreate(BaseModel):
    """创建提醒请求"""

    title: str
    content: str | None = None
    trigger_type: str  # "timed" or "event"
    event_type: str | None = None  # 事件类型（仅 event 触发类型使用）
    trigger_time: datetime | None = None
    target_users: list[str] | None = None  # user IDs
    channels: list[str] | None = None  # ["websocket", "feishu", "dingtalk"]


class ReminderUpdate(BaseModel):
    """更新提醒请求"""

    title: str | None = None
    content: str | None = None
    event_type: str | None = None
    trigger_time: datetime | None = None
    target_users: list[str] | None = None
    channels: list[str] | None = None
    status: str | None = None


class ReminderResponse(BaseModel):
    """提醒响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    content: str | None
    trigger_type: str
    event_type: str | None
    trigger_time: datetime | None
    target_users: list | None
    channels: list | None
    status: str
    creator_id: uuid.UUID
    created_at: datetime


class ReminderListResponse(BaseModel):
    """提醒列表响应"""

    items: list[ReminderResponse]
    total: int
