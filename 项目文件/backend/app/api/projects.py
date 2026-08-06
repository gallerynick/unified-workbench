"""项目管理 API 路由"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.project import (
    ProjectCreate,
    ProjectListResponse,
    ProjectResponse,
    ProjectUpdate,
)
from app.services.project import (
    create_project,
    delete_project,
    get_project,
    list_projects,
    update_project,
)

router = APIRouter()


@router.post("/", response_model=UnifiedResponse[ProjectResponse])
async def create_project_endpoint(
    request: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    proj = await create_project(db, request.model_dump(), current_user.id)
    return UnifiedResponse(data=ProjectResponse.model_validate(proj))


@router.get("/", response_model=UnifiedResponse[ProjectListResponse])
async def list_projects_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    search: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    projects, total = await list_projects(db, current_user, page, page_size, status, search)
    items = [ProjectResponse.model_validate(p) for p in projects]
    return UnifiedResponse(data=ProjectListResponse(items=items, total=total))


@router.get("/{project_id}", response_model=UnifiedResponse[ProjectResponse])
async def get_project_endpoint(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    proj = await get_project(db, project_id, current_user)
    return UnifiedResponse(data=ProjectResponse.model_validate(proj))


@router.put("/{project_id}", response_model=UnifiedResponse[ProjectResponse])
async def update_project_endpoint(
    project_id: uuid.UUID,
    request: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    proj = await update_project(
        db, project_id, request.model_dump(exclude_unset=True), current_user
    )
    return UnifiedResponse(data=ProjectResponse.model_validate(proj))


@router.delete("/{project_id}", response_model=UnifiedResponse[None])
async def delete_project_endpoint(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_project(db, project_id, current_user)
    return UnifiedResponse(msg="项目删除成功")
