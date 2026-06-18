from __future__ import annotations

import uuid

from app.core.websocket import manager
from app.services.notification.base import NotificationChannel


class WebSocketChannel(NotificationChannel):
    """通过 WebSocket 推送通知。"""

    async def send(self, user_ids: list[str], title: str, content: str) -> bool:
        message = {
            "type": "notification",
            "title": title,
            "content": content,
        }
        for uid in user_ids:
            await manager.send_to_user(uuid.UUID(uid), message)
        return True
