"""服务器管理 API 路由"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.server import (
    ServerCreate,
    ServerListResponse,
    ServerResponse,
    ServerUpdate,
)
from app.schemas.system import SystemListResponse, SystemResponse
from app.services.server import (
    create_server,
    delete_server,
    get_server,
    list_servers,
    update_server,
)
from app.services.system import list_systems

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[ServerListResponse])
async def list_servers_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    search: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """查询服务器列表"""
    servers, total = await list_servers(db, current_user.id, page, page_size, status, search)
    return UnifiedResponse(
        data=ServerListResponse(
            items=[ServerResponse.model_validate(s) for s in servers],
            total=total,
        )
    )


@router.post("/", response_model=UnifiedResponse[ServerResponse])
async def create_server_endpoint(
    request: ServerCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建服务器"""
    server = await create_server(db, current_user.id, request)
    return UnifiedResponse(data=ServerResponse.model_validate(server))


@router.get("/{server_id}", response_model=UnifiedResponse[ServerResponse])
async def get_server_endpoint(
    server_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取服务器详情"""
    server = await get_server(db, server_id, current_user.id)
    if not server:
        raise HTTPException(status_code=404, detail="服务器不存在")
    return UnifiedResponse(data=ServerResponse.model_validate(server))


@router.put("/{server_id}", response_model=UnifiedResponse[ServerResponse])
async def update_server_endpoint(
    server_id: uuid.UUID,
    request: ServerUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新服务器"""
    server = await update_server(db, server_id, current_user.id, request)
    if not server:
        raise HTTPException(status_code=404, detail="服务器不存在")
    return UnifiedResponse(data=ServerResponse.model_validate(server))


@router.delete("/{server_id}", response_model=UnifiedResponse[None])
async def delete_server_endpoint(
    server_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除服务器"""
    success = await delete_server(db, server_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="服务器不存在")
    return UnifiedResponse(msg="服务器已删除")


@router.get("/{server_id}/systems", response_model=UnifiedResponse[SystemListResponse])
async def get_server_systems_endpoint(
    server_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """查询服务器下的系统列表"""
    systems, total = await list_systems(db, current_user.id, server_id=server_id)
    return UnifiedResponse(
        data=SystemListResponse(
            items=[SystemResponse.model_validate(s) for s in systems],
            total=total,
        )
    )


