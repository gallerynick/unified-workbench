"""文件夹模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.file import File
    from app.models.user import User


class Folder(Base):
    """文件夹表"""

    __tablename__ = "folder"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("folder.id"), nullable=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"))
    visibility: Mapped[str] = mapped_column(
        String(20), default="private"
    )
    restricted_users: Mapped[list | None] = mapped_column(
        JSONB, nullable=True
    )
    restricted_tags: Mapped[list | None] = mapped_column(
        JSONB, nullable=True
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, comment="文件夹过期时间"
    )
    unified_management: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="是否统一管理子文件"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )

    # 关系
    owner: Mapped[User] = relationship("User")
    parent: Mapped[Folder | None] = relationship(
        "Folder", remote_side="Folder.id"
    )
    files: Mapped[list[File]] = relationship("File", back_populates="folder")
    children: Mapped[list[Folder]] = relationship("Folder", back_populates="parent")
