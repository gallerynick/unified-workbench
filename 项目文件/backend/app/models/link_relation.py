"""通用关联关系模型"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class LinkRelation(Base):
    """通用对象关联关系表"""

    __tablename__ = "link_relation"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, comment="源对象类型")
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, comment="源对象ID"
    )
    target_type: Mapped[str] = mapped_column(String(50), nullable=False, comment="目标对象类型")
    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, comment="目标对象ID"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
