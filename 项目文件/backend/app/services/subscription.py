"""订阅业务逻辑"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subscription import BillingCycle, Subscription, SubscriptionStatus
from app.schemas.subscription import SubscriptionCreate, SubscriptionUpdate


async def list_subscriptions(
    db: AsyncSession,
    owner_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Subscription], int]:
    query = select(Subscription).where(Subscription.owner_id == owner_id)
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Subscription.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_subscription(
    db: AsyncSession,
    subscription_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> Subscription | None:
    result = await db.execute(
        select(Subscription).where(
            Subscription.id == subscription_id,
            Subscription.owner_id == owner_id,
        )
    )
    return result.scalar_one_or_none()


async def create_subscription(
    db: AsyncSession,
    owner_id: uuid.UUID,
    request: SubscriptionCreate,
) -> Subscription:
    next_billing = None
    if request.next_billing:
        next_billing = datetime.fromisoformat(request.next_billing)

    subscription = Subscription(
        name=request.name,
        provider=request.provider,
        amount=request.amount,
        billing_cycle=BillingCycle(request.billing_cycle),
        next_billing=next_billing,
        owner_id=owner_id,
    )
    db.add(subscription)
    await db.flush()
    await db.refresh(subscription)
    return subscription


async def update_subscription(
    db: AsyncSession,
    subscription_id: uuid.UUID,
    owner_id: uuid.UUID,
    request: SubscriptionUpdate,
) -> Subscription | None:
    subscription = await get_subscription(db, subscription_id, owner_id)
    if not subscription:
        return None
    if request.name is not None:
        subscription.name = request.name
    if request.provider is not None:
        subscription.provider = request.provider
    if request.amount is not None:
        subscription.amount = request.amount
    if request.billing_cycle is not None:
        subscription.billing_cycle = BillingCycle(request.billing_cycle)
    if request.next_billing not in (None, ''):
        subscription.next_billing = datetime.fromisoformat(request.next_billing)
    if request.status is not None:
        subscription.status = SubscriptionStatus(request.status)
    await db.flush()
    await db.refresh(subscription)
    return subscription


async def delete_subscription(
    db: AsyncSession,
    subscription_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> bool:
    subscription = await get_subscription(db, subscription_id, owner_id)
    if not subscription:
        return False
    await db.delete(subscription)
    await db.flush()
    return True
