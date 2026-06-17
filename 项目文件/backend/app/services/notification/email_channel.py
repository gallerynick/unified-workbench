from __future__ import annotations

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.services.notification.base import NotificationChannel

logger = logging.getLogger(__name__)


class EmailChannel(NotificationChannel):
    """通过 SMTP 发送邮件通知。"""

    def __init__(
        self,
        smtp_host: str,
        smtp_port: int,
        smtp_user: str,
        smtp_password: str,
        use_tls: bool = True,
    ):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_user = smtp_user
        self.smtp_password = smtp_password
        self.use_tls = use_tls

    async def send(self, user_ids: list[str], title: str, content: str) -> bool:
        """发送邮件通知。

        Args:
            user_ids: 用户 ID 列表（当前简化为邮箱地址）。
            title: 邮件标题。
            content: 邮件正文（HTML 格式）。

        Returns:
            全部发送成功返回 True，否则返回 False。
        """
        try:
            msg = MIMEMultipart()
            msg["From"] = self.smtp_user
            msg["Subject"] = title
            msg.attach(MIMEText(content, "html", "utf-8"))

            async with aiosmtplib.SMTP(
                self.smtp_host, self.smtp_port, use_tls=self.use_tls
            ) as smtp:
                await smtp.login(self.smtp_user, self.smtp_password)
                for user_id in user_ids:
                    msg["To"] = user_id  # TODO: 替换为真实邮箱查询
                    await smtp.send_message(msg)
            return True
        except Exception as e:
            logger.exception(f"发送邮件失败: {e}")
            return False
