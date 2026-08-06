"""物品管理服务"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.visibility import Visibility
from app.models.inventory import Inventory
from app.models.user import User, UserRole
from app.schemas.inventory import InventoryCreate, InventoryUpdate
from app.services.visibility import check_visibility as build_visibility_filter


# ── 辅助函数 ──────────────────────────────────────────────────────────


def _visibility_get_check(item: Inventory, user_id: uuid.UUID) -> bool:
    """检查用户是否能查看物品（基础可见性，不含 admin 特权）。"""
    if item.owner_id == user_id:
        return True
    if item.visibility == Visibility.PUBLIC:
        return True
    if item.visibility == Visibility.RESTRICTED and item.restricted_users:
        if str(user_id) in item.restricted_users:
            return True
    return False


def _admin_can_manage_own_designated(
    item: Inventory, user_id: uuid.UUID
) -> bool:
    """Admin 管理规则：own + visibility==PUBLIC + restricted_users 包含自己。"""
    if item.owner_id == user_id:
        return True
    if item.visibility == Visibility.PUBLIC:
        return True
    if item.restricted_users and str(user_id) in item.restricted_users:
        return True
    return False


# ── 列表 ──────────────────────────────────────────────────────────────


async def list_inventories(
    db: AsyncSession,
    owner_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
    search: str | None = None,
) -> tuple[list[Inventory], int]:
    """查询物品列表，支持分页、搜索、状态过滤、可见性过滤"""
    user_id = owner_id  # API 传参名为 owner_id，实际是当前用户 ID

    # 可见性过滤（基础规则：public + owner + restricted）
    visibility_cond = build_visibility_filter(Inventory, user_id)
    query = select(Inventory).where(visibility_cond)

    if status:
        query = query.where(Inventory.status == status)
    if search:
        query = query.where(Inventory.name.ilike(f"%{search}%"))

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Inventory.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


# ── 获取 ──────────────────────────────────────────────────────────────


async def get_inventory(
    db: AsyncSession,
    inventory_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> Inventory | None:
    """根据 ID 获取物品，检查可见性"""
    user_id = owner_id

    result = await db.execute(
        select(Inventory).where(Inventory.id == inventory_id)
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


async def create_inventory(
    db: AsyncSession, owner_id: uuid.UUID, request: InventoryCreate
) -> Inventory:
    """创建物品"""
    inventory = Inventory(
        name=request.name,
        category=request.category,
        quantity=request.quantity,
        location=request.location,
        description=request.description,
        status=request.status,
        tags=request.tags,
        owner_id=owner_id,
    )
    db.add(inventory)
    await db.flush()
    await db.refresh(inventory)
    return inventory


# ── 更新 ──────────────────────────────────────────────────────────────


async def update_inventory(
    db: AsyncSession,
    inventory_id: uuid.UUID,
    owner_id: uuid.UUID,
    request: InventoryUpdate,
) -> Inventory | None:
    """更新物品（owner 或 admin 满足 own+designated 规则）"""
    user_id = owner_id
    item = await get_inventory(db, inventory_id, user_id)
    if not item:
        return None

    # 权限检查：owner 或 admin（own+designated）
    if item.owner_id != user_id:
        _role_result = await db.execute(
            select(User.role).where(User.id == user_id)
        )
        _user_role = _role_result.scalar_one_or_none()
        _is_admin = _user_role == UserRole.ADMIN
        if not (_is_admin and _admin_can_manage_own_designated(item, user_id)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权修改"
            )

    if request.name is not None:
        item.name = request.name
    if request.category is not None:
        item.category = request.category
    if request.quantity is not None:
        item.quantity = request.quantity
    if request.location is not None:
        item.location = request.location
    if request.description is not None:
        item.description = request.description
    if request.status is not None:
        item.status = request.status
    if request.tags is not None:
        item.tags = request.tags
    await db.flush()
    await db.refresh(item)
    return item


# ── 删除 ──────────────────────────────────────────────────────────────


async def delete_inventory(
    db: AsyncSession,
    inventory_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> bool:
    """删除物品（owner 或 admin 满足 own+designated 规则）"""
    user_id = owner_id
    item = await get_inventory(db, inventory_id, user_id)
    if not item:
        return False

    # 权限检查：owner 或 admin（own+designated）
    if item.owner_id != user_id:
        _role_result = await db.execute(
            select(User.role).where(User.id == user_id)
        )
        _user_role = _role_result.scalar_one_or_none()
        _is_admin = _user_role == UserRole.ADMIN
        if not (_is_admin and _admin_can_manage_own_designated(item, user_id)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权删除"
            )

    await db.delete(item)
    await db.flush()
    return True
