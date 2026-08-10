"""项目模块通用权限校验"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.user import User, UserRole


async def get_project_or_404(db: AsyncSession, project_id: uuid.UUID) -> Project:
    """按 ID 获取项目，不存在则 404。"""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在"
        )
    return project


def is_project_member(project: Project, user: User) -> bool:
    """判断用户是否为项目成员：所有者、成员列表或管理员。"""
    if project.owner_id == user.id:
        return True
    if user.role == UserRole.ADMIN:
        return True
    member_ids = project.member_ids or []
    return str(user.id) in {str(m) for m in member_ids}


async def require_project_member(
    db: AsyncSession, project_id: uuid.UUID, user: User
) -> Project:
    """校验用户为项目成员（所有者或成员列表或管理员），否则 403。"""
    project = await get_project_or_404(db, project_id)
    if not is_project_member(project, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该项目"
        )
    return project


def require_project_section_permission(
    project: Project,
    user: User,
    section: str,
    member_permissions: dict | None = None,
) -> None:
    """校验用户对项目某分区的写权限。

    - 所有者 / 管理员：始终放行
    - 其他成员：分区值 == 'readonly' 时拒绝（403「该分区为只读，无权操作」）
    - 分区值非 readonly 或未配置：放行（manage 默认）
    """
    if project.owner_id == user.id or user.role == UserRole.ADMIN:
        return
    perms = (
        member_permissions
        if member_permissions is not None
        else (project.member_permissions or {})
    )
    if perms.get(section) == "readonly":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="该分区为只读，无权操作"
        )
