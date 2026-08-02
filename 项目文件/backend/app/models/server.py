"""服务器管理模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.system import System
    from app.models.user import User


class Server(Base):
    """服务器表"""

    __tablename__ = "servers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="服务器名称")
    purpose: Mapped[str | None] = mapped_column(String(500), nullable=True, comment="用途")
    location: Mapped[str | None] = mapped_column(String(200), nullable=True, comment="物理位置")
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True, comment="IP 地址")
    description: Mapped[str | None] = mapped_column(Text(), nullable=True, comment="描述")
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True, comment="备注")
    status: Mapped[str] = mapped_column(
        String(20), server_default="active", comment="状态: active/maintenance/offline"
    )
    server_type: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="类型: SINGLE/MULTI"
    )
    deploy_status: Mapped[str] = mapped_column(
        String(20), server_default="NORMAL", comment="部署状态: NORMAL/PENDING_REDEPLOY/REDEPLOYING"
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user.id"), nullable=False
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
    owner: Mapped[User] = relationship("User", lazy="selectin")
    systems: Mapped[list["System"]] = relationship(
        "System", back_populates="server", cascade="all, delete-orphan"
    )
