"""项目成员业务逻辑"""

from __future__ import annotations

import uuid

from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project_member import ProjectMember
from app.models.user import User
from app.services.project_common import (
    get_project_or_404,
    require_project_member,
    require_project_section_permission,
)


async def list_project_members(
    db: AsyncSession,
    project_id: uuid.UUID,
    current_user: User,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[ProjectMember], int]:
    """列出项目成员，仅项目成员可查看。"""
    await require_project_member(db, project_id, current_user)
    query = select(ProjectMember).where(ProjectMember.project_id == project_id)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(ProjectMember.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_project_member(
    db: AsyncSession,
    member_id: uuid.UUID,
    current_user: User,
) -> ProjectMember:
    """获取单个项目成员，不存在或无权访问则 404/403。"""
    result = await db.execute(
        select(ProjectMember).where(ProjectMember.id == member_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="项目成员不存在"
        )
    await require_project_member(db, item.project_id, current_user)
    return item


async def create_project_member(
    db: AsyncSession,
    project_id: uuid.UUID,
    current_user: User,
    data: dict,
) -> ProjectMember:
    """添加项目成员，仅项目成员可添加，members 分区只读时禁止。"""
    project = await require_project_member(db, project_id, current_user)
    require_project_section_permission(project, current_user, "members")
    existing = (
        await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == data["user_id"],
            )
        )
    ).scalar_one_or_none()

    if existing is not None:
        if existing.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="该用户已是项目成员"
            )
        # 历史成员 → 重新激活
        existing.is_active = True
        existing.left_at = None
        if data.get("role_title") is not None:
            existing.role_title = data["role_title"]
        if data.get("notes") is not None:
            existing.notes = data["notes"]
        existing.joined_at = data.get("joined_at", existing.joined_at)  # 保留原加入时间
        await db.flush()
        await db.refresh(existing)
        return existing

    item = ProjectMember(
        project_id=project_id,
        user_id=data["user_id"],
        role_title=data.get("role_title"),
        notes=data.get("notes"),
        is_owner=data.get("is_owner", False),
        is_active=data.get("is_active", True),
        joined_at=data.get("joined_at") or datetime.now(),
        left_at=data.get("left_at"),
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def update_project_member(
    db: AsyncSession,
    member_id: uuid.UUID,
    current_user: User,
    data: dict,
) -> ProjectMember:
    """更新项目成员，仅项目成员可更新，members 分区只读时禁止。"""
    item = await get_project_member(db, member_id, current_user)
    project = await get_project_or_404(db, item.project_id)
    require_project_section_permission(project, current_user, "members")
    for field in ("role_title", "notes", "is_owner", "is_active", "joined_at", "left_at"):
        if field in data and data[field] is not None:
            setattr(item, field, data[field])
    await db.flush()
    await db.refresh(item)
    return item


async def delete_project_member(
    db: AsyncSession,
    member_id: uuid.UUID,
    current_user: User,
) -> None:
    """移除项目成员，仅项目成员可移除，members 分区只读时禁止。"""
    item = await get_project_member(db, member_id, current_user)
    project = await get_project_or_404(db, item.project_id)
    require_project_section_permission(project, current_user, "members")
    await db.delete(item)
    await db.flush()
