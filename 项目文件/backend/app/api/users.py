"""用户管理 API 路由。"""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_admin, get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.user import (
    UserCreateRequest,
    UserListResponse,
    UserResponse,
    UserUpdateRequest,
)
from app.schemas.user_preference import (
    UserPreferenceResponse,
    UserPreferenceUpdate,
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


@router.get("/me/preferences", response_model=UnifiedResponse[UserPreferenceResponse])
async def get_user_preferences_endpoint(
    current_user: User = Depends(get_current_user),
):
    """获取当前用户的偏好设置。"""
    prefs = current_user.preferences or {}
    return UnifiedResponse(
        data=UserPreferenceResponse(
            page_zoom=prefs.get("page_zoom", "100"),
            theme_mode=prefs.get("theme_mode", "system"),
            allow_multiple_logins=prefs.get("allow_multiple_logins", True),
        )
    )


@router.put("/me/preferences", response_model=UnifiedResponse[UserPreferenceResponse])
async def update_user_preferences_endpoint(
    body: UserPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新当前用户的偏好设置。"""
    from sqlalchemy.orm.attributes import flag_modified

    # 直接改 ORM 属性而非拼 jsonb SQL：`:patch::jsonb` 里的 `::` 会被 SQLAlchemy
    # 识别为 PostgreSQL 类型转换符，导致 `:patch` 不被当作绑定参数，UPDATE 直接
    # 语法错误 500。用 flag_modified 标记 JSONB 列已变更，让 ORM 发整列 UPDATE。
    prefs = dict(current_user.preferences or {})
    prefs["page_zoom"] = body.page_zoom
    prefs["theme_mode"] = body.theme_mode
    # allow_multiple_logins 为 None 表示调用方不关心它（个性化页只改缩放与主题），
    # 不能写回默认值，否则改一次缩放就会把「单设备登录」悄悄打开。
    if body.allow_multiple_logins is not None:
        prefs["allow_multiple_logins"] = body.allow_multiple_logins
    current_user.preferences = prefs
    flag_modified(current_user, "preferences")
    await db.commit()

    return UnifiedResponse(
        data=UserPreferenceResponse(
            page_zoom=prefs.get("page_zoom"),
            theme_mode=prefs.get("theme_mode"),
            allow_multiple_logins=prefs.get("allow_multiple_logins", True),
        )
    )
