"""日历事件服务"""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.visibility import Visibility
from app.models.calendar_event import CalendarEvent, EventRepeat
from app.models.user import User, UserRole
from app.schemas.calendar_event import CalendarEventCreate, CalendarEventUpdate
from app.services.visibility import check_visibility as build_visibility_filter


# ── 日期解析 ──────────────────────────────────────────────────────────


def _parse_datetime(s: str) -> datetime:
    """解析 ISO 格式日期字符串，兼容 'Z' 后缀。返回 naive datetime。"""
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)
    return dt


# ── 辅助函数 ──────────────────────────────────────────────────────────


def _visibility_get_check(item: CalendarEvent, user_id: uuid.UUID) -> bool:
    if item.owner_id == user_id:
        return True
    if item.visibility == Visibility.PUBLIC:
        return True
    if item.visibility == Visibility.RESTRICTED and item.restricted_users:
        if str(user_id) in item.restricted_users:
            return True
    return False


def _admin_can_manage_own_designated(
    item: CalendarEvent, user_id: uuid.UUID
) -> bool:
    if item.owner_id == user_id:
        return True
    if item.visibility == Visibility.PUBLIC:
        return True
    if item.restricted_users and str(user_id) in item.restricted_users:
        return True
    return False


# ── 列表 ──────────────────────────────────────────────────────────────


async def list_events(
    db: AsyncSession,
    owner_id: uuid.UUID,
    page: int = 1,
    page_size: int = 50,
    start_date: str | None = None,
    end_date: str | None = None,
) -> tuple[list[CalendarEvent], int]:
    user_id = owner_id
    visibility_cond = build_visibility_filter(CalendarEvent, user_id)
    query = select(CalendarEvent).where(visibility_cond)

    if start_date:
        query = query.where(
            CalendarEvent.start_time >= _parse_datetime(start_date)
        )
    if end_date:
        query = query.where(
            CalendarEvent.start_time <= _parse_datetime(end_date)
        )
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(CalendarEvent.start_time.asc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


# ── 获取 ──────────────────────────────────────────────────────────────


async def get_event(
    db: AsyncSession, event_id: uuid.UUID, owner_id: uuid.UUID
) -> CalendarEvent | None:
    user_id = owner_id
    result = await db.execute(
        select(CalendarEvent).where(CalendarEvent.id == event_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        return None
    if not _visibility_get_check(item, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权访问"
        )
    return item


# ── 创建（不变）─────────────────────────────────────────────────────


async def create_event(
    db: AsyncSession, owner_id: uuid.UUID, request: CalendarEventCreate
) -> CalendarEvent:
    event = CalendarEvent(
        title=request.title,
        description=request.description,
        start_time=_parse_datetime(request.start_time),
        end_time=(
            _parse_datetime(request.end_time) if request.end_time else None
        ),
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


# ── 更新 ──────────────────────────────────────────────────────────────


async def update_event(
    db: AsyncSession,
    event_id: uuid.UUID,
    owner_id: uuid.UUID,
    request: CalendarEventUpdate,
) -> CalendarEvent | None:
    user_id = owner_id
    event = await get_event(db, event_id, user_id)
    if not event:
        return None

    # 权限检查：owner 或 admin（own+designated）
    if event.owner_id != user_id:
        _role_result = await db.execute(
            select(User.role).where(User.id == user_id)
        )
        _user_role = _role_result.scalar_one_or_none()
        _is_admin = _user_role == UserRole.ADMIN
        if not (
            _is_admin and _admin_can_manage_own_designated(event, user_id)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权修改"
            )

    if request.title is not None:
        event.title = request.title
    if request.description is not None:
        event.description = request.description
    if request.start_time is not None:
        event.start_time = _parse_datetime(request.start_time)
    if request.end_time is not None:
        event.end_time = (
            _parse_datetime(request.end_time)
            if request.end_time
            else None  # type: ignore[assignment]
        )
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


# ── 删除 ──────────────────────────────────────────────────────────────


async def delete_event(
    db: AsyncSession, event_id: uuid.UUID, owner_id: uuid.UUID
) -> bool:
    user_id = owner_id
    event = await get_event(db, event_id, user_id)
    if not event:
        return False

    # 权限检查：owner 或 admin（own+designated）
    if event.owner_id != user_id:
        _role_result = await db.execute(
            select(User.role).where(User.id == user_id)
        )
        _user_role = _role_result.scalar_one_or_none()
        _is_admin = _user_role == UserRole.ADMIN
        if not (
            _is_admin and _admin_can_manage_own_designated(event, user_id)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权删除"
            )

    await db.delete(event)
    await db.flush()
    return True
