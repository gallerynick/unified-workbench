"""项目提案 API 路由"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.project_proposal import (
    ProjectProposalCreate,
    ProjectProposalListResponse,
    ProjectProposalResponse,
    ProjectProposalUpdate,
)
from app.services.project_proposal import (
    create_project_proposal,
    delete_project_proposal,
    get_project_proposal,
    list_project_proposals,
    update_project_proposal,
)

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[ProjectProposalListResponse])
async def list_project_proposals_endpoint(
    project_id: uuid.UUID = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type: str | None = Query(None),
    priority: str | None = Query(None),
    status: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await list_project_proposals(
        db, project_id, current_user, page, page_size, type, priority, status
    )
    return UnifiedResponse(
        data=ProjectProposalListResponse(
            items=[ProjectProposalResponse.model_validate(i) for i in items],
            total=total,
        )
    )


@router.post("/", response_model=UnifiedResponse[ProjectProposalResponse])
async def create_project_proposal_endpoint(
    request: ProjectProposalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await create_project_proposal(
        db, request.project_id, current_user, request.model_dump()
    )
    return UnifiedResponse(data=ProjectProposalResponse.model_validate(item))


@router.get("/{proposal_id}", response_model=UnifiedResponse[ProjectProposalResponse])
async def get_project_proposal_endpoint(
    proposal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await get_project_proposal(db, proposal_id, current_user)
    return UnifiedResponse(data=ProjectProposalResponse.model_validate(item))


@router.put("/{proposal_id}", response_model=UnifiedResponse[ProjectProposalResponse])
async def update_project_proposal_endpoint(
    proposal_id: uuid.UUID,
    request: ProjectProposalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await update_project_proposal(
        db, proposal_id, current_user, request.model_dump(exclude_unset=True)
    )
    return UnifiedResponse(data=ProjectProposalResponse.model_validate(item))


@router.delete("/{proposal_id}", response_model=UnifiedResponse[None])
async def delete_project_proposal_endpoint(
    proposal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_project_proposal(db, proposal_id, current_user)
    return UnifiedResponse(msg="项目提案已删除")
