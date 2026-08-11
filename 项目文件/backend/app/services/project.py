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
from app.services.project_common import (
    is_project_member,
    require_project_section_permission,
)


async def create_project(
    db: AsyncSession,
    data: dict,
    owner_id: uuid.UUID,
) -> Project:
    """创建项目"""
    owner_user: User | None = None
    if data.get("owner_id") is not None:
        result = await db.execute(select(User).where(User.id == data["owner_id"]))
        owner_user = result.scalar_one_or_none()
        if owner_user is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="指定的项目负责人不存在",
            )
        owner_id = data["owner_id"]
    project = Project(
        number=data.get("number"),
        title=data["title"],
        description=data.get("description"),
        content=data.get("content", {}),
        status=data.get("status", "draft"),
        owner_id=owner_id,
        visibility=data.get("visibility", Visibility.PRIVATE),
        restricted_users=data.get("restricted_users"),
        restricted_tags=data.get("restricted_tags"),
        member_ids=data.get("member_ids"),
        member_permissions=data.get("member_permissions"),
    )
    db.add(project)
    await db.flush()
    if owner_user is not None:
        # 预加载 owner 关系，避免 async 下序列化 owner_name 时触发懒加载
        project.owner = owner_user
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
    """更新项目字段：所有者放行；其他成员需为项目成员且 info 分区非只读。"""
    proj = await get_project(db, project_id, current_user)
    if proj.owner_id != current_user.id:
        if not is_project_member(proj, current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该项目"
            )
        require_project_section_permission(proj, current_user, "info")
    for field in ("number", "title", "description", "content", "status", "visibility"):
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
    if "member_permissions" in data:
        proj.member_permissions = data["member_permissions"]
    await db.flush()
    await db.refresh(proj)
    return proj


async def delete_project(db: AsyncSession, project_id: uuid.UUID, current_user: User) -> None:
    """删除项目：所有者放行；其他成员需为项目成员且 info 分区非只读。"""
    proj = await get_project(db, project_id, current_user)
    if proj.owner_id != current_user.id:
        if not is_project_member(proj, current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该项目"
            )
        require_project_section_permission(proj, current_user, "info")
    await db.delete(proj)
    await db.flush()
