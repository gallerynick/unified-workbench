"""服务器管理服务 — 依赖 T2 模型文件 (app/models/server.py, app/models/system.py)"""

from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.server import Server
from app.models.system import System
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
) -> tuple[Server, uuid.UUID | None]:
    """创建服务器。若 server_type == "SINGLE"，自动创建默认 System"""
    server = Server(
        name=data.name,
        purpose=data.purpose,
        location=data.location,
        ip=data.ip,
        description=data.description,
        notes=data.notes,
        status=data.status,
        server_type=data.server_type,
        maintainer_ids=data.maintainer_ids,
        owner_id=owner_id,
        deploy_status=None,
    )
    db.add(server)
    await db.flush()

    default_system_id: uuid.UUID | None = None
    if data.server_type == "SINGLE":
        system = System(
            server_id=server.id,
            name=data.system_name or f"{server.name}-系统",
            description=data.system_description,
            maintainer_ids=[],
        )
        db.add(system)
        await db.flush()
        default_system_id = system.id

    await log_audit(db, owner_id, "create_server", "server", str(server.id))
    await db.refresh(server)
    return server, default_system_id


async def update_server(
    db: AsyncSession,
    server_id: uuid.UUID,
    user_id: uuid.UUID,
    data: ServerUpdate,
) -> Server:
    """更新服务器。server_type 不可通过此方法修改"""
    server = await get_server(db, server_id, user_id)

    if data.server_type is not None and data.server_type != server.server_type:
        raise HTTPException(status_code=400, detail="类型创建后不可修改")

    if data.name is not None:
        server.name = data.name
    if data.purpose is not None:
        server.purpose = data.purpose
    if data.location is not None:
        server.location = data.location
    if data.ip is not None:
        server.ip = data.ip
    if data.description is not None:
        server.description = data.description
    if data.notes is not None:
        server.notes = data.notes
    if data.status is not None:
        server.status = data.status
    if data.deploy_status is not None:
        server.deploy_status = data.deploy_status
    # 不更新 server_type（已在上面阻止）
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


async def change_server_type(
    db: AsyncSession,
    server_id: uuid.UUID,
    user_id: uuid.UUID,
    new_type: str,
) -> tuple[Server, bool]:
    """变更服务器类型。若 new_type == 当前类型则无操作；否则设为 PENDING_REDEPLOY。
    返回 (server, changed)。"""
    server = await get_server(db, server_id, user_id)

    if new_type == server.server_type:
        return server, False

    server.deploy_status = "PENDING_REDEPLOY"
    await db.flush()
    await log_audit(db, user_id, "change_server_type", "server", str(server.id))
    await db.refresh(server)
    return server, True
