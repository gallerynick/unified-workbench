"""投票服务"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vote import Vote, VoteRecord, VoteStatus
from app.schemas.vote import VoteCreate, VoteSubmit


async def list_votes(db: AsyncSession, owner_id: uuid.UUID, page: int = 1, page_size: int = 20) -> tuple[list[Vote], int]:
    query = select(Vote).where(Vote.owner_id == owner_id)
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Vote.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_vote(db: AsyncSession, vote_id: uuid.UUID) -> Vote | None:
    result = await db.execute(select(Vote).where(Vote.id == vote_id))
    return result.scalar_one_or_none()


async def create_vote(db: AsyncSession, owner_id: uuid.UUID, request: VoteCreate) -> Vote:
    vote = Vote(
        title=request.title, description=request.description, options=request.options,
        allow_multiple=request.allow_multiple,
        deadline=datetime.fromisoformat(request.deadline) if request.deadline else None,
        owner_id=owner_id,
    )
    db.add(vote)
    await db.flush()
    await db.refresh(vote)
    return vote


async def delete_vote(db: AsyncSession, vote_id: uuid.UUID, owner_id: uuid.UUID) -> bool:
    vote = await db.execute(select(Vote).where(Vote.id == vote_id, Vote.owner_id == owner_id))
    v = vote.scalar_one_or_none()
    if not v:
        return False
    await db.delete(v)
    await db.flush()
    return True


async def submit_vote(db: AsyncSession, vote_id: uuid.UUID, user_id: uuid.UUID, request: VoteSubmit) -> bool:
    vote = await get_vote(db, vote_id)
    if not vote or vote.status != VoteStatus.ACTIVE:
        return False
    existing = await db.execute(select(VoteRecord).where(VoteRecord.vote_id == vote_id, VoteRecord.user_id == user_id))
    if existing.scalar_one_or_none():
        return False
    record = VoteRecord(vote_id=vote_id, user_id=user_id, selected_options=request.selected_options)
    db.add(record)
    await db.flush()
    return True


async def get_vote_results(db: AsyncSession, vote_id: uuid.UUID) -> list[dict]:
    vote = await get_vote(db, vote_id)
    if not vote:
        return []
    records = await db.execute(select(VoteRecord).where(VoteRecord.vote_id == vote_id))
    all_records = list(records.scalars().all())
    total = len(all_records)
    if total == 0:
        return [{"option": opt, "count": 0, "percentage": 0.0} for opt in vote.options]
    counts: dict[str, int] = {opt: 0 for opt in vote.options}
    for r in all_records:
        for opt in r.selected_options:
            if opt in counts:
                counts[opt] += 1
    return [{"option": opt, "count": cnt, "percentage": round(cnt / total * 100, 1)} for opt, cnt in counts.items()]
