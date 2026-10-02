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
from app.services.meeting_minutes import generate_minutes
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

            # 步骤 1: 转录音频（带语言白名单）
            allowed_languages = None
            try:
                from app.services.third_party_config import get_third_party_config

                params = (await get_third_party_config(db)).asr_config.parameters or {}
                raw_langs = params.get("allowed_languages")
                if isinstance(raw_langs, list) and raw_langs:
                    allowed_languages = [str(x).lower() for x in raw_langs]
            except Exception:
                pass
            segments_data = _transcribe_audio(meeting, allowed_languages)

            # 步骤 2: 生成纪要（本函数已是 async，直接 await，勿用 asyncio.run 包装）
            minutes_data, model_used = await generate_minutes(segments_data)

            # 步骤 3: 保存转录段到数据库
            await _save_transcript_segments(db, meeting_uuid, segments_data)

            # 步骤 4: 说话人分离（sherpa-onnx，独立 session，与 SenseVoice 顺序执行）
            try:
                if meeting.audio_file_path:
                    await _assign_speakers(
                        db, meeting_uuid, meeting.audio_file_path
                    )
                    meeting.diarization_status = "done"
                else:
                    meeting.diarization_status = "failed"
            except Exception as exc:
                logger.error("说话人分离失败：%s", exc)
                meeting.diarization_status = "failed"

            # 步骤 5: 保存纪要到数据库
            await _save_minutes(db, meeting_uuid, minutes_data, model_used)

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


def _transcribe_audio(
    meeting: MeetingRecord,
    allowed_languages: list[str] | None = None,
) -> list[dict[str, Any]]:
    """转录音频文件，返回带时间戳的文本段列表。

    SenseVoice ONNX 不输出时间戳，句子边界由 webrtcvad（纯 C，无
    onnxruntime session）提供：先切句，再逐句转写。webrtcvad 与
    SenseVoice 并存不会像两个 ORT session 那样触发 VM 内存 OOM。
    """
    audio_path = meeting.audio_file_path

    if not audio_path or not os.path.exists(audio_path):
        logger.warning("Audio file not found: %s", audio_path)
        return []

    try:
        import soundfile as sf

        from app.services.asr_engine import (
            init_asr_model,
            segment_audio,
            transcribe_audio_array,
        )

        audio, sample_rate = sf.read(audio_path, dtype="float32", always_2d=True)
        audio = audio[:, 0]
        if sample_rate != 16000:
            import librosa

            audio = librosa.resample(audio, orig_sr=sample_rate, target_sr=16000)
            sample_rate = 16000

        # 阶段 1：webrtcvad 切句（无 ORT session）
        voiced = segment_audio(audio, sample_rate, silence_timeout=0.6)

        # 阶段 2：ASR 逐句转写（SenseVoice ONNX 单 session）
        init_asr_model()
        segments: list[dict[str, Any]] = []
        for start_ms, seg_bytes in voiced:
            text_segments = transcribe_audio_array(
                seg_bytes, 16000, 1, allowed_languages=allowed_languages
            )
            seg_dur_ms = int(len(seg_bytes) / 32)  # 16k int16 = 2 bytes/采样
            for seg in text_segments:
                segments.append({
                    "text": seg.get("text", ""),
                    "start_ms": start_ms,
                    "end_ms": start_ms + seg_dur_ms,
                })

        logger.info("Transcribed %d segments from audio", len(segments))
        return segments

    except Exception as e:
        logger.error("Audio transcription failed: %s", e)
        return []


async def _save_transcript_segments(
    db: Any,
    meeting_id: uuid.UUID,
    segments: list[dict[str, Any]],
) -> None:
    """保存转录段到数据库（async：db 是 AsyncSession，execute 必须 await）。"""
    await db.execute(
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


async def _save_minutes(
    db: Any,
    meeting_id: uuid.UUID,
    minutes_data: dict[str, Any],
    model_used: str,
) -> None:
    """保存纪要到数据库（async：db 是 AsyncSession，execute 必须 await）。"""
    # 检查是否已有纪要
    result = await db.execute(
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


def _match_speaker(
    segment: MeetingTranscriptSegment,
    diarization_result: list[dict[str, Any]],
) -> int:
    """按时间戳重叠度匹配说话人编号。"""
    start_ms = segment.audio_start_ms
    end_ms = segment.audio_end_ms or start_ms + 1000

    best_match = 0
    best_overlap = 0
    for item in diarization_result:
        item_start = item.get("start_time", 0)
        item_end = item.get("end_time", 0)
        overlap = min(end_ms, item_end) - max(start_ms, item_start)
        if overlap > best_overlap:
            best_overlap = overlap
            best_match = item.get("spk", 0)
    return best_match


async def _assign_speakers(
    db: Any,
    meeting_id: uuid.UUID,
    audio_file_path: str,
) -> None:
    """说话人分离：用 sherpa-onnx 分离说话人，给转录段打 speaker 标签。

    与 SenseVoice 转写顺序执行（转写已完成），无 ORT session 并存。
    """
    from app.services.speaker_diarization import diarize_speakers

    diarization_result = diarize_speakers(audio_file_path)
    if not diarization_result:
        return

    result = await db.execute(
        select(MeetingTranscriptSegment)
        .where(MeetingTranscriptSegment.meeting_id == meeting_id)
        .order_by(MeetingTranscriptSegment.seq)
    )
    segments = list(result.scalars().all())

    spk_map: dict[int, str] = {}
    spk_count = 0
    for seg in segments:
        spk = _match_speaker(seg, diarization_result)
        if spk not in spk_map:
            spk_count += 1
            spk_map[spk] = f"说话人{spk_count}"
        seg.speaker = spk_map[spk]
