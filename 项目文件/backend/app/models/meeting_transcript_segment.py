"""转录句子表模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.meeting_record import MeetingRecord


class MeetingTranscriptSegment(Base):
    """转录句子表"""

    __tablename__ = "meeting_transcript_segment"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    meeting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("meeting_record.id", ondelete="CASCADE"),
        nullable=False,
        comment="会议ID",
    )
    seq: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="序号（按转录顺序）"
    )
    text: Mapped[str] = mapped_column(
        Text, nullable=False, comment="句子文本（含标点）"
    )
    audio_start_ms: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="音频起始时间戳（毫秒）"
    )
    audio_end_ms: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="音频结束时间戳（毫秒）"
    )
    speaker: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="说话人标签（会后填充）"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # 关系
    meeting: Mapped["MeetingRecord"] = relationship(
        "MeetingRecord", back_populates="segments"
    )
