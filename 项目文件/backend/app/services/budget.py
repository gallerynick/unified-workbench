"""预算业务逻辑"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.visibility import Visibility
from app.models.budget import Budget, BudgetPeriod, BudgetStatus
from app.models.user import User, UserRole
from app.schemas.budget import BudgetCreate, BudgetUpdate
from app.services.visibility import check_visibility as build_visibility_filter


# ── 辅助函数 ──────────────────────────────────────────────────────────


def _visibility_get_check(item: Budget, user_id: uuid.UUID) -> bool:
    if item.owner_id == user_id:
        return True
    if item.visibility == Visibility.PUBLIC:
        return True
    if item.visibility == Visibility.RESTRICTED and item.restricted_users:
        if str(user_id) in item.restricted_users:
            return True
    return False


def _admin_can_manage_all_public(item: Budget) -> bool:
    """Admin 管理规则（budget）：只能管理 visibility==PUBLIC 的预算。"""
    return item.visibility == Visibility.PUBLIC


# ── 列表 ──────────────────────────────────────────────────────────────


async def list_budgets(
    db: AsyncSession,
    owner_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Budget], int]:
    user_id = owner_id
    visibility_cond = build_visibility_filter(Budget, user_id)
    query = select(Budget).where(visibility_cond)
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Budget.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


# ── 获取 ──────────────────────────────────────────────────────────────


async def get_budget(
    db: AsyncSession,
    budget_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> Budget | None:
    user_id = owner_id
    result = await db.execute(
        select(Budget).where(Budget.id == budget_id)
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


# ── 更新 ──────────────────────────────────────────────────────────────


async def update_budget(
    db: AsyncSession,
    budget_id: uuid.UUID,
    owner_id: uuid.UUID,
    request: BudgetUpdate,
) -> Budget | None:
    user_id = owner_id
    budget = await get_budget(db, budget_id, user_id)
    if not budget:
        return None

    # 权限检查：owner 或 admin（仅 ALL public）
    if budget.owner_id != user_id:
        _role_result = await db.execute(
            select(User.role).where(User.id == user_id)
        )
        _user_role = _role_result.scalar_one_or_none()
        _is_admin = _user_role == UserRole.ADMIN
        if not (_is_admin and _admin_can_manage_all_public(budget)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权修改"
            )

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


# ── 删除 ──────────────────────────────────────────────────────────────


async def delete_budget(
    db: AsyncSession,
    budget_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> bool:
    user_id = owner_id
    budget = await get_budget(db, budget_id, user_id)
    if not budget:
        return False

    # 权限检查：owner 或 admin（仅 ALL public）
    if budget.owner_id != user_id:
        _role_result = await db.execute(
            select(User.role).where(User.id == user_id)
        )
        _user_role = _role_result.scalar_one_or_none()
        _is_admin = _user_role == UserRole.ADMIN
        if not (_is_admin and _admin_can_manage_all_public(budget)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权删除"
            )

    await db.delete(budget)
    await db.flush()
    return True
