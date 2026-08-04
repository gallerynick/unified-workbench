"""服务管理服务 — 依赖 T2 模型文件 (app/models/service.py, app/models/system.py, app/models/server.py)"""

from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.server import Server
from app.models.service import Service
from app.models.system import System
from app.schemas.service import ServiceCreate, ServiceUpdate
from app.services.audit import log_audit


async def _check_service_owner(
    db: AsyncSession,
    service_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Service:
    """获取服务并校验 owner：通过 service.system.server.owner_id 判断。"""
    stmt = (
        select(Service)
        .where(Service.id == service_id)
        .options(
            joinedload(Service.system).joinedload(System.server),
        )
    )
    result = await db.execute(stmt)
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="服务不存在")
    if service.system.server.owner_id != user_id:
        raise HTTPException(status_code=403, detail="无权操作该资源")
    return service


async def list_services(
    db: AsyncSession,
    user_id: uuid.UUID,
    system_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 100,
) -> tuple[list[Service], int]:
    """查询服务列表，支持按 system_id 过滤 + owner 校验（join system→server）"""
    query = (
        select(Service)
        .join(System, Service.system_id == System.id)
        .join(Server, System.server_id == Server.id)
        .where(Server.owner_id == user_id)
    )

    if system_id:
        query = query.where(Service.system_id == system_id)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Service.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_service(
    db: AsyncSession,
    service_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Service:
    """根据 ID 获取服务，owner 校验"""
    return await _check_service_owner(db, service_id, user_id)


async def create_service(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: ServiceCreate,
) -> Service:
    """创建服务。先校验 system 的 owner；target_type/target_name 仅在 target_type 不为空时写入"""
    # 校验 system 是否存在且属于当前用户
    sys_stmt = (
        select(System)
        .where(System.id == data.system_id)
        .options(joinedload(System.server))
    )
    sys_result = await db.execute(sys_stmt)
    system = sys_result.scalar_one_or_none()
    if not system:
        raise HTTPException(status_code=404, detail="所属系统不存在")
    if system.server.owner_id != user_id:
        raise HTTPException(status_code=403, detail="无权操作该资源")

    # 仅在 target_type 不为空时写入 target 相关字段
    target_type: str | None = None
    target_name: str | None = None
    if data.target_type:
        target_type = data.target_type
        target_name = data.target_name

    service = Service(
        name=data.name,
        description=data.description,
        system_id=data.system_id,
        protocol=data.protocol,
        status=data.status,
        health_check_url=data.health_check_url,
        target_type=target_type,
        target_name=target_name,
        port=data.port,
        maintainer_ids=data.maintainer_ids,
    )
    db.add(service)
    await db.flush()
    await log_audit(db, user_id, "create_service", "service", str(service.id))
    await db.refresh(service)
    return service


async def update_service(
    db: AsyncSession,
    service_id: uuid.UUID,
    user_id: uuid.UUID,
    data: ServiceUpdate,
) -> Service:
    """更新服务"""
    service = await _check_service_owner(db, service_id, user_id)

    if data.name is not None:
        service.name = data.name
    if data.description is not None:
        service.description = data.description
    if data.system_id is not None:
        # 校验新 system 的 owner
        sys_stmt = (
            select(System)
            .where(System.id == data.system_id)
            .options(joinedload(System.server))
        )
        sys_result = await db.execute(sys_stmt)
        new_system = sys_result.scalar_one_or_none()
        if not new_system:
            raise HTTPException(status_code=404, detail="目标系统不存在")
        if new_system.server.owner_id != user_id:
            raise HTTPException(status_code=403, detail="无权操作该资源")
        service.system_id = data.system_id
    if data.protocol is not None:
        service.protocol = data.protocol
    if data.status is not None:
        service.status = data.status
    if data.health_check_url is not None:
        service.health_check_url = data.health_check_url
    if data.target_type is not None:
        service.target_type = data.target_type
    if data.target_name is not None:
        service.target_name = data.target_name
    if data.port is not None:
        service.port = data.port
    if data.maintainer_ids is not None:
        service.maintainer_ids = data.maintainer_ids

    await db.flush()
    await log_audit(db, user_id, "update_service", "service", str(service.id))
    await db.refresh(service)
    return service


async def delete_service(
    db: AsyncSession,
    service_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    """删除服务"""
    service = await _check_service_owner(db, service_id, user_id)
    await db.delete(service)
    await db.flush()
    await log_audit(db, user_id, "delete_service", "service", str(service_id))
    return True
