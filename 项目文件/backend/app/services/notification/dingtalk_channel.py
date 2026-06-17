from __future__ import annotations

import httpx

from app.services.notification.base import NotificationChannel


class DingTalkChannel(NotificationChannel):
    """通过钉钉 Webhook 推送通知。"""

    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    async def send(self, user_ids: list[str], title: str, content: str) -> bool:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                self.webhook_url,
                json={
                    "msgtype": "markdown",
                    "markdown": {
                        "title": title,
                        "text": f"## {title}\n\n{content}",
                    },
                },
                timeout=10,
            )
            return resp.status_code == 200
