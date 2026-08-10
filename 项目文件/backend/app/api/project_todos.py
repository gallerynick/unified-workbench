"""项目待办 API 路由"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.project_todo import (
    ProjectTodoCreate,
    ProjectTodoListResponse,
    ProjectTodoResponse,
    ProjectTodoUpdate,
)
from app.services.project_todo import (
    create_project_todo,
    delete_project_todo,
    get_project_todo,
    list_project_todos,
    update_project_todo,
)

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[ProjectTodoListResponse])
async def list_project_todos_endpoint(
    project_id: uuid.UUID = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    priority: str | None = Query(None),
    status: str | None = Query(None),
    assignee_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await list_project_todos(
        db, project_id, current_user, page, page_size, priority, status, assignee_id
    )
    return UnifiedResponse(
        data=ProjectTodoListResponse(
            items=[ProjectTodoResponse.model_validate(i) for i in items],
            total=total,
        )
    )


@router.post("/", response_model=UnifiedResponse[ProjectTodoResponse])
async def create_project_todo_endpoint(
    request: ProjectTodoCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await create_project_todo(
        db, request.project_id, current_user, request.model_dump()
    )
    return UnifiedResponse(data=ProjectTodoResponse.model_validate(item))


@router.get("/{todo_id}", response_model=UnifiedResponse[ProjectTodoResponse])
async def get_project_todo_endpoint(
    todo_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await get_project_todo(db, todo_id, current_user)
    return UnifiedResponse(data=ProjectTodoResponse.model_validate(item))


@router.put("/{todo_id}", response_model=UnifiedResponse[ProjectTodoResponse])
async def update_project_todo_endpoint(
    todo_id: uuid.UUID,
    request: ProjectTodoUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await update_project_todo(
        db, todo_id, current_user, request.model_dump(exclude_unset=True)
    )
    return UnifiedResponse(data=ProjectTodoResponse.model_validate(item))


@router.delete("/{todo_id}", response_model=UnifiedResponse[None])
async def delete_project_todo_endpoint(
    todo_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_project_todo(db, todo_id, current_user)
    return UnifiedResponse(msg="项目待办已删除")
