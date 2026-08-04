"""服务管理模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.system import System


class Service(Base):
    """服务表"""

    __tablename__ = "services"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="服务名称")
    description: Mapped[str | None] = mapped_column(Text(), nullable=True, comment="描述")
    system_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("systems.id", ondelete="CASCADE"), nullable=False
    )
    protocol: Mapped[str] = mapped_column(
        String(10), server_default="tcp", nullable=False, comment="协议: tcp/udp/http/https"
    )
    status: Mapped[str] = mapped_column(
        String(20), server_default="running", comment="状态: running/stopped/error"
    )
    health_check_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True, comment="健康检查 URL"
    )
    target_type: Mapped[str | None] = mapped_column(
        String(20), nullable=True, comment="目标类型"
    )
    target_name: Mapped[str | None] = mapped_column(
        String(200), nullable=True, comment="目标名称"
    )
    port: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="服务端口"
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
    system: Mapped["System"] = relationship("System", back_populates="services")
