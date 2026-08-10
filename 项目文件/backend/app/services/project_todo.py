"""项目待办业务逻辑"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project_todo import ProjectTodo
from app.models.user import User
from app.services.project_common import (
    get_project_or_404,
    require_project_member,
    require_project_section_permission,
)


async def list_project_todos(
    db: AsyncSession,
    project_id: uuid.UUID,
    current_user: User,
    page: int = 1,
    page_size: int = 20,
    priority: str | None = None,
    status: str | None = None,
    assignee_id: uuid.UUID | None = None,
) -> tuple[list[ProjectTodo], int]:
    """列出项目待办，按 priority/status/assignee_id 筛选，仅项目成员可见。"""
    await require_project_member(db, project_id, current_user)
    query = select(ProjectTodo).where(ProjectTodo.project_id == project_id)

    if priority:
        query = query.where(ProjectTodo.priority == priority)
    if status:
        query = query.where(ProjectTodo.status == status)
    if assignee_id:
        query = query.where(ProjectTodo.assignee_id == assignee_id)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(ProjectTodo.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_project_todo(
    db: AsyncSession,
    todo_id: uuid.UUID,
    current_user: User,
) -> ProjectTodo:
    """获取单个项目待办，不存在或无权访问则 404/403。"""
    result = await db.execute(
        select(ProjectTodo).where(ProjectTodo.id == todo_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="项目待办不存在"
        )
    await require_project_member(db, item.project_id, current_user)
    return item


async def create_project_todo(
    db: AsyncSession,
    project_id: uuid.UUID,
    current_user: User,
    data: dict,
) -> ProjectTodo:
    """创建项目待办，仅项目成员可创建，创建者由后端填充，todos 分区只读时禁止。"""
    project = await require_project_member(db, project_id, current_user)
    require_project_section_permission(project, current_user, "todos")
    item = ProjectTodo(
        project_id=project_id,
        number=data["number"],
        title=data["title"],
        description=data.get("description"),
        priority=data.get("priority", "P2"),
        status=data.get("status", "pending"),
        assignee_id=data.get("assignee_id"),
        proposal_id=data.get("proposal_id"),
        due_date=data.get("due_date"),
        creator_id=current_user.id,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def update_project_todo(
    db: AsyncSession,
    todo_id: uuid.UUID,
    current_user: User,
    data: dict,
) -> ProjectTodo:
    """更新项目待办，仅项目成员可更新，todos 分区只读时禁止。"""
    item = await get_project_todo(db, todo_id, current_user)
    project = await get_project_or_404(db, item.project_id)
    require_project_section_permission(project, current_user, "todos")
    for field in (
        "number",
        "title",
        "description",
        "priority",
        "status",
        "assignee_id",
        "proposal_id",
        "due_date",
    ):
        if field in data and data[field] is not None:
            setattr(item, field, data[field])
    await db.flush()
    await db.refresh(item)
    return item


async def delete_project_todo(
    db: AsyncSession,
    todo_id: uuid.UUID,
    current_user: User,
) -> None:
    """删除项目待办，仅项目成员可删除，todos 分区只读时禁止。"""
    item = await get_project_todo(db, todo_id, current_user)
    project = await get_project_or_404(db, item.project_id)
    require_project_section_permission(project, current_user, "todos")
    await db.delete(item)
    await db.flush()
