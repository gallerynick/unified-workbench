"""服务管理 API 路由"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.service import (
    ServiceCreate,
    ServiceListResponse,
    ServiceResponse,
    ServiceUpdate,
)
from app.services.service import (
    create_service,
    delete_service,
    get_service,
    list_services,
    update_service,
)

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[ServiceListResponse])
async def list_services_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    system_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """查询服务列表，支持按 system_id 过滤"""
    services, total = await list_services(db, current_user.id, system_id=system_id, page=page, page_size=page_size)
    return UnifiedResponse(
        data=ServiceListResponse(
            items=[ServiceResponse.model_validate(s) for s in services],
            total=total,
        )
    )


@router.post("/", response_model=UnifiedResponse[ServiceResponse])
async def create_service_endpoint(
    request: ServiceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建服务"""
    service = await create_service(db, current_user.id, request)
    return UnifiedResponse(data=ServiceResponse.model_validate(service))


@router.get("/{service_id}", response_model=UnifiedResponse[ServiceResponse])
async def get_service_endpoint(
    service_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取服务详情"""
    service = await get_service(db, service_id, current_user.id)
    if not service:
        raise HTTPException(status_code=404, detail="服务不存在")
    return UnifiedResponse(data=ServiceResponse.model_validate(service))


@router.put("/{service_id}", response_model=UnifiedResponse[ServiceResponse])
async def update_service_endpoint(
    service_id: uuid.UUID,
    request: ServiceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新服务"""
    service = await update_service(db, service_id, current_user.id, request)
    if not service:
        raise HTTPException(status_code=404, detail="服务不存在")
    return UnifiedResponse(data=ServiceResponse.model_validate(service))


@router.delete("/{service_id}", response_model=UnifiedResponse[None])
async def delete_service_endpoint(
    service_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除服务"""
    success = await delete_service(db, service_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="服务不存在")
    return UnifiedResponse(msg="服务已删除")
