"""直播间 API 路由。"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.stream_room import (
    StreamRoomCreate,
    StreamRoomListResponse,
    StreamRoomResponse,
    StreamRoomUpdate,
)
from app.services.stream_room import (
    create_room,
    delete_room,
    get_room,
    get_room_status,
    list_rooms,
    takeover_room,
    update_room,
)

router = APIRouter()


@router.post("", response_model=UnifiedResponse[StreamRoomResponse])
async def create_room_endpoint(
    data: StreamRoomCreate,
    req: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建直播间。"""
    host = req.headers.get("x-forwarded-host") or req.base_url.hostname or "localhost"
    room = await create_room(db, current_user.id, data, host)
    return UnifiedResponse(data=room)


@router.get("", response_model=UnifiedResponse[StreamRoomListResponse])
async def list_rooms_endpoint(
    req: Request,
    room_type: str | None = None,
    mode: str | None = None,
    is_open: bool | None = None,
    is_active: bool | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """查询直播间列表，支持按类型/模式/状态过滤。"""
    filters = {
        k: v
        for k, v in {
            "room_type": room_type,
            "mode": mode,
            "is_open": is_open,
            "is_active": is_active,
        }.items()
        if v is not None
    }
    host = req.headers.get("x-forwarded-host") or req.base_url.hostname or "localhost"
    rooms = await list_rooms(db, current_user.id, filters, host)
    return UnifiedResponse(data=rooms)


@router.get("/{room_id}", response_model=UnifiedResponse[StreamRoomResponse])
async def get_room_endpoint(
    room_id: uuid.UUID,
    req: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """根据 ID 获取直播间。"""
    host = req.headers.get("x-forwarded-host") or req.base_url.hostname or "localhost"
    room = await get_room(db, room_id, host)
    return UnifiedResponse(data=room)


@router.put("/{room_id}", response_model=UnifiedResponse[StreamRoomResponse])
async def update_room_endpoint(
    room_id: uuid.UUID,
    data: StreamRoomUpdate,
    req: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新直播间（仅创建者可更新）。"""
    host = req.headers.get("x-forwarded-host") or req.base_url.hostname or "localhost"
    room = await update_room(db, room_id, current_user.id, data, host)
    return UnifiedResponse(data=room)


@router.delete("/{room_id}", response_model=UnifiedResponse[None])
async def delete_room_endpoint(
    room_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除直播间（仅创建者可删除）。"""
    await delete_room(db, room_id, current_user.id)
    return UnifiedResponse(msg="房间已删除")


@router.post("/{room_id}/takeover", response_model=UnifiedResponse[StreamRoomResponse])
async def takeover_room_endpoint(
    room_id: uuid.UUID,
    req: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """接管直播间（接管后自动开始推流）。"""
    host = req.headers.get("x-forwarded-host") or req.base_url.hostname or "localhost"
    room = await takeover_room(db, room_id, current_user.id, host)
    return UnifiedResponse(data=room, msg="已接管推流")


@router.get("/{room_id}/status", response_model=UnifiedResponse[dict])
async def get_room_status_endpoint(
    room_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取直播间状态（推流者昵称、活跃状态等）。"""
    status = await get_room_status(db, room_id)
    return UnifiedResponse(data=status)
