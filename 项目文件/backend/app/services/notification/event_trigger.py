from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession


async def trigger_event_reminders(
    db: AsyncSession,
    event_type: str,
    context: dict,
) -> None:
    """触发事件类型的提醒。

    注意：EVENT 触发类型已从提醒系统中移除，
    此函数保留以保持 secret.py 兼容性，不再执行实际查询。
    """
    # EVENT 触发类型已移除，无待匹配的提醒
    return
