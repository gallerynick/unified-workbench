"""项目变更模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.project import Project


class ProjectChange(Base):
    """项目变更表"""

    __tablename__ = "project_change"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project.id", ondelete="CASCADE"),
        nullable=False,
        comment="所属项目ID",
    )
    number: Mapped[str] = mapped_column(String(50), nullable=False, comment="变更编号")
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="变更标题")
    date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, comment="变更日期"
    )
    category_major: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="变更大类"
    )
    category_minor: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="变更小类"
    )
    category_detail: Mapped[str | None] = mapped_column(
        String(200), nullable=True, comment="变更明细分类"
    )
    content: Mapped[str | None] = mapped_column(Text, nullable=True, comment="变更内容")
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="pending", comment="状态: pending/approved/rejected"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # 关系
    project: Mapped[Project] = relationship("Project", lazy="selectin")
