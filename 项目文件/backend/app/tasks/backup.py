"""备份定时任务"""

from __future__ import annotations

import asyncio

from celery import shared_task

from app.core.database import get_session_factory
from app.services.backup import cleanup_old_backups, create_backup
from app.services.system_config import get_config


@shared_task
def scheduled_backup():
    """定时备份任务。"""
    asyncio.run(_scheduled_backup_async())


async def _scheduled_backup_async():
    session_factory = get_session_factory()
    async with session_factory() as db:
        config = await get_config(db, "backup_config") or {}
        if not config.get("enabled", False):
            return

        backup_dir = config.get("backup_dir", "/data/backups")
        max_backups = config.get("max_backups", 7)

        await create_backup(backup_dir)
        cleanup_old_backups(backup_dir, max_backups)
