from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from celery import shared_task
from sqlalchemy import select

from app.core.database import get_session_factory
from app.models.reminder import Reminder, ReminderStatus, TriggerType
from app.services.notification.dispatcher import dispatch_reminder


@shared_task
def check_due_reminders():
    """检查到期的定时提醒并分发。"""
    asyncio.run(_check_due_reminders_async())


async def _check_due_reminders_async():
    session_factory = get_session_factory()
    async with session_factory() as db:
        now = datetime.now(UTC)
        query = select(Reminder).where(
            Reminder.trigger_type == TriggerType.TIMED,
            Reminder.status == ReminderStatus.PENDING,
            Reminder.trigger_time <= now,
        )
        result = await db.execute(query)
        reminders = list(result.scalars().all())

        for reminder in reminders:
            results = await dispatch_reminder(db, reminder)
            if all(results.values()):
                reminder.status = ReminderStatus.SENT
            elif any(results.values()):
                reminder.status = ReminderStatus.SENT  # 部分成功也算发送
            else:
                reminder.status = ReminderStatus.FAILED

        await db.flush()
