from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reminder import Reminder
from app.services.notification.dingtalk_channel import DingTalkChannel
from app.services.notification.email_channel import EmailChannel
from app.services.notification.feishu_channel import FeishuChannel
from app.services.notification.websocket_channel import WebSocketChannel
from app.services.notification.wecom_channel import WeComChannel
from app.services.system_config import get_config

logger = logging.getLogger(__name__)


async def dispatch_reminder(db: AsyncSession, reminder: Reminder) -> dict[str, bool]:
    """分发提醒到各渠道。返回各渠道的发送结果。"""
    results: dict[str, bool] = {}
    channels = reminder.channels or ["websocket"]
    target_users = [str(uid) for uid in (reminder.target_users or [])]

    for channel_name in channels:
        try:
            if channel_name == "websocket":
                channel = WebSocketChannel()
            elif channel_name == "feishu":
                config = await get_config(db, "notification")
                url = (config or {}).get("feishu_webhook_url", "")
                if not url:
                    results[channel_name] = False
                    continue
                channel = FeishuChannel(url)
            elif channel_name == "dingtalk":
                config = await get_config(db, "notification")
                url = (config or {}).get("dingtalk_webhook_url", "")
                if not url:
                    results[channel_name] = False
                    continue
                channel = DingTalkChannel(url)
            elif channel_name == "email":
                config = await get_config(db, "notification")
                smtp_host = (config or {}).get("smtp_host", "")
                if not smtp_host:
                    results[channel_name] = False
                    continue
                channel = EmailChannel(
                    smtp_host=smtp_host,
                    smtp_port=(config or {}).get("smtp_port", 587),
                    smtp_user=(config or {}).get("smtp_user", ""),
                    smtp_password=(config or {}).get("smtp_password", ""),
                    use_tls=(config or {}).get("smtp_use_tls", True),
                )
            elif channel_name == "wecom":
                config = await get_config(db, "notification")
                url = (config or {}).get("wecom_webhook_url", "")
                if not url:
                    results[channel_name] = False
                    continue
                channel = WeComChannel(url)
            else:
                results[channel_name] = False
                continue

            success = await channel.send(target_users, reminder.title, reminder.content or "")
            results[channel_name] = success
        except Exception as e:
            logger.exception(f"发送通知到 {channel_name} 失败: {e}")
            results[channel_name] = False

    return results
