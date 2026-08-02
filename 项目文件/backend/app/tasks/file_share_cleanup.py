"""Celery 定时任务 — 清理过期的文件分享。"""

from __future__ import annotations

import asyncio
import os
from datetime import UTC, datetime

from celery import shared_task
from sqlalchemy import select

from app.core.database import get_session_factory
from app.models.file_share import FileShare


@shared_task
def cleanup_expired_shares() -> dict:
    return asyncio.run(_cleanup_expired_shares_async())


async def _cleanup_expired_shares_async() -> dict:
    session_factory = get_session_factory()
    async with session_factory() as db:
        now = datetime.now(UTC)
        query = select(FileShare).where(
            (FileShare.expires_at < now) | (FileShare.is_deleted.is_(True))
        )
        result = await db.execute(query)
        shares = list(result.scalars().all())

        cleaned_files = 0
        cleaned_records = 0

        for share in shares:
            try:
                if os.path.exists(share.file_path):
                    os.remove(share.file_path)
                    cleaned_files += 1
            except OSError:
                pass

            await db.delete(share)
            cleaned_records += 1

        await db.commit()

        return {
            "cleaned_files": cleaned_files,
            "cleaned_records": cleaned_records,
        }
