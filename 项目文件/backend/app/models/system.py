"""系统管理模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.server import Server
    from app.models.service import Service


class System(Base):
    """系统表 — 深度0：直接挂 Server（parent_system_id=None，可建 VM+Service）
    深度1：VM（parent_system_id 非空，仅可建 Service）"""

    __tablename__ = "systems"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="系统名称")
    description: Mapped[str | None] = mapped_column(Text(), nullable=True, comment="描述")
    server_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=False
    )
    parent_system_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("systems.id", ondelete="CASCADE"),
        nullable=True,
        comment="父系统 ID（非空表示 VM，深度=1）",
    )
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True, comment="IP 地址")
    os_type: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="操作系统类型")
    os_version: Mapped[str | None] = mapped_column(String(100), nullable=True, comment="操作系统版本")
    cpu_allocated: Mapped[int | None] = mapped_column(Integer, nullable=True, comment="分配 CPU 核心数")
    ram_allocated: Mapped[int | None] = mapped_column(Integer, nullable=True, comment="分配内存 GB")
    disk_allocated: Mapped[int | None] = mapped_column(Integer, nullable=True, comment="分配磁盘 GB")
    status: Mapped[str] = mapped_column(
        String(20), server_default="running", comment="状态: running/stopped/paused/error"
    )
    environment: Mapped[str] = mapped_column(
        String(20), server_default="production", comment="环境: production/staging/development/testing"
    )
    tags: Mapped[list] = mapped_column(JSONB, default=list, comment="标签列表")
    notes: Mapped[str | None] = mapped_column(
        String(1000), nullable=True, comment="备注"
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
    parent_system: Mapped["System | None"] = relationship(
        "System",
        remote_side=[id],
        back_populates="child_systems",
        lazy="selectin",
    )
    child_systems: Mapped[list["System"]] = relationship(
        "System",
        back_populates="parent_system",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
