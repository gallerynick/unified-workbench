"""系统管理服务 — 依赖 T2 模型文件 (app/models/system.py, app/models/server.py)"""

from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.server import Server
from app.models.system import System
from app.schemas.system import SystemCreate, SystemUpdate
from app.services.audit import log_audit


async def _check_system_owner(
    db: AsyncSession,
    system_id: uuid.UUID,
    user_id: uuid.UUID,
) -> System:
    """获取系统并校验 owner：通过 system.server.owner_id 判断。"""
    stmt = (
        select(System)
        .where(System.id == system_id)
        .options(joinedload(System.server))
    )
    result = await db.execute(stmt)
    system = result.scalar_one_or_none()
    if not system:
        raise HTTPException(status_code=404, detail="系统不存在")
    if system.server.owner_id != user_id:
        raise HTTPException(status_code=403, detail="无权操作该资源")
    return system


async def list_systems(
    db: AsyncSession,
    user_id: uuid.UUID,
    server_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 100,
) -> tuple[list[System], int]:
    """查询系统列表，支持按 server_id 过滤 + owner 校验（join server）"""
    query = (
        select(System)
        .join(Server, System.server_id == Server.id)
        .where(Server.owner_id == user_id)
    )

    if server_id:
        query = query.where(System.server_id == server_id)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(System.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_system(
    db: AsyncSession,
    system_id: uuid.UUID,
    user_id: uuid.UUID,
) -> System:
    """根据 ID 获取系统，owner 校验"""
    return await _check_system_owner(db, system_id, user_id)


async def create_system(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: SystemCreate,
) -> System:
    """创建系统。先校验 server 的 owner"""
    # 校验 server 是否存在且属于当前用户
    server_result = await db.execute(select(Server).where(Server.id == data.server_id))
    server = server_result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="所属服务器不存在")
    if server.owner_id != user_id:
        raise HTTPException(status_code=403, detail="无权操作该资源")

    system = System(
        name=data.name,
        description=data.description,
        server_id=data.server_id,
        maintainer_ids=data.maintainer_ids,
    )
    db.add(system)
    await db.flush()
    await log_audit(db, user_id, "create_system", "system", str(system.id))
    await db.refresh(system)
    return system


async def update_system(
    db: AsyncSession,
    system_id: uuid.UUID,
    user_id: uuid.UUID,
    data: SystemUpdate,
) -> System:
    """更新系统"""
    system = await _check_system_owner(db, system_id, user_id)

    if data.name is not None:
        system.name = data.name
    if data.description is not None:
        system.description = data.description
    if data.server_id is not None:
        # 校验新 server 的 owner
        new_svr = await db.execute(select(Server).where(Server.id == data.server_id))
        new_server = new_svr.scalar_one_or_none()
        if not new_server:
            raise HTTPException(status_code=404, detail="目标服务器不存在")
        if new_server.owner_id != user_id:
            raise HTTPException(status_code=403, detail="无权操作该资源")
        system.server_id = data.server_id
    if data.maintainer_ids is not None:
        system.maintainer_ids = data.maintainer_ids

    await db.flush()
    await log_audit(db, user_id, "update_system", "system", str(system.id))
    await db.refresh(system)
    return system


async def delete_system(
    db: AsyncSession,
    system_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    """删除系统，级联删 services"""
    system = await _check_system_owner(db, system_id, user_id)
    await db.delete(system)
    await db.flush()
    await log_audit(db, user_id, "delete_system", "system", str(system_id))
    return True
