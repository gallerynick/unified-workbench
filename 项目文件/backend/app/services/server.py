"""服务器管理服务 — 依赖 T2 模型文件 (app/models/server.py, app/models/system.py)"""

from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.server import Server
from app.schemas.server import ServerCreate, ServerUpdate
from app.services.audit import log_audit


async def list_servers(
    db: AsyncSession,
    user_id: uuid.UUID,
    page: int = 1,
    page_size: int = 10,
    status: str | None = None,
    search: str | None = None,
) -> tuple[list[Server], int]:
    """查询服务器列表，支持分页、搜索、状态过滤"""
    query = select(Server).where(Server.owner_id == user_id)

    if status:
        query = query.where(Server.status == status)

    if search:
        query = query.where(
            or_(
                Server.name.ilike(f"%{search}%"),
                Server.hostname.ilike(f"%{search}%"),
                Server.purpose.ilike(f"%{search}%"),
                Server.location.ilike(f"%{search}%"),
                Server.ip.ilike(f"%{search}%"),
            )
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Server.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_server(
    db: AsyncSession,
    server_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Server:
    """根据 ID 获取服务器，owner 校验"""
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="服务器不存在")
    if server.owner_id != user_id:
        raise HTTPException(status_code=403, detail="无权操作该资源")
    return server


async def create_server(
    db: AsyncSession,
    owner_id: uuid.UUID,
    data: ServerCreate,
) -> Server:
    """创建服务器"""
    server = Server(
        name=data.name,
        hostname=data.hostname,
        purpose=data.purpose,
        location=data.location,
        ip=data.ip,
        os=data.os,
        cpu_cores=data.cpu_cores,
        ram_gb=data.ram_gb,
        disk_gb=data.disk_gb,
        model=data.model,
        serial_number=data.serial_number,
        tags=data.tags,
        description=data.description,
        notes=data.notes,
        status=data.status,
        maintainer_ids=data.maintainer_ids,
        owner_id=owner_id,
    )
    db.add(server)
    await db.flush()
    await log_audit(db, owner_id, "create_server", "server", str(server.id))
    await db.refresh(server)
    return server


async def update_server(
    db: AsyncSession,
    server_id: uuid.UUID,
    user_id: uuid.UUID,
    data: ServerUpdate,
) -> Server:
    """更新服务器"""
    server = await get_server(db, server_id, user_id)

    if data.name is not None:
        server.name = data.name
    if data.hostname is not None:
        server.hostname = data.hostname
    if data.purpose is not None:
        server.purpose = data.purpose
    if data.location is not None:
        server.location = data.location
    if data.ip is not None:
        server.ip = data.ip
    if data.os is not None:
        server.os = data.os
    if data.cpu_cores is not None:
        server.cpu_cores = data.cpu_cores
    if data.ram_gb is not None:
        server.ram_gb = data.ram_gb
    if data.disk_gb is not None:
        server.disk_gb = data.disk_gb
    if data.model is not None:
        server.model = data.model
    if data.serial_number is not None:
        server.serial_number = data.serial_number
    if data.tags is not None:
        server.tags = data.tags
    if data.description is not None:
        server.description = data.description
    if data.notes is not None:
        server.notes = data.notes
    if data.status is not None:
        server.status = data.status
    if data.maintainer_ids is not None:
        server.maintainer_ids = data.maintainer_ids

    await db.flush()
    await log_audit(db, user_id, "update_server", "server", str(server.id))
    await db.refresh(server)
    return server


async def delete_server(
    db: AsyncSession,
    server_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    """删除服务器。级联删 systems/services（由 DB 外键 CASCADE 处理）"""
    server = await get_server(db, server_id, user_id)
    await db.delete(server)
    await db.flush()
    await log_audit(db, user_id, "delete_server", "server", str(server_id))
    return True
