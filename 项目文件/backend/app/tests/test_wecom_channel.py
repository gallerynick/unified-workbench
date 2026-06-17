"""企业微信通知渠道测试"""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.notification.wecom_channel import WeComChannel


@pytest.mark.asyncio
async def test_wecom_channel_send_success():
    """企微发送成功返回 True。"""
    channel = WeComChannel("https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test")
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = AsyncMock(status_code=200)
        result = await channel.send(["user1"], "测试标题", "测试内容")
        assert result is True


@pytest.mark.asyncio
async def test_wecom_channel_send_failure():
    """企微发送失败返回 False。"""
    channel = WeComChannel("https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test")
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = AsyncMock(status_code=500)
        result = await channel.send(["user1"], "测试标题", "测试内容")
        assert result is False
