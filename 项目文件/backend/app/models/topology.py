"""拓扑管理模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class Topology(Base):
    """网络/设备拓扑图表"""

    __tablename__ = "topology"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="拓扑名称")
    description: Mapped[str | None] = mapped_column(Text(), nullable=True, comment="描述")
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="", comment="用户自定义分类标签")
    # nodes: [{id, x, y, label, type, ip?, status?}]
    nodes: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, comment="节点列表")
    # edges: [{id, source, target, label?}]
    edges: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, comment="连线列表")
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user.id"), nullable=False
    )
    visibility: Mapped[str] = mapped_column(
        String(20), default="private"
    )  # public/private/restricted
    restricted_users: Mapped[list | None] = mapped_column(
        JSONB, nullable=True
    )  # [user_id, ...]
    restricted_tags: Mapped[list | None] = mapped_column(
        JSONB, nullable=True
    )  # ["tag_name", ...]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # 关系
    owner: Mapped[User] = relationship("User", lazy="selectin")