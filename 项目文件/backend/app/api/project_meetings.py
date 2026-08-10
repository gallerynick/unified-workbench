"""项目会议 API 路由"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.project_meeting import (
    ProjectMeetingCreate,
    ProjectMeetingListResponse,
    ProjectMeetingResponse,
    ProjectMeetingUpdate,
)
from app.services.project_meeting import (
    create_project_meeting,
    delete_project_meeting,
    get_project_meeting,
    list_project_meetings,
    update_project_meeting,
)

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[ProjectMeetingListResponse])
async def list_project_meetings_endpoint(
    project_id: uuid.UUID = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await list_project_meetings(
        db, project_id, current_user, page, page_size, type
    )
    return UnifiedResponse(
        data=ProjectMeetingListResponse(
            items=[ProjectMeetingResponse.model_validate(i) for i in items],
            total=total,
        )
    )


@router.post("/", response_model=UnifiedResponse[ProjectMeetingResponse])
async def create_project_meeting_endpoint(
    request: ProjectMeetingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await create_project_meeting(
        db, request.project_id, current_user, request.model_dump()
    )
    return UnifiedResponse(data=ProjectMeetingResponse.model_validate(item))


@router.get("/{meeting_id}", response_model=UnifiedResponse[ProjectMeetingResponse])
async def get_project_meeting_endpoint(
    meeting_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await get_project_meeting(db, meeting_id, current_user)
    return UnifiedResponse(data=ProjectMeetingResponse.model_validate(item))


@router.put("/{meeting_id}", response_model=UnifiedResponse[ProjectMeetingResponse])
async def update_project_meeting_endpoint(
    meeting_id: uuid.UUID,
    request: ProjectMeetingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await update_project_meeting(
        db, meeting_id, current_user, request.model_dump(exclude_unset=True)
    )
    return UnifiedResponse(data=ProjectMeetingResponse.model_validate(item))


@router.delete("/{meeting_id}", response_model=UnifiedResponse[None])
async def delete_project_meeting_endpoint(
    meeting_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_project_meeting(db, meeting_id, current_user)
    return UnifiedResponse(msg="项目会议已删除")
