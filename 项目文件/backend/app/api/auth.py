"""认证 API 路由。"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import verify_password
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    PasswordChangeRequest,
    PasswordVerifyRequest,
    ProfileUpdateRequest,
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
    request: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新当前用户信息（昵称、头像）。"""
    if request.nickname is not None:
        current_user.nickname = request.nickname
    if "avatar" in request.model_fields_set:
        current_user.avatar = request.avatar
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
    db: AsyncSession = Depends(get_db),
):
    """获取系统初始化状态（公开接口，无需登录）。

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


class InitialSetupRequest(BaseModel):
    """初始设置请求（创建首个管理员）"""
    username: str
    password: str
    nickname: str = "管理员"


@router.post("/initial-setup", response_model=UnifiedResponse[dict])
async def initial_setup_endpoint(
    request: InitialSetupRequest,
    db: AsyncSession = Depends(get_db),
):
    """初始化系统：创建首个管理员账号并标记设置完成（公开接口）"""
    from sqlalchemy import select, text
    from app.core.security import hash_password, validate_password_strength
    from app.models.user import User, UserRole, UserStatus

    # 1. 检查是否已初始化（通过 setup_complete 标记而非用户数）
    from app.services.system_config import get_config
    config = await get_config(db, SETUP_COMPLETE_KEY)
    if config and config.get("complete") is True:
        return {"code": 1, "msg": "系统已初始化", "data": None}

    # 2. 清除 seed 创建的默认用户，替换为请求中指定的管理员
    await db.execute(text("DELETE FROM \"user\""))

    # 3. 验证用户名和密码
    if len(request.username) < 3 or len(request.username) > 50:
        return {"code": 1, "msg": "用户名长度需在 3-50 个字符", "data": None}
    if not validate_password_strength(request.password):
        return {"code": 1, "msg": "密码至少 8 位，必须包含字母和数字", "data": None}

    # 3. 创建管理员账号
    admin = User(
        username=request.username,
        password_hash=hash_password(request.password),
        nickname=request.nickname,
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
    )
    db.add(admin)

    # 4. 标记设置完成
    await update_config(db, SETUP_COMPLETE_KEY, {"complete": True})
    await db.commit()

    return UnifiedResponse(msg="初始化完成，请登录")


@router.delete("/me", response_model=UnifiedResponse[None])
async def delete_me_endpoint(
    request: PasswordVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除当前用户账户（需验证密码）。"""
    if not verify_password(request.password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="密码错误")
    await db.execute(delete(User).where(User.id == current_user.id))
    await db.flush()
    return UnifiedResponse(msg="账户已删除")
