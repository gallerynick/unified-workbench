"""物品管理 API 路由"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.inventory import InventoryCreate, InventoryListResponse, InventoryResponse, InventoryUpdate
from app.services.inventory import create_inventory, delete_inventory, get_inventory, list_inventories, update_inventory

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[InventoryListResponse])
async def list_inventories_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    search: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """查询物品列表"""
    inventories, total = await list_inventories(db, current_user.id, page, page_size, status, search)
    return UnifiedResponse(
        data=InventoryListResponse(
            items=[InventoryResponse.model_validate(i) for i in inventories],
            total=total,
        )
    )


@router.post("/", response_model=UnifiedResponse[InventoryResponse])
async def create_inventory_endpoint(
    request: InventoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建物品"""
    inventory = await create_inventory(db, current_user.id, request)
    return UnifiedResponse(data=InventoryResponse.model_validate(inventory))


@router.get("/{inventory_id}", response_model=UnifiedResponse[InventoryResponse])
async def get_inventory_endpoint(
    inventory_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取物品详情"""
    inventory = await get_inventory(db, inventory_id, current_user.id)
    if not inventory:
        raise HTTPException(status_code=404, detail="物品不存在")
    return UnifiedResponse(data=InventoryResponse.model_validate(inventory))


@router.put("/{inventory_id}", response_model=UnifiedResponse[InventoryResponse])
async def update_inventory_endpoint(
    inventory_id: uuid.UUID,
    request: InventoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新物品"""
    inventory = await update_inventory(db, inventory_id, current_user.id, request)
    if not inventory:
        raise HTTPException(status_code=404, detail="物品不存在")
    return UnifiedResponse(data=InventoryResponse.model_validate(inventory))


@router.delete("/{inventory_id}", response_model=UnifiedResponse[None])
async def delete_inventory_endpoint(
    inventory_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除物品"""
    success = await delete_inventory(db, inventory_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="物品不存在")
    return UnifiedResponse(msg="物品已删除")
