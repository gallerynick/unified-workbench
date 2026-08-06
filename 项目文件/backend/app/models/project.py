"""项目管理模型"""

from __future__ import annotations

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


class Project(Base):
    """项目表"""

    __tablename__ = "project"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[str] = mapped_column(
        String(50), nullable=True, default=None, comment="项目编号/标识"
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="项目名称")
    description: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None, comment="项目描述"
    )
    content: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default="{}", comment="Tiptap JSON 格式文档内容"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="draft", comment="状态: draft/ongoing/done/archived"
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id"), nullable=False, comment="创建者ID"
    )
    visibility: Mapped[Visibility] = mapped_column(
        String(20), nullable=False, server_default="private"
    )
    restricted_users: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    restricted_tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    member_ids: Mapped[list | None] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
    status_log: Mapped[list | None] = mapped_column(JSONB, default=list, comment="状态变更记录")

    # 关系
    owner: Mapped[User] = relationship("User", lazy="selectin")

    @property
    def owner_name(self) -> str:
        return (
            self.owner.nickname
            if self.owner and self.owner.nickname
            else (self.owner.username if self.owner else "未知")
        )
