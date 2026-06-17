"""内容模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.content_file import ContentFile
    from app.models.user import User


class Content(Base):
    """内容表"""

    __tablename__ = "content"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[dict] = mapped_column(JSONB)  # Tiptap JSON 格式
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
    tags: Mapped[list | None] = mapped_column(
        JSONB, nullable=True
    )  # ["tag1", "tag2"]
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # 关系
    owner: Mapped[User] = relationship("User")
    files: Mapped[list[ContentFile]] = relationship(
        "ContentFile", back_populates="content"
    )
