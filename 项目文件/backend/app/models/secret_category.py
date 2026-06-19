"""密钥分类模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class SecretCategory(Base):
    """密钥分类表"""

    __tablename__ = "secret_category"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="分类名称")
    description: Mapped[str] = mapped_column(
        String(500), nullable=False, server_default="", comment="分类描述"
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )

    # 关系
    owner: Mapped[User] = relationship("User", lazy="selectin")
