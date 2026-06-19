"""财务管理 API 路由"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetListResponse, BudgetResponse, BudgetUpdate
from app.schemas.common import UnifiedResponse
from app.schemas.subscription import (
    SubscriptionCreate,
    SubscriptionListResponse,
    SubscriptionResponse,
    SubscriptionUpdate,
)
from app.services.budget import (
    create_budget,
    delete_budget,
    get_budget,
    list_budgets,
    update_budget,
)
from app.services.subscription import (
    create_subscription,
    delete_subscription,
    get_subscription,
    list_subscriptions,
    update_subscription,
)

router = APIRouter()


@router.get("/budgets", response_model=UnifiedResponse[BudgetListResponse])
async def list_budgets_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    budgets, total = await list_budgets(db, current_user.id, page, page_size)
    return UnifiedResponse(
        data=BudgetListResponse(
            items=[BudgetResponse.model_validate(b) for b in budgets],
            total=total,
        )
    )


@router.post("/budgets", response_model=UnifiedResponse[BudgetResponse])
async def create_budget_endpoint(
    request: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    budget = await create_budget(db, current_user.id, request)
    return UnifiedResponse(data=BudgetResponse.model_validate(budget))


@router.put("/budgets/{budget_id}", response_model=UnifiedResponse[BudgetResponse])
async def update_budget_endpoint(
    budget_id: uuid.UUID,
    request: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    budget = await update_budget(db, budget_id, current_user.id, request)
    if not budget:
        raise HTTPException(status_code=404, detail="预算不存在")
    return UnifiedResponse(data=BudgetResponse.model_validate(budget))


@router.delete("/budgets/{budget_id}", response_model=UnifiedResponse[None])
async def delete_budget_endpoint(
    budget_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    success = await delete_budget(db, budget_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="预算不存在")
    return UnifiedResponse(msg="预算已删除")


@router.get("/subscriptions", response_model=UnifiedResponse[SubscriptionListResponse])
async def list_subscriptions_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    subscriptions, total = await list_subscriptions(db, current_user.id, page, page_size)
    return UnifiedResponse(
        data=SubscriptionListResponse(
            items=[SubscriptionResponse.model_validate(s) for s in subscriptions],
            total=total,
        )
    )


@router.post("/subscriptions", response_model=UnifiedResponse[SubscriptionResponse])
async def create_subscription_endpoint(
    request: SubscriptionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    subscription = await create_subscription(db, current_user.id, request)
    return UnifiedResponse(data=SubscriptionResponse.model_validate(subscription))


@router.put("/subscriptions/{subscription_id}", response_model=UnifiedResponse[SubscriptionResponse])
async def update_subscription_endpoint(
    subscription_id: uuid.UUID,
    request: SubscriptionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    subscription = await update_subscription(db, subscription_id, current_user.id, request)
    if not subscription:
        raise HTTPException(status_code=404, detail="订阅不存在")
    return UnifiedResponse(data=SubscriptionResponse.model_validate(subscription))


@router.delete("/subscriptions/{subscription_id}", response_model=UnifiedResponse[None])
async def delete_subscription_endpoint(
    subscription_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    success = await delete_subscription(db, subscription_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="订阅不存在")
    return UnifiedResponse(msg="订阅已删除")
