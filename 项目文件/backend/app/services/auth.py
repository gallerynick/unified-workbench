"""认证业务逻辑。"""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    validate_password_strength,
    verify_password,
)
from app.models.user import User, UserStatus
from app.schemas.auth import LoginRequest, PasswordChangeRequest, RefreshRequest, TokenResponse

# 登录失败限制配置
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION = 300  # 5 分钟


async def _check_login_rate_limit(username: str, ip: str | None = None) -> None:
    """检查登录失败次数，超过限制则锁定。Redis 不可用时跳过。"""
    try:
        import redis.asyncio as aioredis

        settings = get_settings()
        redis = aioredis.from_url(settings.REDIS_URL)

        key = f"login_attempts:{username}"
        attempts = await redis.get(key)

        if attempts and int(attempts) >= MAX_LOGIN_ATTEMPTS:
            ttl = await redis.ttl(key)
            await redis.close()
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"登录失败次数过多，请 {ttl} 秒后重试",
            )

        await redis.close()
    except HTTPException:
        raise
    except Exception:
        pass


async def _record_login_failure(username: str) -> None:
    """记录登录失败次数。Redis 不可用时跳过。"""
    try:
        import redis.asyncio as aioredis

        settings = get_settings()
        redis = aioredis.from_url(settings.REDIS_URL)

        key = f"login_attempts:{username}"
        await redis.incr(key)
        await redis.expire(key, LOCKOUT_DURATION)
        await redis.close()
    except Exception:
        pass


async def _clear_login_attempts(username: str) -> None:
    """登录成功后清除失败记录。Redis 不可用时跳过。"""
    try:
        import redis.asyncio as aioredis

        settings = get_settings()
        redis = aioredis.from_url(settings.REDIS_URL)

        key = f"login_attempts:{username}"
        await redis.delete(key)
        await redis.close()
    except Exception:
        pass


async def login(db: AsyncSession, request: LoginRequest, ip: str | None = None) -> TokenResponse:
    """用户登录，验证凭据并返回令牌。包含登录失败限制。"""
    await _check_login_rate_limit(request.username, ip)

    result = await db.execute(select(User).where(User.username == request.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.password_hash):
        await _record_login_failure(request.username)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")

    if user.status == UserStatus.DISABLED:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号已被禁用")

    await _clear_login_attempts(request.username)

    access_token = create_access_token(str(user.id), user.role.value)
    refresh_token = create_refresh_token(str(user.id))

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


async def refresh_access_token(db: AsyncSession, request: RefreshRequest) -> TokenResponse:
    """用刷新令牌换取新的访问令牌。"""
    try:
        payload = decode_token(request.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的刷新令牌")

        user_id = payload.get("sub")
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()

        if not user or user.status == UserStatus.DISABLED:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在或已禁用"
            )

        access_token = create_access_token(str(user.id), user.role.value)
        refresh_token = create_refresh_token(str(user.id))

        return TokenResponse(access_token=access_token, refresh_token=refresh_token)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的刷新令牌")


async def get_user_by_id(db: AsyncSession, user_id: str) -> User:
    """根据 ID 获取用户。"""
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在")
    return user


async def change_password(
    db: AsyncSession, user: User, request: PasswordChangeRequest
) -> bool:
    """修改用户密码。"""
    if not verify_password(request.old_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="原密码错误")

    if not validate_password_strength(request.new_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="新密码不符合强度要求")

    user.password_hash = hash_password(request.new_password)
    await db.flush()
    return True
