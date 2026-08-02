"""Celery 定时任务 — 两阶段清理过期的文件分享。

Phase 1 (每 300s)：过期超过 10 分钟但未标记删除的分享 → 删除物理文件 + 标记 is_deleted
Phase 2 (每 300s)：标记删除超过 7 天的记录 → 从数据库硬删除
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta

from celery import shared_task
from celery.utils.log import get_task_logger
from sqlalchemy import delete, select

from app.core.database import get_session_factory
from app.models.file_share import FileShare

logger = get_task_logger(__name__)


@shared_task
def cleanup_expired_shares() -> dict:
    return asyncio.run(_cleanup_expired_shares_async())


async def _cleanup_expired_shares_async() -> dict:
    session_factory = get_session_factory()
    async with session_factory() as db:
        now = datetime.now()

        # Phase 1：过期超过 10 分钟且未标记删除 → 删除物理文件 + 标记删除
        grace_cutoff = now - timedelta(minutes=10)
        result = await db.execute(
            select(FileShare).where(
                FileShare.expires_at < grace_cutoff,
                FileShare.deleted_at.is_(None),
                FileShare.is_deleted == False,  # noqa: E712
            )
        )
        expired_shares = list(result.scalars().all())

        grace_files_deleted = 0
        for share in expired_shares:
            try:
                if share.file_path and os.path.exists(share.file_path):
                    os.remove(share.file_path)
                    grace_files_deleted += 1
            except OSError:
                pass
            share.is_deleted = True
            share.deleted_at = now

        # Phase 2：标记删除超过 7 天的记录 → 硬删除
        hard_cutoff = now - timedelta(days=7)
        result_hard = await db.execute(
            delete(FileShare).where(
                FileShare.deleted_at.is_not(None),
                FileShare.deleted_at < hard_cutoff,
                FileShare.is_deleted == True,  # noqa: E712
            )
        )
        hard_deleted_count: int = result_hard.rowcount  # type: ignore[attr-defined]

        await db.commit()

        logger.info(
            "File share cleanup: grace_period_files=%d, hard_deleted_rows=%d",
            grace_files_deleted,
            hard_deleted_count,
        )

        return {
            "grace_period_files_deleted": grace_files_deleted,
            "hard_deleted_rows": hard_deleted_count,
        }
