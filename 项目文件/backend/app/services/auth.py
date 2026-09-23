"""认证业务逻辑。"""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_pending_2fa_token,
    create_refresh_token,
    decode_token,
    hash_password,
    validate_password_strength,
    verify_password,
)
from app.core.websocket import SESSION_ALERT, manager
from app.models.user import User, UserStatus
from app.models.user_session import UserSession
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    PasswordChangeRequest,
    RefreshRequest,
    TokenResponse,
    Verify2FARequest,
)
from app.services import two_factor

# 登录失败限制配置
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION = 3  # 3 秒


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


async def _enforce_single_device(
    db: AsyncSession,
    user: User,
    allow_multiple_logins: bool,
    device_token: str | None = None,
) -> tuple[int, int]:
    """按「允许多处同时登录」偏好处理已有会话，返回 (其他设备会话数, 已下线数)。

    语义：返回的「其他设备会话数」只统计 device_token 与本次登录不同的会话
    （即真正来自其他浏览器的登录；历史遗留的无 device_token 会话也计入，防漏报）。
    同一浏览器（device_token 相同）的历史会话不算「其他设备」——
    它们通常只是用户在本浏览器反复重新登录留下的幽灵会话，下线的确会发生，
    但不该在前端被提示为「已在其他设备登录」。

    关闭「允许多处同时登录」时全部下线（含同浏览器旧会话，保持严格单设备语义）；
    开启时只统计不下线。本会话尚未落库，查询结果天然不含本次登录。
    """
    rows = (
        await db.execute(
            select(UserSession).where(
                UserSession.user_id == user.id,
                UserSession.is_revoked == False,  # noqa: E712
            )
        )
    ).scalars().all()

    # 本次登录的设备标识规范化：空串视为未携带
    current_token = device_token or None
    other_device_count = sum(
        1 for s in rows if s.device_token != current_token
    )
    if allow_multiple_logins or not rows:
        return other_device_count, 0

    for s in rows:
        s.is_revoked = True
    await db.commit()
    return other_device_count, len(rows)


async def _issue_tokens(
    db: AsyncSession,
    user: User,
    ip: str | None = None,
    user_agent: str | None = None,
    device_token: str | None = None,
) -> LoginResponse:
    """为已通过全部认证的用户签发令牌并创建登录会话。"""
    access_token = create_access_token(str(user.id), user.role.value)
    payload = decode_token(access_token)
    jti = payload.get("jti", "")

    # 单设备登录：用户关闭「允许多处同时登录」时，新登录下线其全部其他会话。
    # 在这里做而不是在路由层：login / verify_2fa / WebAuthn 三条路径都汇聚到此，
    # 放这里才能保证任何登录方式都遵守同一策略。
    prefs = user.preferences or {}
    other_session_count, revoked_session_count = await _enforce_single_device(
        db, user, prefs.get("allow_multiple_logins", True), device_token
    )

    # 刷新令牌携带同一个 jti：刷新必须能回到这条会话行，否则换出来的新访问
    # 令牌的 jti 在 user_session 里查不到，登出与单设备下线都会被一次刷新绕过。
    refresh_token = create_refresh_token(str(user.id), jti)

    device_name, device_type = _parse_user_agent(user_agent or "")
    session = UserSession(
        user_id=user.id,
        jti=jti,
        device_name=device_name,
        device_type=device_type,
        ip_address=ip,
        user_agent=user_agent,
        device_token=device_token or None,
    )
    db.add(session)
    await db.commit()

    # F1 并发登录提示的实时推送：本会话已落库，立刻通知该用户其余在线连接。
    # 收端的 WebSocket 会在挂载时自行探测，不需要等推送，但先收到推送能省一次轮询等待。
    # 推送只是体验优化，失败不影响发令牌（推送不成功的场景由 10s 轮询兜底）。
    try:
        await manager.send_to_user(user.id, SESSION_ALERT)
    except Exception:  # noqa: BLE001
        pass

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        other_session_count=other_session_count,
        revoked_session_count=revoked_session_count,
    )


