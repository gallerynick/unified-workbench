"""日历事件服务"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.calendar_event import CalendarEvent, EventRepeat
from app.schemas.calendar_event import CalendarEventCreate, CalendarEventUpdate


def _parse_datetime(s: str) -> datetime:
    """解析 ISO 格式日期字符串，兼容 'Z' 后缀。返回 naive datetime。"""
    if s.endswith('Z'):
        s = s[:-1] + '+00:00'
    dt = datetime.fromisoformat(s)
    # 数据库列是 TIMESTAMP WITHOUT TIME ZONE，需剥离时区信息
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)
    return dt


async def list_events(
    db: AsyncSession,
    owner_id: uuid.UUID,
    page: int = 1,
    page_size: int = 50,
    start_date: str | None = None,
    end_date: str | None = None,
) -> tuple[list[CalendarEvent], int]:
    query = select(CalendarEvent).where(CalendarEvent.owner_id == owner_id)
    if start_date:
        query = query.where(CalendarEvent.start_time >= _parse_datetime(start_date))
    if end_date:
        query = query.where(CalendarEvent.start_time <= _parse_datetime(end_date))
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(CalendarEvent.start_time.asc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_event(db: AsyncSession, event_id: uuid.UUID, owner_id: uuid.UUID) -> CalendarEvent | None:
    result = await db.execute(
        select(CalendarEvent).where(CalendarEvent.id == event_id, CalendarEvent.owner_id == owner_id)
    )
    return result.scalar_one_or_none()


async def create_event(db: AsyncSession, owner_id: uuid.UUID, request: CalendarEventCreate) -> CalendarEvent:
    event = CalendarEvent(
        title=request.title,
        description=request.description,
        start_time=_parse_datetime(request.start_time),
        end_time=_parse_datetime(request.end_time) if request.end_time else None,
        all_day=request.all_day,
        location=request.location,
        repeat=EventRepeat(request.repeat),
        color=request.color,
        owner_id=owner_id,
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event


async def update_event(db: AsyncSession, event_id: uuid.UUID, owner_id: uuid.UUID, request: CalendarEventUpdate) -> CalendarEvent | None:
    event = await get_event(db, event_id, owner_id)
    if not event:
        return None
    if request.title is not None:
        event.title = request.title
    if request.description is not None:
        event.description = request.description
    if request.start_time is not None:
        event.start_time = _parse_datetime(request.start_time)
    if request.end_time is not None:
        event.end_time = _parse_datetime(request.end_time) if request.end_time else None  # type: ignore[assignment]
    if request.all_day is not None:
        event.all_day = request.all_day
    if request.location is not None:
        event.location = request.location
    if request.repeat is not None:
        event.repeat = EventRepeat(request.repeat)
    if request.color is not None:
        event.color = request.color
    await db.flush()
    await db.refresh(event)
    return event


async def delete_event(db: AsyncSession, event_id: uuid.UUID, owner_id: uuid.UUID) -> bool:
    event = await get_event(db, event_id, owner_id)
    if not event:
        return False
    await db.delete(event)
    await db.flush()
    return True
