"""系统管理 API 路由"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.system import (
    SystemCreate,
    SystemListResponse,
    SystemResponse,
    SystemUpdate,
)
from app.services.system import (
    create_system,
    delete_system,
    get_system,
    list_systems,
    update_system,
)

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[SystemListResponse])
async def list_systems_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    server_id: uuid.UUID | None = Query(None),
    parent_system_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """查询系统列表，支持按 server_id / parent_system_id 过滤"""
    systems, total = await list_systems(
        db, current_user.id, server_id=server_id, parent_system_id=parent_system_id, page=page, page_size=page_size,
    )
    return UnifiedResponse(
        data=SystemListResponse(
            items=[SystemResponse.model_validate(s) for s in systems],
            total=total,
        )
    )


@router.post("/", response_model=UnifiedResponse[SystemResponse])
async def create_system_endpoint(
    request: SystemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建系统"""
    system = await create_system(db, current_user.id, request)
    return UnifiedResponse(data=SystemResponse.model_validate(system))


@router.get("/{system_id}", response_model=UnifiedResponse[SystemResponse])
async def get_system_endpoint(
    system_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取系统详情"""
    system = await get_system(db, system_id, current_user.id)
    if not system:
        raise HTTPException(status_code=404, detail="系统不存在")
    return UnifiedResponse(data=SystemResponse.model_validate(system))


@router.put("/{system_id}", response_model=UnifiedResponse[SystemResponse])
async def update_system_endpoint(
    system_id: uuid.UUID,
    request: SystemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新系统"""
    system = await update_system(db, system_id, current_user.id, request)
    if not system:
        raise HTTPException(status_code=404, detail="系统不存在")
    return UnifiedResponse(data=SystemResponse.model_validate(system))


@router.delete("/{system_id}", response_model=UnifiedResponse[None])
async def delete_system_endpoint(
    system_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除系统"""
    success = await delete_system(db, system_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="系统不存在")
    return UnifiedResponse(msg="系统已删除")
