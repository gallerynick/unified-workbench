"""系统配置模型"""

from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SystemConfig(Base):
    """系统配置表"""

    __tablename__ = "system_config"

    key: Mapped[str] = mapped_column(String(100), primary_key=True, comment="配置键")
    value: Mapped[dict] = mapped_column(JSONB, nullable=False, comment="配置值")