async def login(
    db: AsyncSession,
    request: LoginRequest,
    ip: str | None = None,
    user_agent: str | None = None,
    device_token: str | None = None,
) -> LoginResponse:
    """用户登录第一步：验证账号密码。

    若用户已启用 2FA（绑定过 TOTP 设备），不直接签发正式令牌，
    而是返回短期 pending 令牌，交由 verify_2fa 完成第二步验证。

    Args:
        db: 数据库会话。
        request: 登录请求。
        ip: 客户端 IP 地址。
        user_agent: 客户端 User-Agent。
        device_token: 设备标识符，前端生成的 UUID，用于设备分组统计。
    """
    await _check_login_rate_limit(request.username, ip)

    result = await db.execute(select(User).where(User.username == request.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.password_hash):
        await _record_login_failure(request.username)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")

    if user.status == UserStatus.DISABLED:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号已被禁用")

    await _clear_login_attempts(request.username)

    if await two_factor.has_active_devices(db, user.id):
        # 已启用 2FA：进入第二步，暂不创建会话
        pending_token = create_pending_2fa_token(str(user.id))
        return LoginResponse(pending_2fa=True, pending_token=pending_token)

    return await _issue_tokens(db, user, ip, user_agent, device_token)


async def verify_2fa(
    db: AsyncSession,
    request: Verify2FARequest,
    ip: str | None = None,
    user_agent: str | None = None,
    device_token: str | None = None,
) -> LoginResponse:
    """登录第二步：用动态码或恢复码完成二次验证，签发正式令牌。"""
    try:
        payload = decode_token(request.pending_token)
        if payload.get("type") != "pending_2fa":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的二次验证令牌"
            )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的二次验证令牌"
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="二次验证已过期，请重新登录"
        )

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or user.status == UserStatus.DISABLED:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在或已禁用"
        )

    code = request.code.strip()
    device = await two_factor.verify_and_get_device(db, user.id, code)
    if device is not None:
        await two_factor.mark_device_used(db, device)
    elif not await two_factor.verify_recovery_code(db, user.id, code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="动态码或恢复码错误"
        )

    return await _issue_tokens(db, user, ip, user_agent, device_token)




async def verify_2fa_webauthn(
    db: AsyncSession,
    request: dict,
    ip: str | None = None,
    user_agent: str | None = None,
    device_token: str | None = None,
) -> LoginResponse:
    """登录第二步：用 WebAuthn（指纹/面容）完成二次验证，签发正式令牌。"""
    from app.services import webauthn_service

    # 验证 pending token
    try:
        payload = decode_token(request.get("pending_token", ""))
        if payload.get("type") != "pending_2fa":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的二次验证令牌"
            )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的二次验证令牌"
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="二次验证已过期，请重新登录"
        )

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or user.status == UserStatus.DISABLED:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在或已禁用"
        )

    # 验证 WebAuthn 签名
    credential = await webauthn_service.verify_authentication(
        db,
        request["credential_id"],
        request["raw_id"],
        request["response"],
        request["client_json"],
    )
    if not credential or credential.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="WebAuthn 验证失败"
        )

    return await _issue_tokens(db, user, ip, user_agent, device_token)

def _parse_user_agent(ua: str) -> tuple[str, str]:
    """从 User-Agent 解析设备名称和类型。"""
    ua_lower = ua.lower()
    if "iphone" in ua_lower or "android" in ua_lower and "mobile" in ua_lower:
        device_type = "mobile"
    elif "ipad" in ua_lower or "tablet" in ua_lower:
        device_type = "tablet"
    else:
        device_type = "desktop"

    parts = []
    if "mac os x" in ua_lower:
        parts.append("macOS")
    elif "windows nt" in ua_lower:
        parts.append("Windows")
    elif "linux" in ua_lower:
        parts.append("Linux")
    if "chrome" in ua_lower:
        parts.append("Chrome")
    elif "firefox" in ua_lower:
        parts.append("Firefox")
    elif "safari" in ua_lower and "chrome" not in ua_lower:
        parts.append("Safari")
    elif "edg" in ua_lower:
        parts.append("Edge")

    device_name = " ".join(parts) if parts else ua[:50]
    return device_name, device_type


async def refresh_access_token(db: AsyncSession, request: RefreshRequest) -> TokenResponse:
    """用刷新令牌换取新的访问令牌。

    新访问令牌复用刷新令牌里的 jti（即原登录会话的 jti），不新建会话行：
    会话行是「一次登录」的唯一标识，登出与「仅允许一处登录」的强制下线都按它
    生效；刷新只轮换凭证，不改变会话身份。

    必须校验会话行仍存在且未被撤销，否则被登出 / 被下线的设备只要刷新一次就
    能复活，is_revoked 形同虚设。
    """
    try:
        payload = decode_token(request.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的刷新令牌")

        user_id = payload.get("sub")
        jti = payload.get("jti")
        if not user_id or not jti:
            # 历史刷新令牌没有 jti，无法绑定会话行，只能重新登录。
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="请重新登录"
            )

        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()

        if not user or user.status == UserStatus.DISABLED:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在或已禁用"
            )

        session = (
            await db.execute(
                select(UserSession).where(
                    UserSession.user_id == user.id,
                    UserSession.jti == jti,
                    UserSession.is_revoked == False,  # noqa: E712
                )
            )
        ).scalar_one_or_none()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="会话已失效，请重新登录"
            )

        access_token = create_access_token(str(user.id), user.role.value, jti)
        refresh_token = create_refresh_token(str(user.id), jti)

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
