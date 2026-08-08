"""用户通知配置模型"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class UserNotificationConfig(Base):
    """用户通知配置表"""

    __tablename__ = "user_notification_config"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    enabled_channels: Mapped[list] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
        comment="启用的通知渠道，如 ['feishu', 'wecom']，websocket 始终隐式启用",
    )
    feishu_webhook_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    wecom_webhook_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    smtp_host: Mapped[str | None] = mapped_column(String(200), nullable=True)
    smtp_port: Mapped[int | None] = mapped_column(nullable=True)
    smtp_user: Mapped[str | None] = mapped_column(String(200), nullable=True)
    smtp_password: Mapped[str | None] = mapped_column(String(200), nullable=True)
    smtp_use_tls: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped[User] = relationship("User", back_populates="notification_config")
