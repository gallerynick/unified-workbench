"""WebSocket 端点：站内实时通知。"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from app.core.config import get_settings
from app.core.websocket import manager

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
) -> None:
    """WebSocket 端点，通过 query param 传递 JWT token。"""
    settings = get_settings()

    # 验证 token
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError):
        await websocket.close(code=4001, reason="Invalid token")
        return

    # 连接
    await manager.connect(user_id, websocket)

    try:
        # 发送连接成功消息
        await websocket.send_json({
            "type": "connected",
            "message": "连接成功",
        })

        # 保持连接，处理心跳
        while True:
            data = await websocket.receive_text()
            # 心跳：客户端发送 "ping"，服务端回复 "pong"
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(user_id)
