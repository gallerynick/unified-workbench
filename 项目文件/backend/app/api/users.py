"""用户管理 API 路由。"""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.user import (
    UserCreateRequest,
    UserListResponse,
    UserResponse,
    UserUpdateRequest,
)
from app.services.user import (
    create_user,
    disable_user,
    get_user,
    list_users,
    update_user,
)

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[UserListResponse])
async def list_users_endpoint(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    search: str = Query("", description="搜索关键词（用户名/昵称）"),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理员：分页查询用户列表。"""
    users, total = await list_users(db, page=page, page_size=page_size, search=search)
    return UnifiedResponse(
        data=UserListResponse(
            items=[UserResponse.model_validate(u) for u in users],
            total=total,
        )
    )


@router.post("/", response_model=UnifiedResponse[UserResponse])
async def create_user_endpoint(
    request: UserCreateRequest,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理员：创建用户。"""
    user = await create_user(db, request)
    return UnifiedResponse(data=UserResponse.model_validate(user))


@router.get("/{user_id}", response_model=UnifiedResponse[UserResponse])
async def get_user_endpoint(
    user_id: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理员：获取用户详情。"""
    user = await get_user(db, uuid.UUID(user_id))
    return UnifiedResponse(data=UserResponse.model_validate(user))


@router.put("/{user_id}", response_model=UnifiedResponse[UserResponse])
async def update_user_endpoint(
    user_id: str,
    request: UserUpdateRequest,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理员：更新用户信息。"""
    user = await update_user(db, uuid.UUID(user_id), request)
    return UnifiedResponse(data=UserResponse.model_validate(user))


@router.delete("/{user_id}", response_model=UnifiedResponse[UserResponse])
async def disable_user_endpoint(
    user_id: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理员：软删除（禁用）用户。"""
    user = await disable_user(db, uuid.UUID(user_id))
    return UnifiedResponse(data=UserResponse.model_validate(user))
