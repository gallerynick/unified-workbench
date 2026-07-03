"""直播间清理 Celery 定时任务"""

from __future__ import annotations

import asyncio
import os
from datetime import UTC, datetime, timedelta

from celery import shared_task
from sqlalchemy import String, cast, delete, update

from app.core.database import get_session_factory
from app.models.stream_room import StreamRoom, StreamRoomType
from app.services import mediamtx


def _get_temp_room_ttl() -> int:
    """从环境变量读取临时房间 TTL（分钟），默认 30"""
    try:
        return int(os.getenv("TEMP_ROOM_TTL_MINUTES", "30"))
    except ValueError:
        return 30


@shared_task
def sync_room_active_status() -> None:
    """同步直播间活跃状态：每隔 60 秒轮询 MediaMTX 活跃路径，批量更新 stream_room.is_active"""
    asyncio.run(_sync_room_active_status_async())


async def _sync_room_active_status_async() -> None:
    session_factory = get_session_factory()
    async with session_factory() as db:
        active_paths = await mediamtx.get_active_paths()
        now = datetime.now(UTC)

        if active_paths:
            # 将 stream_room 的 UUID 列转为字符串与 path 比较
            id_col = cast(StreamRoom.id, String)
            # 将正在推流的房间标记为活跃
            await db.execute(
                update(StreamRoom)
                .where(id_col.in_(active_paths), ~StreamRoom.is_active)
                .values(is_active=True)
            )

        # 将不在活跃路径中且当前标记为活跃的房间取消标记，同时记录最后活跃时间
        if active_paths:
            await db.execute(
                update(StreamRoom)
                .where(
                    cast(StreamRoom.id, String).notin_(active_paths),
                    StreamRoom.is_active,
                )
                .values(is_active=False, last_active_at=now)
            )
        else:
            # 没有活跃路径时，将所有标记为活跃的房间重置
            await db.execute(
                update(StreamRoom)
                .where(StreamRoom.is_active)
                .values(is_active=False, last_active_at=now)
            )

        await db.commit()


@shared_task
def cleanup_temporary_rooms() -> None:
    """清理过期临时房间：每 5 分钟删除不活跃超过 TTL 的 temporary 类型房间"""
    asyncio.run(_cleanup_temporary_rooms_async())


async def _cleanup_temporary_rooms_async() -> None:
    session_factory = get_session_factory()
    async with session_factory() as db:
        ttl_minutes = _get_temp_room_ttl()
        cutoff = datetime.now(UTC) - timedelta(minutes=ttl_minutes)

        await db.execute(
            delete(StreamRoom).where(
                StreamRoom.room_type == StreamRoomType.TEMPORARY,
                ~StreamRoom.is_active,
                (StreamRoom.last_active_at < cutoff) | (StreamRoom.last_active_at.is_(None)),
            )
        )

        await db.commit()
