"""项目变更 API 路由"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.project_change import (
    ProjectChangeCreate,
    ProjectChangeListResponse,
    ProjectChangeResponse,
    ProjectChangeUpdate,
)
from app.services.project_change import (
    create_project_change,
    delete_project_change,
    get_project_change,
    list_project_changes,
    update_project_change,
)

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[ProjectChangeListResponse])
async def list_project_changes_endpoint(
    project_id: uuid.UUID = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category_major: str | None = Query(None),
    status: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await list_project_changes(
        db, project_id, current_user, page, page_size, category_major, status
    )
    return UnifiedResponse(
        data=ProjectChangeListResponse(
            items=[ProjectChangeResponse.model_validate(i) for i in items],
            total=total,
        )
    )


@router.post("/", response_model=UnifiedResponse[ProjectChangeResponse])
async def create_project_change_endpoint(
    request: ProjectChangeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await create_project_change(
        db, request.project_id, current_user, request.model_dump()
    )
    return UnifiedResponse(data=ProjectChangeResponse.model_validate(item))


@router.get("/{change_id}", response_model=UnifiedResponse[ProjectChangeResponse])
async def get_project_change_endpoint(
    change_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await get_project_change(db, change_id, current_user)
    return UnifiedResponse(data=ProjectChangeResponse.model_validate(item))


@router.put("/{change_id}", response_model=UnifiedResponse[ProjectChangeResponse])
async def update_project_change_endpoint(
    change_id: uuid.UUID,
    request: ProjectChangeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await update_project_change(
        db, change_id, current_user, request.model_dump(exclude_unset=True)
    )
    return UnifiedResponse(data=ProjectChangeResponse.model_validate(item))


@router.delete("/{change_id}", response_model=UnifiedResponse[None])
async def delete_project_change_endpoint(
    change_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_project_change(db, change_id, current_user)
    return UnifiedResponse(msg="项目变更已删除")
