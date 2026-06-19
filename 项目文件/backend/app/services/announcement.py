"""公告服务"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.announcement import Announcement
from app.schemas.announcement import AnnouncementCreate, AnnouncementUpdate


async def list_announcements(db: AsyncSession, page: int = 1, page_size: int = 20) -> tuple[list[Announcement], int]:
    query = select(Announcement).where(Announcement.is_published == True)
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_announcement(db: AsyncSession, announcement_id: uuid.UUID) -> Announcement | None:
    result = await db.execute(select(Announcement).where(Announcement.id == announcement_id))
    return result.scalar_one_or_none()


async def create_announcement(db: AsyncSession, owner_id: uuid.UUID, request: AnnouncementCreate) -> Announcement:
    announcement = Announcement(title=request.title, content=request.content, is_pinned=request.is_pinned, is_published=request.is_published, owner_id=owner_id)
    db.add(announcement)
    await db.flush()
    await db.refresh(announcement)
    return announcement


async def update_announcement(db: AsyncSession, announcement_id: uuid.UUID, owner_id: uuid.UUID, request: AnnouncementUpdate) -> Announcement | None:
    result = await db.execute(select(Announcement).where(Announcement.id == announcement_id, Announcement.owner_id == owner_id))
    announcement = result.scalar_one_or_none()
    if not announcement:
        return None
    if request.title is not None:
        announcement.title = request.title
    if request.content is not None:
        announcement.content = request.content
    if request.is_pinned is not None:
        announcement.is_pinned = request.is_pinned
    if request.is_published is not None:
        announcement.is_published = request.is_published
    await db.flush()
    await db.refresh(announcement)
    return announcement


async def delete_announcement(db: AsyncSession, announcement_id: uuid.UUID, owner_id: uuid.UUID) -> bool:
    result = await db.execute(select(Announcement).where(Announcement.id == announcement_id, Announcement.owner_id == owner_id))
    announcement = result.scalar_one_or_none()
    if not announcement:
        return False
    await db.delete(announcement)
    await db.flush()
    return True
