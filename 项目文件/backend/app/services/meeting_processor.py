"""会后处理服务 - 说话人分离 + AI 纪要生成"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.meeting_minutes import MeetingMinutes
from app.models.meeting_record import MeetingRecord
from app.models.meeting_transcript_segment import MeetingTranscriptSegment

logger = logging.getLogger(__name__)


async def process_meeting_after_end(db: AsyncSession, meeting_id: uuid.UUID):
    """会议结束后的处理流程"""
    from sqlalchemy import select
    
    # 获取会议记录
    query = select(MeetingRecord).where(MeetingRecord.id == meeting_id)
    result = await db.execute(query)
    meeting = result.scalar()
    
    if not meeting:
        logger.error(f"Meeting {meeting_id} not found")
        return
    
    # 1. 说话人分离
    try:
        from app.services.speaker_diarization import diarize_speakers
        
        if meeting.audio_file_path:
            diarization_result = diarize_speakers(meeting.audio_file_path)
            
            # 更新转录句子的说话人标签
            segments = await _get_segments(db, meeting_id)
            spk_map = {}
            spk_count = 0
            
            for seg in segments:
                # 根据时间戳匹配说话人
                speaker = _match_speaker(seg, diarization_result)
                if speaker not in spk_map:
                    spk_count += 1
                    spk_map[speaker] = f"说话人{spk_count}"
                seg.speaker = spk_map[speaker]
            
            meeting.diarization_status = "done"
        else:
            meeting.diarization_status = "failed"
    except Exception as e:
        logger.error(f"Speaker diarization failed: {e}")
        meeting.diarization_status = "failed"
    
    # 2. AI 纪要生成
    try:
        from app.services.ai_provider import generate_minutes
        
        # 获取转录内容
        segments = await _get_segments(db, meeting_id)
        transcript = _format_transcript(segments)
        
        minutes = await generate_minutes(transcript, meeting_id)
        
        # 保存纪要
        meeting_minutes = MeetingMinutes(
            id=uuid.uuid4(),
            meeting_id=meeting_id,
            summary=minutes["summary"],
            key_points=minutes.get("key_points", []),
            todos=minutes.get("todos", []),
            model_used=minutes.get("model_used", "qwen3.5:4b"),
        )
        db.add(meeting_minutes)
        
        meeting.minutes_status = "done"
    except Exception as e:
        logger.error(f"Minutes generation failed: {e}")
        meeting.minutes_status = "failed"
    
    # 3. 更新会议状态
    meeting.status = "completed"
    meeting.updated_at = datetime.now()
    
    await db.commit()
    await db.refresh(meeting)
    
    return meeting


async def _get_segments(db: AsyncSession, meeting_id: uuid.UUID) -> list[MeetingTranscriptSegment]:
    """获取转录句子"""
    from sqlalchemy import select
    
    query = (
        select(MeetingTranscriptSegment)
        .where(MeetingTranscriptSegment.meeting_id == meeting_id)
        .order_by(MeetingTranscriptSegment.seq)
    )
    result = await db.execute(query)
    return list(result.scalars().all())


def _match_speaker(segment: MeetingTranscriptSegment, diarization_result: list[dict[str, Any]]) -> int:
    """根据时间戳匹配说话人"""
    start_ms = segment.audio_start_ms
    end_ms = segment.audio_end_ms or start_ms + 1000
    
    # 找到时间戳重叠的说话人
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


def _format_transcript(segments: list[MeetingTranscriptSegment]) -> str:
    """格式化转录内容"""
    lines = []
    for seg in segments:
        speaker = seg.speaker or "说话人"
        lines.append(f"[{speaker}] {seg.text}")
    
    return "\n".join(lines)
