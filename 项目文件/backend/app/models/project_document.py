"""项目文档模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.record import Record
    from app.models.template import Template
    from app.models.user import User


class ProjectDocument(Base):
    """项目文档表"""

    __tablename__ = "project_document"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("record.id"), nullable=False, comment="所属项目ID"
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="文档标题")
    content: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default="{}", comment="Tiptap JSON格式文档内容"
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("template.id"), nullable=True, comment="关联模板ID"
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id"), nullable=False, comment="创建者ID"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # 关系
    project: Mapped[Record] = relationship("Record", lazy="selectin")
    owner: Mapped[User] = relationship("User", lazy="selectin")
