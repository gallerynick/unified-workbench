"""项目提案评论 API 路由"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.project_proposal_comment import (
    ProjectProposalCommentCreate,
    ProjectProposalCommentListResponse,
    ProjectProposalCommentResponse,
)
from app.services.project_proposal_comment import (
    create_project_proposal_comment,
    delete_project_proposal_comment,
    list_project_proposal_comments,
)

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[ProjectProposalCommentListResponse])
async def list_project_proposal_comments_endpoint(
    proposal_id: uuid.UUID = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await list_project_proposal_comments(
        db, proposal_id, current_user, page, page_size
    )
    return UnifiedResponse(
        data=ProjectProposalCommentListResponse(
            items=[ProjectProposalCommentResponse.model_validate(i) for i in items],
            total=total,
        )
    )


@router.post("/", response_model=UnifiedResponse[ProjectProposalCommentResponse])
async def create_project_proposal_comment_endpoint(
    request: ProjectProposalCommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await create_project_proposal_comment(
        db, request.proposal_id, current_user, request.model_dump()
    )
    return UnifiedResponse(data=ProjectProposalCommentResponse.model_validate(item))


@router.delete("/{comment_id}", response_model=UnifiedResponse[None])
async def delete_project_proposal_comment_endpoint(
    comment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_project_proposal_comment(db, comment_id, current_user)
    return UnifiedResponse(msg="评论已删除")