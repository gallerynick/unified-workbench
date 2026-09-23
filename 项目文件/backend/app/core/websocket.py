"""WebSocket 连接管理器。

同一用户可持有**多条**连接（多标签页、多设备、应用内多个 WS 实例）。

旧实现是 `dict[user_id, WebSocket]`，新连接会关掉旧连接。这在单设备时代无害，
但在「同一账号多台设备」场景下有两个后果：

1. 两台设备每 3 秒互相踢一次（前端断线后 3s 重连），连接反复抖动；
2. 新设备登录时旧设备的连接已被关掉，旧设备**收不到**「账号在其他设备登录」
   的推送。因此 F1 并发登录提示只能靠轮询，做不到实时。

改成 `dict[user_id, set[WebSocket]]` 后两个问题同时消失。推送语义不变：
通知与 room_kicked 都是「发给该用户的所有在线端」，多端同时收到是正确的
（同一个人打开两个标签页，两个标签页都该知道）。

真实推流不经过这里：RTMP 流在 MediaMTX 内处理，本模块的 `room_kicked`
只是告知原推流者「你被接管了」的一条通知。
"""

from __future__ import annotations

import uuid

from fastapi import WebSocket

# 并发会话集合变化事件（F1 实时推送）。前端收到后应立即重跑并发探测，
# 而不是等下一个轮询周期。负载为空：前端以服务端为准重新拉取计数。
SESSION_ALERT: dict = {"type": "session_alert"}


class ConnectionManager:
    """管理 WebSocket 连接（按用户分组，每用户多条）。"""

    def __init__(self) -> None:
        self._connections: dict[uuid.UUID, set[WebSocket]] = {}

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        """接受并登记一条连接，不与该用户的其他连接互斥。"""
        await websocket.accept()
        self._connections.setdefault(user_id, set()).add(websocket)

    def disconnect(self, user_id: uuid.UUID, websocket: WebSocket | None = None) -> None:
        """移除连接；`websocket` 为 None 时清空该用户的全部连接。"""
        conns = self._connections.get(user_id)
        if not conns:
            return
        if websocket is None:
            self._connections.pop(user_id, None)
            return
        conns.discard(websocket)
        if not conns:
            self._connections.pop(user_id, None)

    def user_connection_count(self, user_id: uuid.UUID) -> int:
        """该用户当前活跃连接数。"""
        return len(self._connections.get(user_id, ()))

    async def send_to_user(self, user_id: uuid.UUID, message: dict) -> int:
        """向该用户的全部连接发送，返回成功送达的连接数。"""
        return await self._send([w for w in self._connections.get(user_id, ())], user_id, message)

    async def send_to_user_except(
        self, user_id: uuid.UUID, message: dict, except_ws: WebSocket
    ) -> int:
        """向该用户除 `except_ws` 之外的全部连接发送。"""
        return await self._send(
            [w for w in self._connections.get(user_id, ()) if w is not except_ws],
            user_id,
            message,
        )

    async def _send(
        self, conns: list[WebSocket], user_id: uuid.UUID, message: dict
    ) -> int:
        dead: list[WebSocket] = []
        ok = 0
        for ws in conns:
            try:
                await ws.send_json(message)
                ok += 1
            except Exception:  # noqa: BLE001
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)
        return ok

    async def broadcast(self, message: dict) -> None:
        """向所有连接广播。"""
        dead: list[tuple[uuid.UUID, WebSocket]] = []
        for user_id, conns in list(self._connections.items()):
            for ws in list(conns):
                try:
                    await ws.send_json(message)
                except Exception:  # noqa: BLE001
                    dead.append((user_id, ws))
        for user_id, ws in dead:
            self.disconnect(user_id, ws)

    @property
    def active_connections(self) -> int:
        """当前活跃连接总数（按连接计，不按用户计）。"""
        return sum(len(c) for c in self._connections.values())

    @property
    def active_users(self) -> int:
        """当前持有至少一条活跃连接的用户数。"""
        return len(self._connections)


# 全局单例
manager = ConnectionManager()
