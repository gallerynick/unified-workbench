"""提醒模型"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class ReminderStatus(enum.StrEnum):
    """提醒状态枚举"""

    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TriggerType(enum.StrEnum):
    """触发类型枚举"""

    TIMED = "timed"
    EVENT = "event"


class Reminder(Base):
    """提醒表"""

    __tablename__ = "reminder"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="提醒标题")
    content: Mapped[str | None] = mapped_column(Text, nullable=True, comment="提醒内容")
    trigger_type: Mapped[TriggerType] = mapped_column(
        String(20), nullable=False, comment="触发类型"
    )
    event_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="事件类型（仅 event 触发类型使用）"
    )
    trigger_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="触发时间"
    )
    target_users: Mapped[list | None] = mapped_column(
        JSONB, nullable=True, comment="目标用户列表"
    )
    channels: Mapped[list | None] = mapped_column(
        JSONB, nullable=True, comment="通知渠道"
    )
    status: Mapped[ReminderStatus] = mapped_column(
        String(20), nullable=False, server_default="pending", comment="提醒状态"
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id"), nullable=False, comment="创建者 ID"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), comment="创建时间"
    )

    # 关系
    creator: Mapped[User] = relationship("User", lazy="selectin")
