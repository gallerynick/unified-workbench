"""项目事件 API 路由"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.project_event import (
    ProjectEventCreate,
    ProjectEventListResponse,
    ProjectEventResponse,
    ProjectEventUpdate,
)
from app.services.project_event import (
    create_project_event,
    delete_project_event,
    get_project_event,
    list_project_events,
    update_project_event,
)

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[ProjectEventListResponse])
async def list_project_events_endpoint(
    project_id: uuid.UUID = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    event_type: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await list_project_events(
        db, project_id, current_user, page, page_size, event_type
    )
    return UnifiedResponse(
        data=ProjectEventListResponse(
            items=[ProjectEventResponse.model_validate(i) for i in items],
            total=total,
        )
    )


@router.post("/", response_model=UnifiedResponse[ProjectEventResponse])
async def create_project_event_endpoint(
    request: ProjectEventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await create_project_event(
        db, request.project_id, current_user, request.model_dump()
    )
    return UnifiedResponse(data=ProjectEventResponse.model_validate(item))


@router.get("/{event_id}", response_model=UnifiedResponse[ProjectEventResponse])
async def get_project_event_endpoint(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await get_project_event(db, event_id, current_user)
    return UnifiedResponse(data=ProjectEventResponse.model_validate(item))


@router.put("/{event_id}", response_model=UnifiedResponse[ProjectEventResponse])
async def update_project_event_endpoint(
    event_id: uuid.UUID,
    request: ProjectEventUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await update_project_event(
        db, event_id, current_user, request.model_dump(exclude_unset=True)
    )
    return UnifiedResponse(data=ProjectEventResponse.model_validate(item))


@router.delete("/{event_id}", response_model=UnifiedResponse[None])
async def delete_project_event_endpoint(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_project_event(db, event_id, current_user)
    return UnifiedResponse(msg="项目事件已删除")
