from __future__ import annotations

import logging

import httpx

from app.services.notification.base import NotificationChannel

logger = logging.getLogger(__name__)


class WeComChannel(NotificationChannel):
    """通过企业微信 Webhook 推送通知。"""

    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    async def send(self, user_ids: list[str], title: str, content: str) -> bool:
        """发送企业微信通知。

        Args:
            user_ids: 用户 ID 列表（Webhook 模式下为全员推送，此参数暂未使用）。
            title: 消息标题。
            content: 消息正文（Markdown 格式）。

        Returns:
            发送成功返回 True，否则返回 False。
        """
        try:
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
        except Exception as e:
            logger.exception(f"发送企业微信消息失败: {e}")
            return False
