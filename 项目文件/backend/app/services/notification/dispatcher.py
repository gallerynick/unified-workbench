from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.channel_registry import get_channel
from app.models.notification import Notification
from app.models.reminder import Reminder
from app.models.user_notification_config import UserNotificationConfig
from app.services.notification.feishu_channel import FeishuChannel
from app.services.notification.websocket_channel import WebSocketChannel
from app.services.notification.wecom_channel import WeComChannel

logger = logging.getLogger(__name__)


async def _get_user_channels(db: AsyncSession, user_id: uuid.UUID) -> list[str]:
    """获取用户启用的通知渠道（站内通知始终包含）。"""
    result = await db.execute(
        select(UserNotificationConfig).where(UserNotificationConfig.user_id == user_id)
    )
    config = result.scalar_one_or_none()
    enabled = config.enabled_channels if config else []
    return ["websocket"] + [c for c in enabled if c != "websocket"]


async def dispatch_reminder(db: AsyncSession, reminder: Reminder) -> dict[str, bool]:
    """按每个目标用户的个人通知配置分发提醒。"""
    results: dict[str, bool] = {}
    target_users = [str(uid) for uid in (reminder.target_users or [])]

    for uid_str in target_users:
        uid = uuid.UUID(uid_str)
        channel_ids = await _get_user_channels(db, uid)

        for channel_id in channel_ids:
            key = f"{uid_str}:{channel_id}"
            try:
                ch = get_channel(channel_id)
                if ch is None:
                    results[key] = False
                    continue

                if channel_id == "websocket":
                    channel = WebSocketChannel()
                    db.add(Notification(
                        id=uuid.uuid4(),
                        user_id=uid,
                        message=f"提醒：{reminder.title}" if not reminder.content else f"提醒：{reminder.title}\n{reminder.content}",
                        type="reminder",
                        read=False,
                    ))

                elif channel_id == "feishu":
                    result = await db.execute(
                        select(UserNotificationConfig).where(UserNotificationConfig.user_id == uid)
                    )
                    uc = result.scalar_one_or_none()
                    url = uc.feishu_webhook_url if uc else None
                    if not url:
                        results[key] = False
                        continue
                    channel = FeishuChannel(url)

                elif channel_id == "wecom":
                    result = await db.execute(
                        select(UserNotificationConfig).where(UserNotificationConfig.user_id == uid)
                    )
                    uc = result.scalar_one_or_none()
                    url = uc.wecom_webhook_url if uc else None
                    if not url:
                        results[key] = False
                        continue
                    channel = WeComChannel(url)

                elif channel_id == "email":
                    result = await db.execute(
                        select(UserNotificationConfig).where(UserNotificationConfig.user_id == uid)
                    )
                    uc = result.scalar_one_or_none()
                    if not uc or not uc.email_enabled or not uc.smtp_host:
                        results[key] = False
                        continue
                    from app.services.notification.email_channel import EmailChannel
                    channel = EmailChannel(
                        smtp_host=uc.smtp_host,
                        smtp_port=uc.smtp_port or 587,
                        smtp_user=uc.smtp_user or "",
                        smtp_password=uc.smtp_password or "",
                        use_tls=uc.smtp_use_tls if uc.smtp_use_tls is not None else True,
                    )
                else:
                    results[key] = False
                    continue

                success = await channel.send([uid_str], reminder.title, reminder.content or "")
                results[key] = success
            except Exception as e:
                logger.exception(f"发送通知到 {channel_id} (user={uid_str}) 失败: {e}")
                results[key] = False

    return results
