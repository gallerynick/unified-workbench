"""用户模型"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.tag import Tag


class UserRole(enum.StrEnum):
    """用户角色枚举"""

    ADMIN = "admin"
    MEMBER = "member"


class UserStatus(enum.StrEnum):
    """用户状态枚举"""

    ACTIVE = "active"
    DISABLED = "disabled"


class User(Base):
    """用户表"""

    __tablename__ = "user"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    nickname: Mapped[str] = mapped_column(String(50))
    avatar: Mapped[str | None] = mapped_column(Text(), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, create_type=False), default=UserRole.MEMBER
    )
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, create_type=False), default=UserStatus.ACTIVE
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # 多对多关系：用户 <-> 标签
    tags: Mapped[list[Tag]] = relationship(
        secondary="user_tag", back_populates="users"
    )
