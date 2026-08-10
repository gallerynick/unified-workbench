"""项目成员 API 路由"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.project_member import (
    ProjectMemberCreate,
    ProjectMemberListResponse,
    ProjectMemberResponse,
    ProjectMemberUpdate,
)
from app.services.project_member import (
    create_project_member,
    delete_project_member,
    get_project_member,
    list_project_members,
    update_project_member,
)

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[ProjectMemberListResponse])
async def list_project_members_endpoint(
    project_id: uuid.UUID = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await list_project_members(
        db, project_id, current_user, page, page_size
    )
    return UnifiedResponse(
        data=ProjectMemberListResponse(
            items=[ProjectMemberResponse.model_validate(i) for i in items],
            total=total,
        )
    )


@router.post("/", response_model=UnifiedResponse[ProjectMemberResponse])
async def create_project_member_endpoint(
    request: ProjectMemberCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await create_project_member(
        db, request.project_id, current_user, request.model_dump()
    )
    return UnifiedResponse(data=ProjectMemberResponse.model_validate(item))


@router.get("/{member_id}", response_model=UnifiedResponse[ProjectMemberResponse])
async def get_project_member_endpoint(
    member_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await get_project_member(db, member_id, current_user)
    return UnifiedResponse(data=ProjectMemberResponse.model_validate(item))


@router.put("/{member_id}", response_model=UnifiedResponse[ProjectMemberResponse])
async def update_project_member_endpoint(
    member_id: uuid.UUID,
    request: ProjectMemberUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await update_project_member(
        db, member_id, current_user, request.model_dump(exclude_unset=True)
    )
    return UnifiedResponse(data=ProjectMemberResponse.model_validate(item))


@router.delete("/{member_id}", response_model=UnifiedResponse[None])
async def delete_project_member_endpoint(
    member_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_project_member(db, member_id, current_user)
    return UnifiedResponse(msg="项目成员已移除")
