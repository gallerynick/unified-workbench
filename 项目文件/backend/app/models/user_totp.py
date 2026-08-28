"""双因素认证 TOTP 设备模型。"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class UserTotp(Base):
    """用户绑定的 TOTP 认证器设备（多设备支持，一用户多行）。"""

    __tablename__ = "user_totp"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user.id", ondelete="CASCADE"), nullable=False
    )
    # AES-256-GCM 加密后的 TOTP 密钥（密文），永不存明文
    secret_encrypted: Mapped[str] = mapped_column(
        Text, nullable=False, comment="AES-256-GCM 加密的 TOTP 密钥"
    )
    label: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="设备/认证器名称"
    )
    is_active: Mapped[bool] = mapped_column(
        default=False, comment="是否已完成激活（激活前为待绑定状态）"
    )
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(
        "User", foreign_keys=[user_id], lazy="selectin"
    )
