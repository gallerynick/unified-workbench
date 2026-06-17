from __future__ import annotations

from abc import ABC, abstractmethod


class NotificationChannel(ABC):
    """通知渠道基类。"""

    @abstractmethod
    async def send(self, user_ids: list[str], title: str, content: str) -> bool:
        """发送通知。返回是否成功。"""
        ...
