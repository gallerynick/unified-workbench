"""物品管理服务"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import Inventory
from app.schemas.inventory import InventoryCreate, InventoryUpdate
from app.services.audit import log_audit


async def list_inventories(
    db: AsyncSession,
    owner_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
    search: str | None = None,
) -> tuple[list[Inventory], int]:
    """查询物品列表，支持分页、搜索、状态过滤"""
    query = select(Inventory).where(Inventory.owner_id == owner_id)
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


async def get_inventory(db: AsyncSession, inventory_id: uuid.UUID, owner_id: uuid.UUID) -> Inventory | None:
    """根据 ID 获取物品"""
    result = await db.execute(
        select(Inventory).where(Inventory.id == inventory_id, Inventory.owner_id == owner_id)
    )
    return result.scalar_one_or_none()


async def create_inventory(db: AsyncSession, owner_id: uuid.UUID, request: InventoryCreate) -> Inventory:
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
    await log_audit(db, owner_id, "create_inventory", "inventory", str(inventory.id))
    await db.refresh(inventory)
    return inventory


async def update_inventory(db: AsyncSession, inventory_id: uuid.UUID, owner_id: uuid.UUID, request: InventoryUpdate) -> Inventory | None:
    """更新物品"""
    inventory = await get_inventory(db, inventory_id, owner_id)
    if not inventory:
        return None
    if request.name is not None:
        inventory.name = request.name
    if request.category is not None:
        inventory.category = request.category
    if request.quantity is not None:
        inventory.quantity = request.quantity
    if request.location is not None:
        inventory.location = request.location
    if request.description is not None:
        inventory.description = request.description
    if request.status is not None:
        inventory.status = request.status
    if request.tags is not None:
        inventory.tags = request.tags
    await db.flush()
    await log_audit(db, owner_id, "update_inventory", "inventory", str(inventory.id))
    await db.refresh(inventory)
    return inventory


async def delete_inventory(db: AsyncSession, inventory_id: uuid.UUID, owner_id: uuid.UUID) -> bool:
    """删除物品"""
    inventory = await get_inventory(db, inventory_id, owner_id)
    if not inventory:
        return False
    await db.delete(inventory)
    await db.flush()
    await log_audit(db, owner_id, "delete_inventory", "inventory", str(inventory.id))
    return True
