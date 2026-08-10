"""项目待办模型"""

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
    from app.models.project_proposal import ProjectProposal
    from app.models.user import User


class ProjectTodo(Base):
    """项目待办表"""

    __tablename__ = "project_todo"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project.id", ondelete="CASCADE"),
        nullable=False,
        comment="所属项目ID",
    )
    number: Mapped[str] = mapped_column(String(50), nullable=False, comment="待办编号")
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="待办标题")
    description: Mapped[str | None] = mapped_column(Text, nullable=True, comment="待办描述")
    priority: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="P2", comment="优先级: P0/P1/P2/P3"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="pending", comment="状态: pending/doing/done/cancelled"
    )
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="SET NULL"),
        nullable=True,
        comment="负责人ID",
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
        comment="创建者ID",
    )
    proposal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_proposal.id", ondelete="SET NULL"),
        nullable=True,
        comment="关联提案ID",
    )
    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="截止时间"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # 关系
    project: Mapped[Project] = relationship("Project", lazy="selectin")
    assignee: Mapped[User | None] = relationship(
        "User", foreign_keys=[assignee_id], lazy="selectin"
    )
    creator: Mapped[User] = relationship(
        "User", foreign_keys=[creator_id], lazy="selectin"
    )
    proposal: Mapped[ProjectProposal | None] = relationship(
        "ProjectProposal", lazy="selectin"
    )
