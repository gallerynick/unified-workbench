"""文件模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.folder import Folder
    from app.models.user import User


class File(Base):
    """文件表"""

    __tablename__ = "file"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))  # 原始文件名
    stored_path: Mapped[str] = mapped_column(String(500))  # NAS 存储路径
    size: Mapped[int] = mapped_column(BigInteger)  # 文件大小（字节）
    sha256: Mapped[str] = mapped_column(String(64))  # SHA-256 哈希
    mime_type: Mapped[str] = mapped_column(String(100))  # MIME 类型
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("folder.id"), nullable=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"))
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
        DateTime, server_default=func.now()
    )

    # 关系
    owner: Mapped[User] = relationship("User")
    folder: Mapped[Folder | None] = relationship("Folder", back_populates="files")
