"""项目变更业务逻辑"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project_change import ProjectChange
from app.models.user import User
from app.services.project_common import (
    get_project_or_404,
    require_project_member,
    require_project_section_permission,
)


async def list_project_changes(
    db: AsyncSession,
    project_id: uuid.UUID,
    current_user: User,
    page: int = 1,
    page_size: int = 20,
    category_major: str | None = None,
    status: str | None = None,
) -> tuple[list[ProjectChange], int]:
    """列出项目变更，按 category_major/status 筛选，仅项目成员可见。"""
    await require_project_member(db, project_id, current_user)
    query = select(ProjectChange).where(ProjectChange.project_id == project_id)

    if category_major:
        query = query.where(ProjectChange.category_major == category_major)
    if status:
        query = query.where(ProjectChange.status == status)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(ProjectChange.date.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_project_change(
    db: AsyncSession,
    change_id: uuid.UUID,
    current_user: User,
) -> ProjectChange:
    """获取单个项目变更，不存在或无权访问则 404/403。"""
    result = await db.execute(
        select(ProjectChange).where(ProjectChange.id == change_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="项目变更不存在"
        )
    await require_project_member(db, item.project_id, current_user)
    return item


async def create_project_change(
    db: AsyncSession,
    project_id: uuid.UUID,
    current_user: User,
    data: dict,
) -> ProjectChange:
    """创建项目变更，仅项目成员可创建，changes 分区只读时禁止。"""
    project = await require_project_member(db, project_id, current_user)
    require_project_section_permission(project, current_user, "changes")
    item = ProjectChange(
        project_id=project_id,
        number=data["number"],
        title=data["title"],
        date=data["date"],
        category_major=data["category_major"],
        category_minor=data.get("category_minor"),
        category_detail=data.get("category_detail"),
        content=data.get("content"),
        status=data.get("status", "pending"),
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def update_project_change(
    db: AsyncSession,
    change_id: uuid.UUID,
    current_user: User,
    data: dict,
) -> ProjectChange:
    """更新项目变更，仅项目成员可更新，changes 分区只读时禁止。"""
    item = await get_project_change(db, change_id, current_user)
    project = await get_project_or_404(db, item.project_id)
    require_project_section_permission(project, current_user, "changes")
    for field in (
        "number",
        "title",
        "date",
        "category_major",
        "category_minor",
        "category_detail",
        "content",
        "status",
    ):
        if field in data and data[field] is not None:
            setattr(item, field, data[field])
    await db.flush()
    await db.refresh(item)
    return item


async def delete_project_change(
    db: AsyncSession,
    change_id: uuid.UUID,
    current_user: User,
) -> None:
    """删除项目变更，仅项目成员可删除，changes 分区只读时禁止。"""
    item = await get_project_change(db, change_id, current_user)
    project = await get_project_or_404(db, item.project_id)
    require_project_section_permission(project, current_user, "changes")
    await db.delete(item)
    await db.flush()
