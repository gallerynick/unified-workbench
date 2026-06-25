"""拓扑管理 API 路由"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.topology import (
    TopologyCreate,
    TopologyListResponse,
    TopologyResponse,
    TopologyUpdate,
)
from app.services.topology import (
    create_topology,
    delete_topology,
    get_topology,
    list_topologies,
    update_topology,
)

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[TopologyListResponse])
async def list_topologies_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """查询拓扑列表"""
    topologies, total = await list_topologies(db, current_user.id, page, page_size)
    return UnifiedResponse(
        data=TopologyListResponse(
            items=[TopologyResponse.model_validate(t) for t in topologies],
            total=total,
        )
    )


@router.post("/", response_model=UnifiedResponse[TopologyResponse])
async def create_topology_endpoint(
    request: TopologyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建拓扑"""
    topology = await create_topology(db, current_user.id, request)
    return UnifiedResponse(data=TopologyResponse.model_validate(topology))


@router.get("/{topology_id}", response_model=UnifiedResponse[TopologyResponse])
async def get_topology_endpoint(
    topology_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取拓扑详情"""
    topology = await get_topology(db, topology_id, current_user.id)
    if not topology:
        raise HTTPException(status_code=404, detail="拓扑不存在")
    return UnifiedResponse(data=TopologyResponse.model_validate(topology))


@router.put("/{topology_id}", response_model=UnifiedResponse[TopologyResponse])
async def update_topology_endpoint(
    topology_id: uuid.UUID,
    request: TopologyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新拓扑"""
    topology = await update_topology(db, topology_id, current_user.id, request)
    if not topology:
        raise HTTPException(status_code=404, detail="拓扑不存在")
    return UnifiedResponse(data=TopologyResponse.model_validate(topology))


@router.delete("/{topology_id}", response_model=UnifiedResponse[None])
async def delete_topology_endpoint(
    topology_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除拓扑"""
    success = await delete_topology(db, topology_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="拓扑不存在")
    return UnifiedResponse(msg="拓扑已删除")