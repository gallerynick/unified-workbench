"""笔记/知识库模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.visibility import Visibility

if TYPE_CHECKING:
    from app.models.note_folder import NoteFolder
    from app.models.user import User


class Note(Base):
    """笔记/知识库表"""

    __tablename__ = "note"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=True)
    # Tiptap 文档树；旧版纯文本编辑器写 content，新版富文本写 body
    body: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # 由 body 提取的纯文本，供全文搜索与摘要使用
    plain_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    is_pinned: Mapped[bool] = mapped_column(default=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"))
    visibility: Mapped[Visibility] = mapped_column(
        String(20), nullable=False, server_default="private"
    )
    restricted_users: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # restricted 可见性下按标签授权，与 restricted_users 互补
    restricted_tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    owner: Mapped[User] = relationship("User", lazy="selectin")
    # 所属文件夹：多对多，经 note_folder_membership 关联
    # （父子嵌套已废弃，笔记间的层级关系改由正文 wikilink / note_link 表达）
    folders: Mapped[list["NoteFolder"]] = relationship(
        "NoteFolder",
        secondary="note_folder_membership",
        viewonly=True,
        lazy="selectin",
    )
