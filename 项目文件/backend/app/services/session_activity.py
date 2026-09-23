"""会话活跃度统计。

供「并发登录」状态提示（F1）使用：统计当前用户在过去一段时间内的
其他在线会话，按 IP 与设备去重计数。

本模块被两个端点复用：
- GET /system/status        → data.concurrent（全量状态聚合，60s 轮询）
- GET /me/concurrent        → 仅并发统计（轻量，供前端高频轮询）

拆成独立模块的原因：并发登录属于安全语义，需要秒级响应，
不能只挂在带存储/推流探测的全量状态端点上（那个端点还做
os.statvfs 与写入探针，不适合高频调用）。
"""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.models.user import User
from app.models.user_session import UserSession
from app.utils.timeutil import now_shanghai

# 距今 N 分钟内「最后活跃过」的未撤销会话视为「其他在线会话」。
# 活跃时间由 core.deps.get_current_user 按请求刷新（节流 60s），因此正在使用的
# 标签页会一直留在窗口内；真正关闭的浏览器会在窗口到期后自然淡出，不再提示。
# 前端阈值表需与此保持一致（useStatusProbes.ts）。
CONCURRENT_RECENT_MINUTES = 30


async def get_current_session(
    db: AsyncSession, user: User, token: str | None
) -> UserSession | None:
    """按 JWT 的 jti 反查当前会话记录，用于把「自己」从并发统计里排除。

    token 为空或 jti 查不到记录时返回 None。此时统计退化为
    「全部未撤销会话」——宁可提示也不漏提示。
    """
    if not token:
        return None
    try:
        jti = decode_token(token).get("jti")
    except Exception:
        return None
    if not jti:
        return None
    result = await db.execute(
        select(UserSession).where(
            UserSession.user_id == user.id,
            UserSession.jti == jti,
            UserSession.is_revoked == False,  # noqa: E712
        )
    )
    return result.scalar_one_or_none()


async def count_concurrent(
    db: AsyncSession, user: User, current: UserSession | None
) -> dict:
    """统计「其他在线会话」的数量。

    返回三个计数字段：
      other_session_count —— 其他会话总数
      other_ip_count      —— 其他会话涉及的不同 IP 数（>0 即存在异地登录）
      other_device_count  —— 其他会话涉及的不同设备数（>0 即存在多设备登录）

    同一设备新开标签页不会产生提示：新会话与当前会话同 IP、同 device_token，
    两个去重计数都为 0。
    """
    # 窗口基准是「最后活跃时间」而非「创建时间」。
    # 用 created_at 会让登录满 30 分钟的标签页被静默排除：会话还在、令牌有效、
    # 页面还在轮询，但并发统计再也看不到它——两个都开了半小时的连接会互相
    # 认为对方不在线。活跃时间由 core.deps 按请求刷新，正在使用的会话因此
    # 持续落在窗口内。
    #
    # coalesce 回退到 created_at：last_active_at 由 server_default 生成，正常
    # 不会为空，但老数据或外部插入可能为空，回退可避免整行被漏统计。
    active_at = func.coalesce(UserSession.last_active_at, UserSession.created_at)
    cutoff = now_shanghai() - timedelta(minutes=CONCURRENT_RECENT_MINUTES)
    conds = [
        UserSession.user_id == user.id,
        UserSession.is_revoked == False,  # noqa: E712
        active_at >= cutoff,
    ]
    if current is not None:
        conds.append(UserSession.jti != current.jti)

    rows = (await db.execute(select(UserSession).where(*conds))).scalars().all()

    ips = {s.ip_address for s in rows if s.ip_address}
    devices = {s.device_token for s in rows if s.device_token}
    if current is not None:
        # 当前会话自己的 IP / 设备不计入「其他」
        if current.ip_address in ips:
            ips.discard(current.ip_address)
        if current.device_token in devices:
            devices.discard(current.device_token)

    return {
        "other_session_count": len(rows),
        "other_ip_count": len(ips),
        "other_device_count": len(devices),
    }
