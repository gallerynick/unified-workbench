"""项目事件模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class ProjectEvent(Base):
    """项目事件表"""

    __tablename__ = "project_event"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project.id", ondelete="CASCADE"),
        nullable=False,
        comment="所属项目ID",
    )
    number: Mapped[str] = mapped_column(String(50), nullable=False, comment="事件编号")
    event_type: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="事件类型"
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="事件标题")
    details: Mapped[dict] = mapped_column(JSONB, default=dict, comment="事件详情")
    operator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
        comment="操作者ID",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # 关系
    project: Mapped[Project] = relationship("Project", lazy="selectin")
    operator: Mapped[User] = relationship("User", lazy="selectin")
