"""笔记双链边模型（图谱与反向链接的唯一数据源）。"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.note import Note


class NoteLink(Base):
    __tablename__ = "note_link"
    __table_args__ = (
        UniqueConstraint("source_id", "target_id", name="uq_note_link_src_tgt"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("note.id", ondelete="CASCADE"), index=True, nullable=False
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("note.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    source: Mapped[Note] = relationship("Note", foreign_keys=[source_id])
    target: Mapped[Note] = relationship("Note", foreign_keys=[target_id])
