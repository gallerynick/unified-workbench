"""WebAuthn 凭据模型（指纹/面容/安全钥匙）。"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class UserWebAuthnCredential(Base):
    """用户注册的 WebAuthn 凭据（指纹/面容/安全钥匙）。"""

    __tablename__ = "user_webauthn_credential"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user.id", ondelete="CASCADE"), nullable=False
    )
    # WebAuthn credential ID (base64url 编码)
    credential_id: Mapped[str] = mapped_column(
        String(512), nullable=False, unique=True, comment="WebAuthn credential ID (base64url)"
    )
    # 公钥 (base64url 编码)
    public_key: Mapped[str] = mapped_column(
        Text, nullable=False, comment="WebAuthn 公钥 (base64url)"
    )
    # 签名计数器（用于检测克隆设备）
    counter: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="签名计数器"
    )
    # 设备标签
    label: Mapped[str] = mapped_column(
        String(100), nullable=False, default="认证器", comment="设备名称"
    )
    # 认证器传输方式 (internal, usb, nfc, ble)
    transports: Mapped[str] = mapped_column(
        String(200), nullable=True, comment="认证器传输方式"
    )
    # 创建时间
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # 最后使用时间
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped["User"] = relationship(
        "User", foreign_keys=[user_id], lazy="selectin"
    )
