"""项目会议业务逻辑"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project_meeting import ProjectMeeting
from app.models.user import User
from app.services.project_common import (
    get_project_or_404,
    require_project_member,
    require_project_section_permission,
)


async def list_project_meetings(
    db: AsyncSession,
    project_id: uuid.UUID,
    current_user: User,
    page: int = 1,
    page_size: int = 20,
    type: str | None = None,
) -> tuple[list[ProjectMeeting], int]:
    """列出项目会议，按 type 筛选，仅项目成员可见。"""
    await require_project_member(db, project_id, current_user)
    query = select(ProjectMeeting).where(ProjectMeeting.project_id == project_id)

    if type:
        query = query.where(ProjectMeeting.type == type)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(ProjectMeeting.started_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_project_meeting(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    current_user: User,
) -> ProjectMeeting:
    """获取单个项目会议，不存在或无权访问则 404/403。"""
    result = await db.execute(
        select(ProjectMeeting).where(ProjectMeeting.id == meeting_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="项目会议不存在"
        )
    await require_project_member(db, item.project_id, current_user)
    return item


async def create_project_meeting(
    db: AsyncSession,
    project_id: uuid.UUID,
    current_user: User,
    data: dict,
) -> ProjectMeeting:
    """创建项目会议，仅项目成员可创建，meetings 分区只读时禁止。"""
    project = await require_project_member(db, project_id, current_user)
    require_project_section_permission(project, current_user, "meetings")
    item = ProjectMeeting(
        project_id=project_id,
        number=data["number"],
        type=data["type"],
        started_at=data["started_at"],
        speaker=data.get("speaker"),
        participants=data.get("participants", []),
        content=data.get("content"),
        notes=data.get("notes", []),
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def update_project_meeting(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    current_user: User,
    data: dict,
) -> ProjectMeeting:
    """更新项目会议，仅项目成员可更新，meetings 分区只读时禁止。"""
    item = await get_project_meeting(db, meeting_id, current_user)
    project = await get_project_or_404(db, item.project_id)
    require_project_section_permission(project, current_user, "meetings")
    for field in (
        "number",
        "type",
        "started_at",
        "speaker",
        "participants",
        "content",
        "notes",
    ):
        if field in data and data[field] is not None:
            setattr(item, field, data[field])
    await db.flush()
    await db.refresh(item)
    return item


async def delete_project_meeting(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    current_user: User,
) -> None:
    """删除项目会议，仅项目成员可删除，meetings 分区只读时禁止。"""
    item = await get_project_meeting(db, meeting_id, current_user)
    project = await get_project_or_404(db, item.project_id)
    require_project_section_permission(project, current_user, "meetings")
    await db.delete(item)
    await db.flush()
