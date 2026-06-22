"""笔记/知识库模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class Note(Base):
    """笔记/知识库表"""

    __tablename__ = "note"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    is_pinned: Mapped[bool] = mapped_column(default=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("note.id", ondelete="SET NULL", use_alter=True, name="fk_note_parent"),
        nullable=True,
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    owner: Mapped[User] = relationship("User", lazy="selectin")
    children: Mapped[list["Note"]] = relationship(
        "Note", foreign_keys=[parent_id], back_populates="parent"
    )
    parent: Mapped["Note | None"] = relationship(
        "Note", foreign_keys=[parent_id], back_populates="children", remote_side="Note.id"
    )
