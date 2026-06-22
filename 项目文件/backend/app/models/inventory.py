"""物品管理模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class Inventory(Base):
    """物品管理表"""

    __tablename__ = "inventory"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="物品名称")
    category: Mapped[str | None] = mapped_column(String(100), nullable=True, comment="物品分类")
    quantity: Mapped[int] = mapped_column(Integer, default=0, comment="数量")
    location: Mapped[str | None] = mapped_column(String(200), nullable=True, comment="存放位置")
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True, comment="描述")
    status: Mapped[str] = mapped_column(String(20), default="available", comment="状态: available/in_use/maintenance/retired")
    tags: Mapped[list | None] = mapped_column(JSONB, nullable=True, comment="标签")
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # 关系
    owner: Mapped[User] = relationship("User", lazy="selectin")
