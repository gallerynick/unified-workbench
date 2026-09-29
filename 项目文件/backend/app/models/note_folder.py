"""笔记文件夹模型（知识库分组容器）与笔记—文件夹多对多关联。

文件夹是独立实体：不写正文，只允许有简介。笔记通过
note_folder_membership 多对多关联到文件夹，一篇笔记可属于多个文件夹。

原 note.parent_id 的笔记父子嵌套已废弃并删除；笔记之间的层级关系
改为正文 wikilink（见 note_link 表）。
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.visibility import Visibility

if TYPE_CHECKING:
    from app.models.note import Note
    from app.models.user import User


class NoteFolder(Base):
    """笔记文件夹表"""

    __tablename__ = "note_folder"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # 文件夹不写正文，只有简介
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 显示顺序：服务端原样保存前端提交的排序值
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"), index=True)
    visibility: Mapped[Visibility] = mapped_column(
        String(20), nullable=False, server_default="private"
    )
    restricted_users: Mapped[list | None] = mapped_column(
        JSONB, nullable=True, server_default="[]"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped[User] = relationship("User", lazy="selectin")
    memberships: Mapped[list["NoteFolderMembership"]] = relationship(
        "NoteFolderMembership",
        back_populates="folder",
        cascade="all, delete-orphan",
    )


class NoteFolderMembership(Base):
    """笔记 ↔ 文件夹 多对多关联表。

    复合主键 (note_id, folder_id) 天然保证一篇笔记不会重复加入同一文件夹；
    两端外键 CASCADE，笔记或文件夹删除时关联自动清除。
    """

    __tablename__ = "note_folder_membership"

    note_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("note.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    folder_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("note_folder.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    note: Mapped["Note"] = relationship("Note", foreign_keys=[note_id])
    folder: Mapped["NoteFolder"] = relationship(
        "NoteFolder", back_populates="memberships"
    )
