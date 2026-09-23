"""AI 纪要表模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.meeting_record import MeetingRecord


class MeetingMinutes(Base):
    """AI 纪要表"""

    __tablename__ = "meeting_minutes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    meeting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("meeting_record.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        comment="会议ID",
    )
    summary: Mapped[str] = mapped_column(
        Text, nullable=False, comment="总结"
    )
    key_points: Mapped[list] = mapped_column(
        JSONB, default=list, comment="重点摘要数组"
    )
    todos: Mapped[list] = mapped_column(
        JSONB, default=list, comment="待办事项数组 [{content, source_quote}]"
    )
    model_used: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="生成时用的模型名"
    )
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), comment="生成时间"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # 关系
    meeting: Mapped["MeetingRecord"] = relationship(
        "MeetingRecord", back_populates="minutes"
    )
