from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reminder import Reminder, ReminderStatus, TriggerType
from app.services.notification.dispatcher import dispatch_reminder


async def trigger_event_reminders(
    db: AsyncSession,
    event_type: str,
    context: dict,
) -> None:
    """触发事件类型的提醒。查找匹配事件的提醒并分发。"""
    query = select(Reminder).where(
        Reminder.trigger_type == TriggerType.EVENT,
        Reminder.status == ReminderStatus.PENDING,
        Reminder.event_type == event_type,
    )
    result = await db.execute(query)
    reminders = list(result.scalars().all())

    for reminder in reminders:
        await dispatch_reminder(db, reminder)
        reminder.status = ReminderStatus.SENT

    await db.flush()
