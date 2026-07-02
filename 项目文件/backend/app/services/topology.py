"""拓扑管理服务"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.topology import Topology
from app.schemas.topology import TopologyCreate, TopologyUpdate
from app.services.audit import log_audit
from app.services.visibility import check_visibility as visibility_filter


async def list_topologies(
    db: AsyncSession,
    owner_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Topology], int]:
    """查询拓扑列表，支持分页"""
    query = select(Topology).where(visibility_filter(Topology, owner_id))
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Topology.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_topology(
    db: AsyncSession, topology_id: uuid.UUID, owner_id: uuid.UUID
) -> Topology | None:
    """根据 ID 获取拓扑"""
    result = await db.execute(
        select(Topology).where(Topology.id == topology_id, Topology.owner_id == owner_id)
    )
    return result.scalar_one_or_none()


async def create_topology(
    db: AsyncSession, owner_id: uuid.UUID, request: TopologyCreate
) -> Topology:
    """创建拓扑"""
    topology = Topology(
        name=request.name,
        description=request.description,
        category=request.category,
        nodes=request.nodes,
        edges=request.edges,
        owner_id=owner_id,
        visibility=request.visibility,
        restricted_users=request.restricted_users,
        restricted_tags=request.restricted_tags,
    )
    db.add(topology)
    await db.flush()
    await log_audit(db, owner_id, "create_topology", "topology", str(topology.id))
    await db.refresh(topology)
    return topology


async def update_topology(
    db: AsyncSession,
    topology_id: uuid.UUID,
    owner_id: uuid.UUID,
    request: TopologyUpdate,
) -> Topology | None:
    """更新拓扑"""
    topology = await get_topology(db, topology_id, owner_id)
    if not topology:
        return None
    if request.name is not None:
        topology.name = request.name
    if request.description is not None:
        topology.description = request.description
    if request.category is not None:
        topology.category = request.category
    if request.nodes is not None:
        topology.nodes = request.nodes
    if request.edges is not None:
        topology.edges = request.edges
    await db.flush()
    await log_audit(db, owner_id, "update_topology", "topology", str(topology.id))
    await db.refresh(topology)
    return topology


async def delete_topology(
    db: AsyncSession, topology_id: uuid.UUID, owner_id: uuid.UUID
) -> bool:
    """删除拓扑"""
    topology = await get_topology(db, topology_id, owner_id)
    if not topology:
        return False
    await db.delete(topology)
    await db.flush()
    await log_audit(db, owner_id, "delete_topology", "topology", str(topology_id))
    return True