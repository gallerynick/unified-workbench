"""任务 API 路由"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.task import TaskCreate, TaskListResponse, TaskResponse, TaskUpdate
from app.services.task import create_task, delete_task, get_task, list_tasks, update_task

router = APIRouter()


@router.get("", response_model=UnifiedResponse[TaskListResponse])
async def list_tasks_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    priority: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tasks, total = await list_tasks(db, current_user.id, page, page_size, status, priority)
    return UnifiedResponse(
        data=TaskListResponse(
            items=[TaskResponse.model_validate(t) for t in tasks],
            total=total,
        )
    )


@router.post("", response_model=UnifiedResponse[TaskResponse])
async def create_task_endpoint(
    request: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await create_task(db, current_user.id, request)
    return UnifiedResponse(data=TaskResponse.model_validate(task))


@router.get("/{task_id}", response_model=UnifiedResponse[TaskResponse])
async def get_task_endpoint(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await get_task(db, task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return UnifiedResponse(data=TaskResponse.model_validate(task))


@router.put("/{task_id}", response_model=UnifiedResponse[TaskResponse])
async def update_task_endpoint(
    task_id: uuid.UUID,
    request: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await update_task(db, task_id, current_user.id, request)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return UnifiedResponse(data=TaskResponse.model_validate(task))


@router.delete("/{task_id}", response_model=UnifiedResponse[None])
async def delete_task_endpoint(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    success = await delete_task(db, task_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="任务不存在")
    return UnifiedResponse(msg="任务已删除")
