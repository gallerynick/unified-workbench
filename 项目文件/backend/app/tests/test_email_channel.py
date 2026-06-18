"""邮件通知渠道测试"""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.notification.email_channel import EmailChannel


@pytest.mark.asyncio
async def test_email_channel_send_success():
    """邮件发送成功返回 True。"""
    channel = EmailChannel("smtp.example.com", 587, "user@example.com", "password")
    with patch("aiosmtplib.SMTP") as mock_smtp:
        mock_instance = AsyncMock()
        mock_smtp.return_value.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_smtp.return_value.__aexit__ = AsyncMock()
        result = await channel.send(["user1"], "测试标题", "测试内容")
        assert result is True


@pytest.mark.asyncio
async def test_email_channel_send_failure():
    """邮件发送失败返回 False。"""
    channel = EmailChannel("smtp.example.com", 587, "user@example.com", "password")
    with patch("aiosmtplib.SMTP") as mock_smtp:
        mock_smtp.return_value.__aenter__ = AsyncMock(side_effect=Exception("连接失败"))
        result = await channel.send(["user1"], "测试标题", "测试内容")
        assert result is False
