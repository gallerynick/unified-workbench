"""项目会议模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.project import Project


class ProjectMeeting(Base):
    """项目会议表"""

    __tablename__ = "project_meeting"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project.id", ondelete="CASCADE"),
        nullable=False,
        comment="所属项目ID",
    )
    number: Mapped[str] = mapped_column(String(50), nullable=False, comment="会议编号")
    type: Mapped[str] = mapped_column(String(50), nullable=False, comment="会议类型")
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, comment="会议开始时间"
    )
    speaker: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="主讲人"
    )
    participants: Mapped[list] = mapped_column(
        JSONB, default=list, comment="参会人列表"
    )
    content: Mapped[str | None] = mapped_column(Text, nullable=True, comment="会议内容")
    notes: Mapped[list] = mapped_column(JSONB, default=list, comment="会议记录列表")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # 关系
    project: Mapped[Project] = relationship("Project", lazy="selectin")
