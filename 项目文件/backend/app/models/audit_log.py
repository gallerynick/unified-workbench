"""审计日志模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class AuditLog(Base):
    """审计日志表"""

    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"))
    action: Mapped[str] = mapped_column(String(50))  # "upload_file", "create_content", etc.
    target_type: Mapped[str] = mapped_column(String(50))  # "file", "folder", "content"
    target_id: Mapped[str] = mapped_column(String(36))  # UUID string of target
    detail: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True
    )  # 变更 diff
    ip: Mapped[str | None] = mapped_column(
        String(45), nullable=True
    )  # IPv4/IPv6
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )

    # 关系
    user: Mapped[User] = relationship("User")
