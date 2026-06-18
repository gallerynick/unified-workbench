"""记录/项目模型"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.template import Template
    from app.models.user import User


class RecordType(enum.StrEnum):
    """记录类型枚举"""

    PROJECT = "project"
    RECORD = "record"


class RecordStatus(enum.StrEnum):
    """记录状态枚举"""

    DRAFT = "draft"
    ONGOING = "ongoing"
    DONE = "done"
    ARCHIVED = "archived"


class Record(Base):
    """记录/项目表"""

    __tablename__ = "record"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    template_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("template.id"), nullable=False
    )
    template_snapshot: Mapped[dict] = mapped_column(
        JSONB, nullable=False, comment="创建时的模板schema副本"
    )
    data: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default="{}", comment="用户填写的字段值"
    )
    type: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="record", comment="project/record"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="draft", comment="状态流转"
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="记录标题")
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id"), nullable=False
    )
    visibility: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="private"
    )
    restricted_users: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    restricted_tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # 关系
    template: Mapped[Template] = relationship(
        "Template", back_populates="records", lazy="selectin"
    )
    owner: Mapped[User] = relationship("User", lazy="selectin")
