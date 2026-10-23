"""客户/联系人模型"""

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


# 联系人类型预设（前端下拉建议项）；contact_type 为 VARCHAR(100) 自由文本，
# 除预设外也允许用户自行输入
PRESET_TYPES: tuple[str, ...] = ("customer", "supplier", "partner")


class Contact(Base):
    """客户/联系人表"""

    __tablename__ = "contact"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    company: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 联系人类型：预设 customer / supplier / partner，也允许自由填写自定义值
    contact_type: Mapped[str] = mapped_column(
        String(100), nullable=False, default="customer", server_default="customer"
    )
    tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"))
    visibility: Mapped[Visibility] = mapped_column(
        String(20), nullable=False, server_default="private"
    )
    restricted_users: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    owner: Mapped[User] = relationship("User", lazy="selectin")
