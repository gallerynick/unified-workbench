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
from app.core.visibility import Visibility

if TYPE_CHECKING:
    from app.models.user import User


class ReminderStatus(enum.StrEnum):
    """提醒状态枚举"""

    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Reminder(Base):
    """提醒表"""

    __tablename__ = "reminder"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="提醒标题")
    content: Mapped[str | None] = mapped_column(Text, nullable=True, comment="提醒内容")
    trigger_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="触发时间"
    )
    target_users: Mapped[list | None] = mapped_column(
        JSONB, nullable=True, comment="目标用户列表"
    )
    status: Mapped[ReminderStatus] = mapped_column(
        String(20), nullable=False, server_default="pending", comment="提醒状态"
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id"), nullable=False, comment="创建者 ID"
    )
    visibility: Mapped[Visibility] = mapped_column(
        String(20), nullable=False, server_default="private"
    )
    restricted_users: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), comment="创建时间"
    )

    # 关系
    creator: Mapped[User] = relationship("User", lazy="selectin")
