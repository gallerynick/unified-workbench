"""笔记服务端草稿模型。"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.note import Note
    from app.models.user import User


class NoteDraft(Base):
    __tablename__ = "note_draft"
    # 同一用户对同一篇笔记只保留一份草稿；note_id 为 NULL 的「新笔记草稿」
    # 唯一性由迁移中的部分唯一索引 uq_note_draft_new 保证（NULL 在普通唯一约束
    # 下互不相等，无法用此处约束覆盖）。
    __table_args__ = (
        UniqueConstraint("owner_id", "note_id", name="uq_note_draft_owner_note"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"), nullable=False)
    # NULL = 尚未关联 note 的新笔记草稿
    note_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("note.id", ondelete="CASCADE"), nullable=True
    )
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    body: Mapped[dict] = mapped_column(JSONB, nullable=False)
    saved_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    owner: Mapped[User] = relationship("User")
    note: Mapped[Note | None] = relationship("Note")
