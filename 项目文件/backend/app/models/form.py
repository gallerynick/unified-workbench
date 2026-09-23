"""表单/问卷模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.visibility import Visibility

if TYPE_CHECKING:
    from app.models.user import User


class Form(Base):
    """表单/问卷表"""

    __tablename__ = "form"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 字段结构：[{key, type, label, required, options}, ...]
    fields: Mapped[list] = mapped_column(JSONB, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # 允许未登录访客填写（仅公开可见性下生效）；物理列名同为 allow_visitor
    # （由迁移 046 从 allow_anonymous 改名而来）
    allow_visitor: Mapped[bool] = mapped_column(Boolean, default=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"))
    # 表单收集仅提供「公开 / 受限」两态：私有表单无法被他人填写，
    # 故新建表单默认受限（需授权后才可填写），而非全局默认私有的空态。
    visibility: Mapped[Visibility] = mapped_column(
        String(20), default="restricted"
    )  # public/restricted（历史 private 数据保留兼容，不开放填写）
    restricted_users: Mapped[list | None] = mapped_column(
        JSONB, nullable=True
    )  # [user_id, ...]
    restricted_tags: Mapped[list | None] = mapped_column(
        JSONB, nullable=True
    )  # ["tag_name", ...]
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped[User] = relationship("User", lazy="selectin")


class FormResponse(Base):
    """表单回复表"""

    __tablename__ = "form_response"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    form_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("form.id", ondelete="CASCADE"))
    respondent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("user.id"), nullable=True)
    data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    form: Mapped[Form] = relationship("Form", lazy="selectin")
