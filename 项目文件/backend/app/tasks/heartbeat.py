"""Celery 心跳任务

定时写入心跳时间戳，供 GET /system/status 判定「提醒/定时任务服务」是否存活。
前端状态指示不直接探测 Celery，而是通过心跳新鲜度间接判定，避免暴露 broker 细节。
"""

from __future__ import annotations

import asyncio

from celery import shared_task

from app.core.database import isolated_session
from app.services.system_config import update_config
from app.utils.timeutil import now_shanghai_iso

# 心跳在 system_config 表中的键
HEARTBEAT_KEY = "task_heartbeat"


@shared_task(name="app.tasks.heartbeat.beat_heartbeat")
def beat_heartbeat() -> None:
    """每 60 秒写一次心跳时间戳"""
    asyncio.run(_beat_heartbeat_async())


async def _beat_heartbeat_async() -> None:
    """写入本次心跳时间戳。

    使用 isolated_session()（任务专用独立引擎）而非模块级单例引擎，原因见
    该函数 docstring——prefork 池下跨事件循环复用连接池会触发
    "attached to a different loop"。
    """
    async with isolated_session() as db:
        await update_config(db, HEARTBEAT_KEY, {"last_beat_at": now_shanghai_iso()})
