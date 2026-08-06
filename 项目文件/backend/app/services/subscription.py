"""订阅业务逻辑"""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.visibility import Visibility
from app.models.subscription import BillingCycle, Subscription, SubscriptionStatus
from app.models.user import User, UserRole
from app.schemas.subscription import SubscriptionCreate, SubscriptionUpdate
from app.services.visibility import check_visibility as build_visibility_filter


# ── 辅助函数 ──────────────────────────────────────────────────────────


def _visibility_get_check(item: Subscription, user_id: uuid.UUID) -> bool:
    if item.owner_id == user_id:
        return True
    if item.visibility == Visibility.PUBLIC:
        return True
    if item.visibility == Visibility.RESTRICTED and item.restricted_users:
        if str(user_id) in item.restricted_users:
            return True
    return False


def _admin_can_manage_all_public(item: Subscription) -> bool:
    """Admin 管理规则（subscription）：只能管理 visibility==PUBLIC 的订阅。"""
    return item.visibility == Visibility.PUBLIC


# ── 列表 ──────────────────────────────────────────────────────────────


async def list_subscriptions(
    db: AsyncSession,
    owner_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Subscription], int]:
    user_id = owner_id
    visibility_cond = build_visibility_filter(Subscription, user_id)
    query = select(Subscription).where(visibility_cond)
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Subscription.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


# ── 获取 ──────────────────────────────────────────────────────────────


async def get_subscription(
    db: AsyncSession,
    subscription_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> Subscription | None:
    user_id = owner_id
    result = await db.execute(
        select(Subscription).where(Subscription.id == subscription_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        return None
    if not _visibility_get_check(item, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权访问"
        )
    return item


# ── 创建（不变）─────────────────────────────────────────────────────


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


# ── 更新 ──────────────────────────────────────────────────────────────


async def update_subscription(
    db: AsyncSession,
    subscription_id: uuid.UUID,
    owner_id: uuid.UUID,
    request: SubscriptionUpdate,
) -> Subscription | None:
    user_id = owner_id
    subscription = await get_subscription(db, subscription_id, user_id)
    if not subscription:
        return None

    # 权限检查：owner 或 admin（仅 ALL public）
    if subscription.owner_id != user_id:
        _role_result = await db.execute(
            select(User.role).where(User.id == user_id)
        )
        _user_role = _role_result.scalar_one_or_none()
        _is_admin = _user_role == UserRole.ADMIN
        if not (_is_admin and _admin_can_manage_all_public(subscription)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权修改"
            )

    if request.name is not None:
        subscription.name = request.name
    if request.provider is not None:
        subscription.provider = request.provider
    if request.amount is not None:
        subscription.amount = request.amount
    if request.billing_cycle is not None:
        subscription.billing_cycle = BillingCycle(request.billing_cycle)
    if request.next_billing is not None:
        subscription.next_billing = (
            datetime.fromisoformat(request.next_billing)
            if request.next_billing
            else None
        )
    if request.status is not None:
        subscription.status = SubscriptionStatus(request.status)
    await db.flush()
    await db.refresh(subscription)
    return subscription


# ── 删除 ──────────────────────────────────────────────────────────────


async def delete_subscription(
    db: AsyncSession,
    subscription_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> bool:
    user_id = owner_id
    subscription = await get_subscription(db, subscription_id, user_id)
    if not subscription:
        return False

    # 权限检查：owner 或 admin（仅 ALL public）
    if subscription.owner_id != user_id:
        _role_result = await db.execute(
            select(User.role).where(User.id == user_id)
        )
        _user_role = _role_result.scalar_one_or_none()
        _is_admin = _user_role == UserRole.ADMIN
        if not (_is_admin and _admin_can_manage_all_public(subscription)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权删除"
            )

    await db.delete(subscription)
    await db.flush()
    return True
