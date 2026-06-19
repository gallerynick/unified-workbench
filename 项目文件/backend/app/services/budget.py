"""预算业务逻辑"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import Budget, BudgetPeriod, BudgetStatus
from app.schemas.budget import BudgetCreate, BudgetUpdate


async def list_budgets(
    db: AsyncSession,
    owner_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Budget], int]:
    query = select(Budget).where(Budget.owner_id == owner_id)
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Budget.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_budget(
    db: AsyncSession,
    budget_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> Budget | None:
    result = await db.execute(
        select(Budget).where(Budget.id == budget_id, Budget.owner_id == owner_id)
    )
    return result.scalar_one_or_none()


async def create_budget(
    db: AsyncSession,
    owner_id: uuid.UUID,
    request: BudgetCreate,
) -> Budget:
    budget = Budget(
        name=request.name,
        category=request.category,
        amount=request.amount,
        period=BudgetPeriod(request.period),
        owner_id=owner_id,
    )
    db.add(budget)
    await db.flush()
    await db.refresh(budget)
    return budget


async def update_budget(
    db: AsyncSession,
    budget_id: uuid.UUID,
    owner_id: uuid.UUID,
    request: BudgetUpdate,
) -> Budget | None:
    budget = await get_budget(db, budget_id, owner_id)
    if not budget:
        return None
    if request.name is not None:
        budget.name = request.name
    if request.category is not None:
        budget.category = request.category
    if request.amount is not None:
        budget.amount = request.amount
    if request.spent is not None:
        budget.spent = request.spent
    if request.period is not None:
        budget.period = BudgetPeriod(request.period)
    if request.status is not None:
        budget.status = BudgetStatus(request.status)
    await db.flush()
    await db.refresh(budget)
    return budget


async def delete_budget(
    db: AsyncSession,
    budget_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> bool:
    budget = await get_budget(db, budget_id, owner_id)
    if not budget:
        return False
    await db.delete(budget)
    await db.flush()
    return True
