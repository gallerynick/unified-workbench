"""密钥/数据记录模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, LargeBinary, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class Secret(Base):
    """密钥/数据记录表"""

    __tablename__ = "secret"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="名称")
    secret_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="other",
        comment="api_key/account/config/other",
    )
    encrypted_data: Mapped[bytes] = mapped_column(
        LargeBinary, nullable=False, comment="AES-256-GCM 加密数据"
    )
    note: Mapped[str] = mapped_column(
        String(500), nullable=False, server_default="", comment="备注（明文）"
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
