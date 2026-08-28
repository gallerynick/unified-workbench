"""用户模型"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.tag import Tag
    from app.models.user_notification_config import UserNotificationConfig
    from app.models.user_recovery_code import UserRecoveryCode
    from app.models.user_totp import UserTotp


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
    email: Mapped[str | None] = mapped_column(String(200), nullable=True, unique=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
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

    # 用户偏好设置（JSONB），例如 {"page_zoom": "100"}
    preferences: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True, default=dict
    )

    # 多对多关系：用户 <-> 标签
    tags: Mapped[list[Tag]] = relationship(
        secondary="user_tag", back_populates="users"
    )

    # 一对一关系：用户 <-> 通知配置
    notification_config: Mapped[UserNotificationConfig | None] = relationship(
        "UserNotificationConfig", back_populates="user", uselist=False
    )

    # 一对多关系：用户 <-> TOTP 认证器设备（多设备绑定）
    totp_devices: Mapped[list[UserTotp]] = relationship(
        "UserTotp", back_populates="user", cascade="all, delete-orphan"
    )

    # 一对多关系：用户 <-> 一次性恢复码
    recovery_codes: Mapped[list[UserRecoveryCode]] = relationship(
        "UserRecoveryCode", back_populates="user", cascade="all, delete-orphan"
    )
