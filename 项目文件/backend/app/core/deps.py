"""FastAPI 依赖注入：认证与权限。"""

import uuid
from datetime import timedelta

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole
from app.models.user_session import UserSession
from app.utils.timeutil import now_shanghai

security = HTTPBearer()

# 会话活跃时间的刷新节流间隔（秒）。
#
# 并发登录提示（F1）靠 user_session.last_active_at 判断「这个登录还活着吗」。
# 每个受保护请求都会经过 get_current_user，但只需约每分钟刷一次就够，
# 否则前端 10s 一次的 F1 轮询会把写放大到每个请求一次。
# 该值必须明显小于 session_activity.CONCURRENT_RECENT_MINUTES（30 分钟），
# 否则正在使用的标签页会被误判为已离开。
SESSION_ACTIVE_REFRESH_SECONDS = 60


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """从 Authorization header 解析 JWT，返回当前用户。"""
    try:
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        jti = payload.get("jti", "")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的令牌"
            )

        # 一次查询同时取到「是否被撤销」和会话本身。会话需要在这里刷新
        # last_active_at（见 SESSION_ACTIVE_REFRESH_SECONDS），否则要再多一次往返。
        session: UserSession | None = None
        user: User | None = None
        if jti:
            pair = await db.execute(
                select(UserSession, User).join(
                    User, User.id == UserSession.user_id
                ).where(UserSession.jti == jti)
            )
            row = pair.one_or_none()
            if row:
                session, user = row
                if session.is_revoked:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="会话已被撤销，请重新登录",
                    )
            else:
                # jti 在 user_session 里查不到：要么会话已被撤销，要么是历史
                # 遗留的「刷新孤儿令牌」（旧版刷新只换凭证、不更新会话行）。
                # 一律拒绝，不能退回按 sub 放行——否则登出与「仅允许一处登录」
                # 的强制下线都能被一次刷新绕过，并发会话统计也会失真。
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="会话已失效，请重新登录",
                )
        else:
            # 令牌里没有 jti（历史令牌或未绑定会话）时退回按 user_id 查用户，
            # 行为与改造前一致。
            result = await db.execute(
                select(User).where(User.id == uuid.UUID(user_id))
            )
            user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在"
            )

        # 刷新会话活跃时间。节流窗口内不重复写。
        # 这一行是让 F1 能长期正确工作的关键：不刷新时 last_active_at 停在
        # 登录那一刻，任何登录超过 30 分钟就会被并发统计当成「已离开」。
        if session is not None and (
            session.last_active_at is None
            or session.last_active_at
            < now_shanghai() - timedelta(seconds=SESSION_ACTIVE_REFRESH_SECONDS)
        ):
            session.last_active_at = now_shanghai()

        return user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的令牌"
        )


async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """与 get_current_user 相同，但无令牌时返回 None 而不是 401。"""
    token = (
        request.cookies.get("access_token")
        or request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    )
    if not token:
        return None
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            return None
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        return result.scalar_one_or_none()
    except Exception:
        return None


def require_role(*roles: UserRole):
    """角色权限检查依赖工厂。"""

    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="权限不足"
            )
        return current_user

    return role_checker


require_admin = require_role(UserRole.ADMIN)
