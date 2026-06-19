"""投票 API 路由"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.vote import VoteCreate, VoteListResponse, VoteResponse, VoteResult, VoteSubmit
from app.services.vote import create_vote, delete_vote, get_vote, get_vote_results, list_votes, submit_vote

router = APIRouter()


@router.get("", response_model=UnifiedResponse[VoteListResponse])
async def list_votes_endpoint(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    votes, total = await list_votes(db, current_user.id, page, page_size)
    return UnifiedResponse(data=VoteListResponse(items=[VoteResponse.model_validate(v) for v in votes], total=total))


@router.post("", response_model=UnifiedResponse[VoteResponse])
async def create_vote_endpoint(request: VoteCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    vote = await create_vote(db, current_user.id, request)
    return UnifiedResponse(data=VoteResponse.model_validate(vote))


@router.delete("/{vote_id}", response_model=UnifiedResponse[None])
async def delete_vote_endpoint(vote_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not await delete_vote(db, vote_id, current_user.id):
        raise HTTPException(status_code=404, detail="投票不存在")
    return UnifiedResponse(msg="投票已删除")


@router.post("/{vote_id}/submit", response_model=UnifiedResponse[None])
async def submit_vote_endpoint(vote_id: uuid.UUID, request: VoteSubmit, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not await submit_vote(db, vote_id, current_user.id, request):
        raise HTTPException(status_code=400, detail="投票失败（已投票或投票已关闭）")
    return UnifiedResponse(msg="投票成功")


@router.get("/{vote_id}/results", response_model=UnifiedResponse[list[VoteResult]])
async def get_vote_results_endpoint(vote_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    results = await get_vote_results(db, vote_id)
    return UnifiedResponse(data=[VoteResult(**r) for r in results])
