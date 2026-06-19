"""笔记服务"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note import Note
from app.schemas.note import NoteCreate, NoteUpdate


async def list_notes(db: AsyncSession, owner_id: uuid.UUID, page: int = 1, page_size: int = 20, search: str | None = None, category: str | None = None) -> tuple[list[Note], int]:
    query = select(Note).where(Note.owner_id == owner_id)
    if search:
        query = query.where(Note.title.ilike(f"%{search}%") | Note.content.ilike(f"%{search}%"))
    if category:
        query = query.where(Note.category == category)
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Note.is_pinned.desc(), Note.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_note(db: AsyncSession, note_id: uuid.UUID, owner_id: uuid.UUID) -> Note | None:
    result = await db.execute(select(Note).where(Note.id == note_id, Note.owner_id == owner_id))
    return result.scalar_one_or_none()


async def create_note(db: AsyncSession, owner_id: uuid.UUID, request: NoteCreate) -> Note:
    note = Note(title=request.title, content=request.content, category=request.category, tags=request.tags, is_pinned=request.is_pinned, owner_id=owner_id)
    db.add(note)
    await db.flush()
    await db.refresh(note)
    return note


async def update_note(db: AsyncSession, note_id: uuid.UUID, owner_id: uuid.UUID, request: NoteUpdate) -> Note | None:
    note = await get_note(db, note_id, owner_id)
    if not note:
        return None
    if request.title is not None:
        note.title = request.title
    if request.content is not None:
        note.content = request.content
    if request.category is not None:
        note.category = request.category
    if request.tags is not None:
        note.tags = request.tags
    if request.is_pinned is not None:
        note.is_pinned = request.is_pinned
    await db.flush()
    await db.refresh(note)
    return note


async def delete_note(db: AsyncSession, note_id: uuid.UUID, owner_id: uuid.UUID) -> bool:
    note = await get_note(db, note_id, owner_id)
    if not note:
        return False
    await db.delete(note)
    await db.flush()
    return True
