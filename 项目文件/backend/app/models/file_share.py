"""文件分享模型 — 临时文件共享"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class FileShare(Base):
    """文件分享表 — 临时共享文件，支持密码保护和过期时间"""

    __tablename__ = "file_shares"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    original_name: Mapped[str] = mapped_column(String(255))  # 用户原始文件名
    stored_name: Mapped[str] = mapped_column(String(255))  # UUID 存储名，避免冲突
    file_path: Mapped[str] = mapped_column(String(512))  # 磁盘完整路径
    file_size: Mapped[int] = mapped_column(BigInteger)  # 字节
    mime_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    share_code: Mapped[str] = mapped_column(
        String(12), unique=True, index=True
    )  # 随机 8 位分享码
    password_hash: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )  # bcrypt 哈希，null = 无密码
    expires_at: Mapped[datetime] = mapped_column(DateTime)  # 过期时间
    max_downloads: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )  # null = 不限
    download_count: Mapped[int] = mapped_column(Integer, default=0)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user.id"), nullable=True
    )  # null = 管理员创建
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # 关系
    owner: Mapped[User | None] = relationship("User")
