"""系统状态 API

聚合服务级状态，供前端「状态指示」使用。

边界约定：本端点只返回与「当前用户还能不能用」直接相关的服务状态
（数据库 / 文件存储 / 直播 / 定时任务）。磁盘容量、备份结果、
数据库迁移状态等服务端运维指标不进这里 —— 那些属于管理员视角，
应落在系统设置页而非用户界面。

需要登录态：匿名访客探测服务健康状况没有意义，反而会成为攻击者的
探测入口。
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.services import mediamtx
from app.services.session_activity import count_concurrent, get_current_session
from app.services.system_config import get_config
from app.tasks.heartbeat import HEARTBEAT_KEY
from app.utils.timeutil import now_shanghai, now_shanghai_iso

router = APIRouter(tags=["系统状态"])

# 心跳间隔 60s，超过 5 倍间隔视为定时任务不可用
HEARTBEAT_STALE_SECONDS = 5 * 60

OK = "ok"
UNAVAILABLE = "unavailable"

# 与 deps.get_current_user 共用同一个 Bearer 解析器实例
_bearer = HTTPBearer(auto_error=False)


async def _check_database(db: AsyncSession) -> str:
    """数据库连通性"""
    try:
        await db.execute(text("SELECT 1"))
        return OK
    except Exception:
        return UNAVAILABLE


def _check_storage_sync() -> str:
    """文件存储可用性：目录可创建、statvfs 可读、写入可完成。

    走同步实现并在调用方用 to_thread 执行，避免 NAS 挂载点卡顿
    阻塞事件循环。
    """
    path = get_settings().FILE_STORAGE_PATH
    try:
        os.makedirs(path, exist_ok=True)
        os.statvfs(path)
        probe = os.path.join(path, ".status_probe")
        with open(probe, "w", encoding="utf-8") as f:
            f.write("ok")
        os.remove(probe)
        return OK
    except Exception:
        return UNAVAILABLE


def _check_tasks_sync(last_beat_at: str | None) -> str:
    """定时任务存活：心跳时间戳是否仍新鲜"""
    if not last_beat_at:
        return UNAVAILABLE
    try:
        elapsed = (now_shanghai() - datetime.fromisoformat(last_beat_at)).total_seconds()
    except (TypeError, ValueError):
        return UNAVAILABLE
    return OK if elapsed <= HEARTBEAT_STALE_SECONDS else UNAVAILABLE


@router.get("/system/status")
async def api_system_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> UnifiedResponse[dict]:
    """聚合服务级状态，供前端状态指示使用。

    站点维护模式不在本端点返回 —— 它走 GET /system/site-config，
    该端点无需登录，登录页也需要读取，保持单一来源。
    """
    hb = await get_config(db, HEARTBEAT_KEY) or {}

    storage_task = asyncio.create_task(asyncio.to_thread(_check_storage_sync))
    stream_task = asyncio.create_task(mediamtx.ping())

    database = await _check_database(db)
    storage = await storage_task
    stream = OK if await stream_task else UNAVAILABLE
    tasks = _check_tasks_sync(hb.get("last_beat_at"))

    # F1 并发登录：多一次按 user_id 的索引查询，量级极小（单用户会话数）
    current_session = await get_current_session(db, current_user, credentials.credentials)
    concurrent = await count_concurrent(db, current_user, current_session)

    return UnifiedResponse(
        data={
            "services": {
                "database": database,
                "storage": storage,
                "stream": stream,
                "tasks": tasks,
            },
            "concurrent": concurrent,
            "server_time": now_shanghai_iso(),
        }
    )
