"""直播间模型"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class StreamRoomMode(enum.StrEnum):
    """推流模式枚举"""

    BUILTIN = "builtin"
    EXTERNAL = "external"


class StreamRoomType(enum.StrEnum):
    """房间类型枚举"""

    TEMPORARY = "temporary"
    PERMANENT = "permanent"


class StreamRoom(Base):
    """直播间"""

    __tablename__ = "stream_room"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="房间名称")
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user.id"), nullable=False, comment="创建者"
    )
    mode: Mapped[StreamRoomMode] = mapped_column(
        Enum(StreamRoomMode, create_type=False),
        default=StreamRoomMode.BUILTIN,
        nullable=False,
        comment="推流模式: builtin(内置WHIP) / external(外部RTMP)",
    )
    room_type: Mapped[StreamRoomType] = mapped_column(
        Enum(StreamRoomType, create_type=False),
        default=StreamRoomType.PERMANENT,
        nullable=False,
        comment="房间类型: temporary(临时) / permanent(常驻)",
    )
    config: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True, comment="per-room 配置(bitrate/resolution/fps/audio)"
    )
    is_open: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否开放访问"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="当前是否有人推流"
    )
    pusher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, comment="当前推流者 user_id"
    )
    last_active_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="最后活跃时间"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), comment="创建时间"
    )

    # 关系
    creator: Mapped[User] = relationship("User", lazy="selectin", foreign_keys=[creator_id])
    pusher: Mapped[User | None] = relationship(
        "User", lazy="selectin", foreign_keys=[pusher_id], primaryjoin="StreamRoom.pusher_id == User.id"
    )
