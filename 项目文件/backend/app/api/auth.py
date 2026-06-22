"""认证 API 路由。"""

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import verify_password
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    PasswordChangeRequest,
    PasswordVerifyRequest,
    RefreshRequest,
    TokenResponse,
)
from app.schemas.common import UnifiedResponse
from app.schemas.user import UserResponse
from app.services.auth import change_password, login, refresh_access_token
from app.services.system_config import get_config, update_config

router = APIRouter()


@router.post("/login", response_model=UnifiedResponse[TokenResponse])
async def login_endpoint(request: LoginRequest, req: Request, db: AsyncSession = Depends(get_db)):
    """用户登录。"""
    ip = req.client.host if req.client else None
    tokens = await login(db, request, ip)
    return UnifiedResponse(data=tokens)


@router.post("/refresh", response_model=UnifiedResponse[TokenResponse])
async def refresh_endpoint(request: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """刷新访问令牌。"""
    tokens = await refresh_access_token(db, request)
    return UnifiedResponse(data=tokens)


@router.get("/me", response_model=UnifiedResponse[UserResponse])
async def get_me_endpoint(current_user: User = Depends(get_current_user)):
    """获取当前用户信息。"""
    return UnifiedResponse(data=UserResponse.model_validate(current_user))


@router.put("/me", response_model=UnifiedResponse[UserResponse])
async def update_me_endpoint(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新当前用户信息（昵称、头像）。"""
    if "nickname" in request and request["nickname"]:
        current_user.nickname = request["nickname"]
    if "avatar" in request:
        current_user.avatar = request["avatar"] or None
    await db.flush()
    await db.refresh(current_user)
    return UnifiedResponse(data=UserResponse.model_validate(current_user))


@router.put("/me/password", response_model=UnifiedResponse[None])
async def change_password_endpoint(
    request: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """修改当前用户密码。"""
    await change_password(db, current_user, request)
    return UnifiedResponse(msg="密码修改成功")


@router.post("/verify-password", response_model=UnifiedResponse[dict])
async def verify_password_endpoint(
    request: PasswordVerifyRequest,
    current_user: User = Depends(get_current_user),
):
    """验证当前用户登录密码"""
    valid = verify_password(request.password, current_user.password_hash)
    return UnifiedResponse(data={"valid": valid})


SETUP_COMPLETE_KEY = "setup_complete"


@router.get("/setup-status", response_model=UnifiedResponse[dict])
async def get_setup_status_endpoint(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取系统初始化状态（任何已认证用户可访问，永不 404）。

    强制 no-store 头防止 Safari/Edge 对 {complete: false} 做启发式缓存，
    避免完成初始化后仍反复跳转 Welcome 页面。
    """
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    value = await get_config(db, SETUP_COMPLETE_KEY)
    complete = value.get("complete", False) if value else False
    return UnifiedResponse(data={"complete": complete})


@router.post("/setup-complete", response_model=UnifiedResponse[dict])
async def mark_setup_complete_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """标记系统初始化完成（任何已认证用户可调用，替代仅管理员的 system-config PUT）。"""
    config = await update_config(db, SETUP_COMPLETE_KEY, {"complete": True})
    return UnifiedResponse(data={"complete": config.value.get("complete", True) if config else True})
