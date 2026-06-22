"""模板模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.record import Record
    from app.models.user import User


class Template(Base):
    """模板表"""

    __tablename__ = "template"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="模板名称")
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="默认", comment="分类"
    )
    location: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="global", comment="模板位置: project/record/global"
    )
    schema: Mapped[dict] = mapped_column(JSONB, nullable=False, comment="字段定义数组")
    version: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="1", comment="版本号"
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # 关系
    owner: Mapped[User] = relationship("User", lazy="selectin")
    records: Mapped[list[Record]] = relationship(
        "Record", back_populates="template", lazy="selectin"
    )
