"""直播间服务"""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.websocket import manager
from app.models.stream_room import StreamRoom, StreamRoomMode, StreamRoomType
from app.models.user import User
from app.schemas.stream_room import (
    StreamRoomCreate,
    StreamRoomListResponse,
    StreamRoomResponse,
    StreamRoomUpdate,
)
from app.services.audit import log_audit
from app.services.mediamtx import get_active_paths


def get_room_urls(room_id: str, host: str) -> dict:
    """生成房间推流/观看地址"""
    return {
        "push_url": f"http://{host}:8889/{room_id}/whip",
        "watch_url": f"http://{host}:8889/{room_id}",
        "rtmp_url": f"rtmp://{host}:1935/{room_id}",
    }


async def _build_response(room: StreamRoom, host: str, active_paths: set[str] | None = None) -> StreamRoomResponse:
    """构建直播间响应（含 nickname、URL、实时活跃状态）"""
    urls = get_room_urls(str(room.id), host)
    room_id_str = str(room.id)
    is_active = room_id_str in active_paths if active_paths is not None else room.is_active
    return StreamRoomResponse(
        id=room.id,
        name=room.name,
        creator_id=room.creator_id,
        creator_nickname=room.creator.nickname,
        mode=room.mode.value,
        room_type=room.room_type.value,
        config=room.config,
        is_open=room.is_open,
        is_active=is_active,
        pusher_id=room.pusher_id,
        pusher_nickname=room.pusher.nickname if room.pusher else None,
        last_active_at=room.last_active_at,
        created_at=room.created_at,
        push_url=urls["push_url"],
        watch_url=urls["watch_url"],
        rtmp_url=urls["rtmp_url"],
    )


async def create_room(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: StreamRoomCreate,
    host: str,
) -> StreamRoomResponse:
    """创建直播间"""
    room = StreamRoom(
        name=data.name,
        creator_id=user_id,
        mode=StreamRoomMode(data.mode),
        room_type=StreamRoomType(data.room_type),
        config=data.config.model_dump() if data.config else None,
        is_open=data.is_open,
    )
    db.add(room)
    await db.flush()
    await log_audit(db, user_id, "create_room", "stream_room", str(room.id))
    await db.refresh(room)
    return await _build_response(room, host)


async def get_room(
    db: AsyncSession,
    room_id: uuid.UUID,
    host: str,
) -> StreamRoomResponse:
    """根据 ID 获取直播间（is_active 来自 MediaMTX 实时数据）"""
    result = await db.execute(select(StreamRoom).where(StreamRoom.id == room_id))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="直播间不存在"
        )
    active_paths = set(await get_active_paths())
    return await _build_response(room, host, active_paths)


async def list_rooms(
    db: AsyncSession,
    user_id: uuid.UUID,
    filters: dict,
    host: str,
) -> StreamRoomListResponse:
    """查询直播间列表，支持过滤"""
    query = select(StreamRoom)
    count_query = select(func.count(StreamRoom.id))

    if "room_type" in filters and filters["room_type"]:
        query = query.where(StreamRoom.room_type == filters["room_type"])
        count_query = count_query.where(StreamRoom.room_type == filters["room_type"])
    if "mode" in filters and filters["mode"]:
        query = query.where(StreamRoom.mode == filters["mode"])
        count_query = count_query.where(StreamRoom.mode == filters["mode"])
    if "is_open" in filters and filters["is_open"] is not None:
        query = query.where(StreamRoom.is_open == filters["is_open"])
        count_query = count_query.where(StreamRoom.is_open == filters["is_open"])
    if "is_active" in filters and filters["is_active"] is not None:
        query = query.where(StreamRoom.is_active == filters["is_active"])
        count_query = count_query.where(StreamRoom.is_active == filters["is_active"])

    query = query.order_by(StreamRoom.created_at.desc())

    result = await db.execute(query)
    count_result = await db.execute(count_query)

    rooms = list(result.scalars().all())
    total = count_result.scalar() or 0

    active_paths = set(await get_active_paths())
    items = [await _build_response(room, host, active_paths) for room in rooms]
    return StreamRoomListResponse(items=items, total=total)


async def update_room(
    db: AsyncSession,
    room_id: uuid.UUID,
    user_id: uuid.UUID,
    data: StreamRoomUpdate,
    host: str,
) -> StreamRoomResponse:
    """更新直播间（仅创建者可更新）"""
    result = await db.execute(select(StreamRoom).where(StreamRoom.id == room_id))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="直播间不存在"
        )
    if room.creator_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="仅创建者可更新直播间"
        )

    if data.name is not None:
        room.name = data.name
    if data.mode is not None:
        room.mode = StreamRoomMode(data.mode)
    if data.room_type is not None:
        room.room_type = StreamRoomType(data.room_type)
    if data.config is not None:
        room.config = data.config.model_dump()
    if data.is_open is not None:
        room.is_open = data.is_open
    if data.is_active is not None:
        room.is_active = data.is_active

    await db.flush()
    await log_audit(db, user_id, "update_room", "stream_room", str(room.id))
    await db.refresh(room)
    return await _build_response(room, host)


async def delete_room(
    db: AsyncSession,
    room_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    """删除直播间（仅创建者可删除）"""
    result = await db.execute(select(StreamRoom).where(StreamRoom.id == room_id))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="直播间不存在"
        )
    if room.creator_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="仅创建者可删除直播间"
        )

    await db.delete(room)
    await db.flush()
    await log_audit(db, user_id, "delete_room", "stream_room", str(room_id))


async def takeover_room(
    db: AsyncSession,
    room_id: uuid.UUID,
    new_user_id: uuid.UUID,
    host: str,
) -> StreamRoomResponse:
    """接管直播间（使用行级锁保证并发安全）"""
    stmt = select(StreamRoom).where(StreamRoom.id == room_id).with_for_update()
    result = await db.execute(stmt)
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="直播间不存在"
        )

    old_pusher_id = room.pusher_id
    room.pusher_id = new_user_id
    room.is_active = True
    room.last_active_at = datetime.utcnow()

    await db.flush()

    if old_pusher_id and old_pusher_id != new_user_id:
        new_user = await db.execute(select(User).where(User.id == new_user_id))
        new_user_obj = new_user.scalar_one_or_none()
        await manager.send_to_user(old_pusher_id, {
            "type": "room_kicked",
            "room_id": str(room.id),
            "nickname": new_user_obj.nickname if new_user_obj else "其他用户",
        })

    await log_audit(db, new_user_id, "takeover_room", "stream_room", str(room.id))
    await db.refresh(room)
    return await _build_response(room, host)


async def get_room_status(
    db: AsyncSession,
    room_id: uuid.UUID,
) -> dict:
    """获取直播间状态（MediaMTX 实时数据 + DB 推流者昵称）"""
    result = await db.execute(
        select(
            StreamRoom.pusher_id,
            User.nickname,
        )
        .join(User, StreamRoom.pusher_id == User.id, isouter=True)
        .where(StreamRoom.id == room_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="直播间不存在"
        )

    # 直接查询 MediaMTX 获取实时推流状态
    from app.services.mediamtx import is_path_active
    is_active = await is_path_active(str(room_id))

    return {
        "is_active": is_active,
        "pusher_id": row.pusher_id,
        "pusher_nickname": row.nickname,
    }
