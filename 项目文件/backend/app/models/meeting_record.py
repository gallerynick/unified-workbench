"""会议记录主表模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.meeting_transcript_segment import MeetingTranscriptSegment
    from app.models.meeting_minutes import MeetingMinutes


class MeetingRecord(Base):
    """会议记录主表"""

    __tablename__ = "meeting_record"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    number: Mapped[str] = mapped_column(
        String(50), nullable=False, unique=True, comment="会议编号 MTG-YYYYMMDD-NNN"
    )
    title: Mapped[str] = mapped_column(
        String(500), nullable=False, comment="会议标题"
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
        comment="创建者ID",
    )
    visibility: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="private",
        comment="可见性：private/public/restricted",
    )
    restricted_users: Mapped[list] = mapped_column(
        JSONB, default=list, comment="指定可见用户ID列表"
    )
    restricted_tags: Mapped[list] = mapped_column(
        JSONB, default=list, comment="指定可见标签ID列表"
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="not_started",
        comment="状态：not_started/recording/paused/processing/completed",
    )
    paused_reason: Mapped[str | None] = mapped_column(
        String(20), nullable=True, comment="暂停原因：manual/client_left"
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="开始时间"
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="结束时间"
    )
    duration_seconds: Mapped[int] = mapped_column(
        Integer, default=0, comment="累计转录时长（秒）"
    )
    audio_file_path: Mapped[str | None] = mapped_column(
        String(500), nullable=True, comment="音频文件路径"
    )
    diarization_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        comment="说话人分离状态：pending/done/failed",
    )
    minutes_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        comment="纪要生成状态：pending/done/failed",
    )
    minutes_reviewed: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="纪要是否已审核"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # 关系
    owner: Mapped["User"] = relationship("User", lazy="selectin")
    segments: Mapped[list["MeetingTranscriptSegment"]] = relationship(
        "MeetingTranscriptSegment",
        back_populates="meeting",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    minutes: Mapped["MeetingMinutes | None"] = relationship(
        "MeetingMinutes",
        back_populates="meeting",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )
