"""项目事件业务逻辑"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project_event import ProjectEvent
from app.models.user import User
from app.services.project_common import (
    get_project_or_404,
    require_project_member,
    require_project_section_permission,
)


async def list_project_events(
    db: AsyncSession,
    project_id: uuid.UUID,
    current_user: User,
    page: int = 1,
    page_size: int = 20,
    event_type: str | None = None,
) -> tuple[list[ProjectEvent], int]:
    """列出项目事件，按 event_type 筛选，仅项目成员可见。"""
    await require_project_member(db, project_id, current_user)
    query = select(ProjectEvent).where(ProjectEvent.project_id == project_id)

    if event_type:
        query = query.where(ProjectEvent.event_type == event_type)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(ProjectEvent.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_project_event(
    db: AsyncSession,
    event_id: uuid.UUID,
    current_user: User,
) -> ProjectEvent:
    """获取单个项目事件，不存在或无权访问则 404/403。"""
    result = await db.execute(
        select(ProjectEvent).where(ProjectEvent.id == event_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="项目事件不存在"
        )
    await require_project_member(db, item.project_id, current_user)
    return item


async def create_project_event(
    db: AsyncSession,
    project_id: uuid.UUID,
    current_user: User,
    data: dict,
) -> ProjectEvent:
    """创建项目事件，仅项目成员可创建，操作者由后端填充，events 分区只读时禁止。"""
    project = await require_project_member(db, project_id, current_user)
    require_project_section_permission(project, current_user, "events")
    item = ProjectEvent(
        project_id=project_id,
        number=data["number"],
        event_type=data["event_type"],
        title=data["title"],
        details=data.get("details", {}),
        operator_id=current_user.id,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def update_project_event(
    db: AsyncSession,
    event_id: uuid.UUID,
    current_user: User,
    data: dict,
) -> ProjectEvent:
    """更新项目事件，仅项目成员可更新，events 分区只读时禁止。"""
    item = await get_project_event(db, event_id, current_user)
    project = await get_project_or_404(db, item.project_id)
    require_project_section_permission(project, current_user, "events")
    for field in ("number", "event_type", "title", "details"):
        if field in data and data[field] is not None:
            setattr(item, field, data[field])
    await db.flush()
    await db.refresh(item)
    return item


async def delete_project_event(
    db: AsyncSession,
    event_id: uuid.UUID,
    current_user: User,
) -> None:
    """删除项目事件，仅项目成员可删除，events 分区只读时禁止。"""
    item = await get_project_event(db, event_id, current_user)
    project = await get_project_or_404(db, item.project_id)
    require_project_section_permission(project, current_user, "events")
    await db.delete(item)
    await db.flush()
