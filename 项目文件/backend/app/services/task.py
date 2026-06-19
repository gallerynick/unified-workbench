"""任务服务"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task, TaskPriority, TaskStatus
from app.schemas.task import TaskCreate, TaskUpdate


async def list_tasks(
    db: AsyncSession,
    owner_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
    priority: str | None = None,
) -> tuple[list[Task], int]:
    query = select(Task).where(Task.owner_id == owner_id)
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


async def get_task(db: AsyncSession, task_id: uuid.UUID, owner_id: uuid.UUID) -> Task | None:
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.owner_id == owner_id)
    )
    return result.scalar_one_or_none()


async def create_task(db: AsyncSession, owner_id: uuid.UUID, request: TaskCreate) -> Task:
    task = Task(
        title=request.title,
        description=request.description,
        status=TaskStatus(request.status),
        priority=TaskPriority(request.priority),
        due_date=datetime.fromisoformat(request.due_date) if request.due_date else None,
        assigned_to=request.assigned_to,
        owner_id=owner_id,
        tags=request.tags,
    )
    db.add(task)
    await db.flush()
    await db.refresh(task)
    return task


async def update_task(db: AsyncSession, task_id: uuid.UUID, owner_id: uuid.UUID, request: TaskUpdate) -> Task | None:
    task = await get_task(db, task_id, owner_id)
    if not task:
        return None
    if request.title is not None:
        task.title = request.title
    if request.description is not None:
        task.description = request.description
    if request.status is not None:
        task.status = TaskStatus(request.status)
    if request.priority is not None:
        task.priority = TaskPriority(request.priority)
    if request.due_date is not None:
        task.due_date = datetime.fromisoformat(request.due_date) if request.due_date else None
    if request.assigned_to is not None:
        task.assigned_to = request.assigned_to
    if request.tags is not None:
        task.tags = request.tags
    await db.flush()
    await db.refresh(task)
    return task


async def delete_task(db: AsyncSession, task_id: uuid.UUID, owner_id: uuid.UUID) -> bool:
    task = await get_task(db, task_id, owner_id)
    if not task:
        return False
    await db.delete(task)
    await db.flush()
    return True
