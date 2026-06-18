"""WebSocket 连接管理器。"""

from __future__ import annotations

import uuid

from fastapi import WebSocket


class ConnectionManager:
    """管理 WebSocket 连接。"""

    def __init__(self) -> None:
        self._connections: dict[uuid.UUID, WebSocket] = {}

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        """接受连接并存储。"""
        await websocket.accept()
        # 如果用户已有连接，关闭旧连接
        if user_id in self._connections:
            try:
                await self._connections[user_id].close()
            except Exception:  # noqa: BLE001
                pass
        self._connections[user_id] = websocket

    def disconnect(self, user_id: uuid.UUID) -> None:
        """移除连接。"""
        self._connections.pop(user_id, None)

    async def send_to_user(self, user_id: uuid.UUID, message: dict) -> None:
        """向指定用户发送消息。"""
        ws = self._connections.get(user_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception:  # noqa: BLE001
                self.disconnect(user_id)

    async def broadcast(self, message: dict) -> None:
        """向所有连接的用户广播消息。"""
        disconnected: list[uuid.UUID] = []
        for user_id, ws in self._connections.items():
            try:
                await ws.send_json(message)
            except Exception:  # noqa: BLE001
                disconnected.append(user_id)
        for uid in disconnected:
            self.disconnect(uid)

    @property
    def active_connections(self) -> int:
        """当前活跃连接数。"""
        return len(self._connections)


# 全局单例
manager = ConnectionManager()
