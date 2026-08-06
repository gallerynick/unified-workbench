"""任务服务"""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.visibility import Visibility
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User, UserRole
from app.schemas.task import TaskCreate, TaskUpdate
from app.services.visibility import check_visibility as build_visibility_filter


# ── 辅助函数 ──────────────────────────────────────────────────────────


def _visibility_get_check(item: Task, user_id: uuid.UUID) -> bool:
    if item.owner_id == user_id:
        return True
    if item.visibility == Visibility.PUBLIC:
        return True
    if item.visibility == Visibility.RESTRICTED and item.restricted_users:
        if str(user_id) in item.restricted_users:
            return True
    return False


# ── 列表 ──────────────────────────────────────────────────────────────


async def list_tasks(
    db: AsyncSession,
    owner_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
    priority: str | None = None,
) -> tuple[list[Task], int]:
    user_id = owner_id
    visibility_cond = build_visibility_filter(Task, user_id)
    query = select(Task).where(visibility_cond)

    if status:
        query = query.where(Task.status == TaskStatus(status))
    if priority:
        query = query.where(Task.priority == TaskPriority(priority))
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Task.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


# ── 获取 ──────────────────────────────────────────────────────────────


async def get_task(
    db: AsyncSession, task_id: uuid.UUID, owner_id: uuid.UUID
) -> Task | None:
    user_id = owner_id
    result = await db.execute(
        select(Task).where(Task.id == task_id)
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


async def create_task(
    db: AsyncSession, owner_id: uuid.UUID, request: TaskCreate
) -> Task:
    task = Task(
        title=request.title,
        description=request.description,
        status=TaskStatus(request.status),
        priority=TaskPriority(request.priority),
        due_date=(
            datetime.fromisoformat(request.due_date) if request.due_date else None
        ),
        assigned_to=request.assigned_to,
        owner_id=owner_id,
        tags=request.tags,
    )
    db.add(task)
    await db.flush()
    await db.refresh(task)
    return task


# ── 更新 ──────────────────────────────────────────────────────────────


async def update_task(
    db: AsyncSession,
    task_id: uuid.UUID,
    owner_id: uuid.UUID,
    request: TaskUpdate,
) -> Task | None:
    """更新任务（仅 owner；admin 也无额外权限）"""
    user_id = owner_id
    task = await get_task(db, task_id, user_id)
    if not task:
        return None

    # 权限检查：仅 owner（admin 也只能管理自己的任务）
    if task.owner_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权修改"
        )

    if request.title is not None:
        task.title = request.title
    if request.description is not None:
        task.description = request.description
    if request.status is not None:
        task.status = TaskStatus(request.status)
    if request.priority is not None:
        task.priority = TaskPriority(request.priority)
    if request.due_date is not None:
        task.due_date = (
            datetime.fromisoformat(request.due_date) if request.due_date else None
        )
    if request.assigned_to is not None:
        task.assigned_to = request.assigned_to
    if request.tags is not None:
        task.tags = request.tags
    await db.flush()
    await db.refresh(task)
    return task


# ── 删除 ──────────────────────────────────────────────────────────────


async def delete_task(
    db: AsyncSession, task_id: uuid.UUID, owner_id: uuid.UUID
) -> bool:
    """删除任务（仅 owner；admin 也无额外权限）"""
    user_id = owner_id
    task = await get_task(db, task_id, user_id)
    if not task:
        return False

    if task.owner_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权删除"
        )

    await db.delete(task)
    await db.flush()
    return True
