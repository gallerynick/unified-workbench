"""笔记服务端草稿服务。

草稿归属本人：所有读写都以 owner_id 限定，不做可见性判定——草稿是
个人工作副本，与笔记的 public / private / restricted 无关。

唯一性：(owner_id, note_id) 有唯一约束；note_id 为 NULL 的「新笔记草稿」
由迁移中的部分唯一索引 uq_note_draft_new 保证每人一份。
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note_draft import NoteDraft


async def get_draft(
    db: AsyncSession, owner_id: uuid.UUID, note_id: uuid.UUID | None
) -> NoteDraft | None:
    """读取本人草稿。

    note_id 为空表示查询「尚未关联笔记的新笔记草稿」。
    """
    query = select(NoteDraft).where(NoteDraft.owner_id == owner_id)
    if note_id is not None:
        query = query.where(NoteDraft.note_id == note_id)
    else:
        query = query.where(NoteDraft.note_id.is_(None))
    query = query.order_by(NoteDraft.saved_at.desc())
    return (await db.execute(query.limit(1))).scalar_one_or_none()


async def upsert_draft(
    db: AsyncSession,
    owner_id: uuid.UUID,
    note_id: uuid.UUID | None,
    title: str | None,
    body: dict[str, Any],
) -> NoteDraft:
    """写入本人草稿：已存在则覆盖内容，不存在则新建。

    saved_at 由服务端生成（server_default / onupdate=func.now()），
    flush 后处于过期状态，直接同步读取会抛 MissingGreenlet，
    故显式 refresh 后再返回。
    """
    draft = await get_draft(db, owner_id, note_id)
    if draft:
        draft.title = title
        draft.body = body
    else:
        draft = NoteDraft(owner_id=owner_id, note_id=note_id, title=title, body=body)
        db.add(draft)
    await db.flush()
    await db.refresh(draft)
    return draft


async def delete_draft(
    db: AsyncSession, owner_id: uuid.UUID, note_id: uuid.UUID | None
) -> bool:
    """删除本人草稿，返回是否真的删除了一行。"""
    draft = await get_draft(db, owner_id, note_id)
    if not draft:
        return False
    await db.delete(draft)
    await db.flush()
    return True
