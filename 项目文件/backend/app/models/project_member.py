"""项目成员模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class ProjectMember(Base):
    """项目成员表"""

    __tablename__ = "project_member"
    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_member_project_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project.id", ondelete="CASCADE"),
        nullable=False,
        comment="所属项目ID",
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
        comment="成员用户ID",
    )
    role_title: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="角色名称"
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True, comment="备注")
    is_owner: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否项目负责人")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, comment="是否在职")
    joined_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="加入时间"
    )
    left_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="离开时间"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # 关系
    project: Mapped[Project] = relationship("Project", lazy="selectin")
    user: Mapped[User] = relationship("User", lazy="selectin")
