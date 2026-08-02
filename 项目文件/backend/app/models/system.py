"""系统管理模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.server import Server
    from app.models.service import Service


class System(Base):
    """系统表"""

    __tablename__ = "systems"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="系统名称")
    description: Mapped[str | None] = mapped_column(Text(), nullable=True, comment="描述")
    server_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=False
    )
    maintainer_ids: Mapped[list] = mapped_column(
        JSONB, default=list, comment="维护者 UUID 列表"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # 关系
    server: Mapped["Server"] = relationship("Server", back_populates="systems")
    services: Mapped[list["Service"]] = relationship(
        "Service", back_populates="system", cascade="all, delete-orphan"
    )
