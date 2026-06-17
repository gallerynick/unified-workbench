from __future__ import annotations

import httpx

from app.services.notification.base import NotificationChannel


class FeishuChannel(NotificationChannel):
    """通过飞书 Webhook 推送通知。"""

    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    async def send(self, user_ids: list[str], title: str, content: str) -> bool:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                self.webhook_url,
                json={
                    "msg_type": "interactive",
                    "card": {
                        "header": {"title": {"tag": "plain_text", "content": title}},
                        "elements": [
                            {
                                "tag": "div",
                                "text": {"tag": "plain_text", "content": content},
                            }
                        ],
                    },
                },
                timeout=10,
            )
            return resp.status_code == 200
