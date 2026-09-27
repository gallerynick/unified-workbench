"""会后处理 Celery 任务。

会议结束后自动执行：转录、纪要生成、状态落库。

与其他 Celery 任务保持一致的写法：同步 task 用 `asyncio.run` 驱动异步实现，
内部用 `async with isolated_session()` 取任务专用独立引擎。
（`isolated_session` 是 `@asynccontextmanager`，不能直接用于同步 `with`。）
"""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from typing import Any

from celery import shared_task
from sqlalchemy import delete, select

from app.core.database import isolated_session
from app.models.meeting_minutes import MeetingMinutes
from app.models.meeting_record import MeetingRecord
from app.models.meeting_transcript_segment import MeetingTranscriptSegment
from app.services.meeting_minutes import generate_minutes_sync
from app.utils.timeutil import now_shanghai

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_meeting(self, meeting_id: str) -> dict[str, Any]:
    """会后处理任务入口（同步签名，内部转异步执行）。"""
    return asyncio.run(_process_meeting_async(self, meeting_id))


async def _process_meeting_async(self, meeting_id: str) -> dict[str, Any]:
    """会后处理任务主体。

    1. 对音频文件执行批量转录
    2. 生成会议纪要
    3. 保存转录段与纪要，更新会议状态
    """
    meeting_uuid = uuid.UUID(meeting_id)

    try:
        async with isolated_session() as db:
            result = await db.execute(
                select(MeetingRecord).where(MeetingRecord.id == meeting_uuid)
            )
            meeting = result.scalar_one_or_none()

            if not meeting:
                logger.error(f"Meeting {meeting_id} not found")
                return {"status": "error", "message": "Meeting not found"}

            logger.info(f"Starting post-processing for meeting {meeting_id}")

            # 步骤 1: 转录音频
            segments_data = _transcribe_audio(meeting)

            # 步骤 2: 生成纪要
            minutes_data, model_used = generate_minutes_sync(segments_data)

            # 步骤 3: 保存转录段到数据库
            _save_transcript_segments(db, meeting_uuid, segments_data)

            # 步骤 4: 保存纪要到数据库
            _save_minutes(db, meeting_uuid, minutes_data, model_used)

            # 步骤 5: 更新会议状态
            meeting.status = "completed"
            meeting.minutes_status = "done"
            if meeting.started_at and meeting.ended_at:
                meeting.duration_seconds = int(
                    (meeting.ended_at - meeting.started_at).total_seconds()
                )

            await db.commit()

            logger.info(
                f"Post-processing completed for meeting {meeting_id}: "
                f"{len(segments_data)} segments, minutes generated"
            )

            return {
                "status": "success",
                "meeting_id": meeting_id,
                "segments_count": len(segments_data),
                "minutes_summary_length": len(minutes_data.get("summary", "")),
            }

    except Exception as e:
        logger.error(f"Post-processing failed for meeting {meeting_id}: {e}")

        async with isolated_session() as db:
            result = await db.execute(
                select(MeetingRecord).where(MeetingRecord.id == meeting_uuid)
            )
            meeting = result.scalar_one_or_none()
            if meeting:
                meeting.minutes_status = "failed"
                meeting.status = "completed"
                await db.commit()

        # 重试
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=60)

        return {"status": "error", "message": str(e)}


def _transcribe_audio(meeting: MeetingRecord) -> list[dict[str, Any]]:
    """转录音频文件，返回文本段列表。"""
    audio_path = meeting.audio_file_path

    if not audio_path or not os.path.exists(audio_path):
        logger.warning(f"Audio file not found: {audio_path}")
        return []

    try:
        from app.services.asr_engine import init_asr_model, transcribe_audio_array

        init_asr_model()

        with open(audio_path, "rb") as f:
            # 跳过 WAV 头（44 字节）
            f.read(44)
            audio_data = f.read()

        if not audio_data:
            return []

        segments = transcribe_audio_array(audio_data, 16000, 1)
        logger.info(f"Transcribed {len(segments)} segments from audio")
        return segments

    except Exception as e:
        logger.error(f"Audio transcription failed: {e}")
        return []


def _save_transcript_segments(
    db: Any,
    meeting_id: uuid.UUID,
    segments: list[dict[str, Any]],
) -> None:
    """保存转录段到数据库。"""
    db.execute(
        delete(MeetingTranscriptSegment).where(
            MeetingTranscriptSegment.meeting_id == meeting_id
        )
    )

    # 插入新数据
    for i, seg in enumerate(segments):
        db.add(
            MeetingTranscriptSegment(
                id=uuid.uuid4(),
                meeting_id=meeting_id,
                seq=i,
                text=seg.get("text", ""),
                audio_start_ms=seg.get("start_ms", 0),
                audio_end_ms=seg.get("end_ms"),
            )
        )


def _save_minutes(
    db: Any,
    meeting_id: uuid.UUID,
    minutes_data: dict[str, Any],
    model_used: str,
) -> None:
    """保存纪要到数据库。"""
    # 检查是否已有纪要
    result = db.execute(
        select(MeetingMinutes).where(MeetingMinutes.meeting_id == meeting_id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        # 更新现有记录
        existing.summary = minutes_data.get("summary", "")
        existing.key_points = minutes_data.get("key_points", [])
        existing.todos = minutes_data.get("todos", [])
        existing.model_used = model_used
        existing.generated_at = now_shanghai()
    else:
        # 创建新记录
        db.add(
            MeetingMinutes(
                id=uuid.uuid4(),
                meeting_id=meeting_id,
                summary=minutes_data.get("summary", ""),
                key_points=minutes_data.get("key_points", []),
                todos=minutes_data.get("todos", []),
                model_used=model_used,
                generated_at=now_shanghai(),
            )
        )
