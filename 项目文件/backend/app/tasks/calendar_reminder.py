"""日历事件提醒 Celery 任务"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta

from celery import shared_task
from sqlalchemy import select

from app.core.database import get_session_factory
from app.models.calendar_event import CalendarEvent
from app.services.notification.websocket_channel import WebSocketChannel


@shared_task
def check_calendar_reminders() -> None:
    """检查需要发送提醒的日历事件。每分钟执行一次。"""
    asyncio.run(_check_async())


async def _check_async() -> None:
    sf = get_session_factory()
    async with sf() as db:
        now = datetime.now()
        query = select(CalendarEvent).where(
            CalendarEvent.reminder_enabled == True,  # noqa: E712
            CalendarEvent.reminded == False,  # noqa: E712
        )
        result = await db.execute(query)
        events = list(result.scalars().all())

        ws = WebSocketChannel()
        for event in events:
            # 计算提醒时间点：start_time - reminder_minutes
            reminder_time = event.start_time - timedelta(minutes=event.reminder_minutes)
            if reminder_time > now:
                continue  # 还未到提醒时间
            if event.start_time < now:
                # 事件开始时间已过，标记为已提醒，不再发送通知
                event.reminded = True
                continue

            await ws.send(
                [str(event.owner_id)],
                f"日历日程提醒: {event.title}",
                f"'{event.title}' 将在 {event.reminder_minutes} 分钟后开始",
            )
            event.reminded = True

        await db.flush()
        await db.commit()
