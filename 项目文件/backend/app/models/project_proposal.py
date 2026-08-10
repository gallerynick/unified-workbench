"""项目提案模型"""

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
    from app.models.user import User


class ProjectProposal(Base):
    """项目提案表"""

    __tablename__ = "project_proposal"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project.id", ondelete="CASCADE"),
        nullable=False,
        comment="所属项目ID",
    )
    number: Mapped[str] = mapped_column(String(50), nullable=False, comment="提案编号")
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="提案标题")
    type: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="feature", comment="提案类型: feature/bug/idea"
    )
    priority: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="P2", comment="优先级: P0/P1/P2/P3"
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True, comment="提案描述")
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="pending", comment="状态: pending/approved/rejected/done"
    )
    reject_reason: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="驳回原因"
    )
    attachment_links: Mapped[list] = mapped_column(
        JSONB, default=list, comment="附件链接列表"
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
        comment="创建者ID",
    )
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="SET NULL"),
        nullable=True,
        comment="负责人ID",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # 关系
    project: Mapped[Project] = relationship("Project", lazy="selectin")
    creator: Mapped[User] = relationship("User", foreign_keys=[creator_id], lazy="selectin")
    assignee: Mapped[User | None] = relationship(
        "User", foreign_keys=[assignee_id], lazy="selectin"
    )
