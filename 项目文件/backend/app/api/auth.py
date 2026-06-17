"""认证 API 路由。"""

from fastapi import APIRouter, Depends, Request
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
