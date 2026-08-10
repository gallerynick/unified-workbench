"""项目业务逻辑"""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import check_visibility
from app.core.visibility import Visibility
from app.models.project import Project
from app.models.user import User


async def create_project(
    db: AsyncSession,
    data: dict,
    owner_id: uuid.UUID,
) -> Project:
    """创建项目"""
    project = Project(
        project_id=data.get("project_id"),
        title=data["title"],
        description=data.get("description"),
        content=data.get("content", {}),
        status=data.get("status", "draft"),
        owner_id=owner_id,
        visibility=data.get("visibility", Visibility.PRIVATE),
        restricted_users=data.get("restricted_users"),
        restricted_tags=data.get("restricted_tags"),
        member_ids=data.get("member_ids"),
    )
    db.add(project)
    await db.flush()
    return project


async def list_projects(
    db: AsyncSession,
    current_user: User,
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
    search: str | None = None,
) -> tuple[list[Project], int]:
    """列出项目，支持按 status 筛选、搜索 title，并过滤可见性。"""
    query = select(Project)

    if status is not None:
        query = query.where(Project.status == status)
    if search:
        query = query.where(Project.title.ilike(f"%{search}%"))

    query = query.order_by(Project.created_at.desc())
    result = await db.execute(query)
    all_projects = list(result.scalars().all())

    # 按可见性过滤
    visible: list[Project] = []
    for proj in all_projects:
        if proj.owner_id == current_user.id:
            visible.append(proj)
        elif proj.visibility == Visibility.PUBLIC:
            visible.append(proj)
        elif proj.visibility == Visibility.RESTRICTED:
            r_users = set(proj.restricted_users) if proj.restricted_users else set()
            r_tags = set(proj.restricted_tags) if proj.restricted_tags else set()
            if check_visibility(current_user, proj.visibility, proj.owner_id, r_users, r_tags):
                visible.append(proj)

    total = len(visible)
    start = (page - 1) * page_size
    return visible[start : start + page_size], total


async def get_project(db: AsyncSession, project_id: uuid.UUID, current_user: User) -> Project:
    """获取单个项目，不存在或无权访问则 404。"""
    result = await db.execute(select(Project).where(Project.id == project_id))
    proj = result.scalar_one_or_none()
    if not proj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在"
        )
    # 可见性检查
    if proj.visibility == Visibility.PRIVATE and proj.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在"
        )
    if proj.visibility == Visibility.RESTRICTED:
        r_users = set(proj.restricted_users) if proj.restricted_users else set()
        r_tags = set(proj.restricted_tags) if proj.restricted_tags else set()
        if not check_visibility(current_user, proj.visibility, proj.owner_id, r_users, r_tags):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在"
            )
    return proj


async def update_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    data: dict,
    current_user: User,
) -> Project:
    """更新项目字段，仅所有者可修改。"""
    proj = await get_project(db, project_id, current_user)
    if proj.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="仅所有者可修改"
        )
    for field in ("project_id", "title", "description", "content", "status", "visibility"):
        if field in data and data[field] is not None:
            if field == "status" and data[field] != proj.status:
                log = list(proj.status_log) if proj.status_log else []
                log.append({
                    "from_status": proj.status,
                    "to_status": data[field],
                    "timestamp": datetime.now().isoformat(),
                })
                proj.status_log = log
            setattr(proj, field, data[field])
    if "restricted_users" in data:
        proj.restricted_users = data["restricted_users"]
    if "restricted_tags" in data:
        proj.restricted_tags = data["restricted_tags"]
    if "member_ids" in data:
        proj.member_ids = data["member_ids"]
    await db.flush()
    await db.refresh(proj)
    return proj


async def delete_project(db: AsyncSession, project_id: uuid.UUID, current_user: User) -> None:
    """删除项目，仅所有者可删除。"""
    proj = await get_project(db, project_id, current_user)
    if proj.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="仅所有者可删除"
        )
    await db.delete(proj)
    await db.flush()
