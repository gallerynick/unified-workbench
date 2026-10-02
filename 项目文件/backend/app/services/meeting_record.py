"""会议记录业务逻辑"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.visibility import Visibility
from app.models.meeting_record import MeetingRecord
from app.models.meeting_transcript_segment import MeetingTranscriptSegment
from app.models.tag import Tag
from app.models.user import User
from app.tasks.meeting_process import process_meeting
from app.utils.timeutil import now_shanghai

logger = logging.getLogger(__name__)


def _check_visibility(
    user: User,
    visibility: str,
    owner_id: uuid.UUID,
    restricted_users: list[uuid.UUID] | None,
    restricted_tags: list[uuid.UUID] | None,
    user_tag_ids: list[uuid.UUID] | None = None,
) -> bool:
    """检查用户对会议记录的可见性。"""
    if visibility == Visibility.PUBLIC:
        return True

    if visibility == Visibility.PRIVATE:
        return user.id == owner_id

    if visibility == Visibility.RESTRICTED:
        if user.id == owner_id:
            return True
        if restricted_users and user.id in restricted_users:
            return True
        if restricted_tags and user_tag_ids:
            user_tag_set = set(user_tag_ids)
            if user_tag_set & set(restricted_tags):
                return True
        return False

    return False


async def _get_meeting_or_404(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    current_user: User,
    user_tag_ids: list[uuid.UUID] | None = None,
) -> MeetingRecord:
    """获取会议记录，不存在或无权访问则抛异常。"""
    result = await db.execute(
        select(MeetingRecord).where(MeetingRecord.id == meeting_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="会议不存在")

    if not _check_visibility(
        current_user,
        item.visibility,
        item.owner_id,
        item.restricted_users or [],
        item.restricted_tags or [],
        user_tag_ids,
    ):
        raise HTTPException(status_code=403, detail="无权访问此会议记录")

    return item


async def _get_user_tag_ids(db: AsyncSession, user: User) -> list[uuid.UUID]:
    """获取用户的标签 ID 列表。"""
    result = await db.execute(
        select(Tag.id).where(Tag.users.any(User.id == user.id))
    )
    return [row[0] for row in result.all()]


async def list_meeting_records(
    db: AsyncSession,
    user: User,
    page: int = 1,
    page_size: int = 20,
    status_filter: str | None = None,
) -> tuple[list[MeetingRecord], int]:
    """列出会议记录，按状态筛选，按可见性过滤。"""
    # 预加载用户标签 ID
    user_tag_ids = await _get_user_tag_ids(db, user)

    # 构建可见性条件
    # 将 user.id 和 tag_ids 转换为字符串列表，用于 JSONB 包含查询
    user_id_str = str(user.id)
    tag_ids_str = [str(tag_id) for tag_id in user_tag_ids]

    conditions = [
        # 自己拥有的
        MeetingRecord.owner_id == user.id,
        # 公开可见的
        MeetingRecord.visibility == Visibility.PUBLIC,
    ]

    # restricted 且 restricted_users 包含自己
    # 使用 JSONB 包含运算符
    conditions.append(
        and_(
            MeetingRecord.visibility == Visibility.RESTRICTED,
            MeetingRecord.restricted_users.contains([user_id_str])
        )
    )

    # 追加 restricted 可见性：restricted 且 restricted_tags 包含用户的任一标签
    if tag_ids_str:
        for tag_id_str in tag_ids_str:
            conditions.append(
                and_(
                    MeetingRecord.visibility == Visibility.RESTRICTED,
                    MeetingRecord.restricted_tags.contains([tag_id_str])
                )
            )

    # 基础查询：可见的记录
    query = select(MeetingRecord).where(or_(*conditions))

    if status_filter:
        query = query.where(MeetingRecord.status == status_filter)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(MeetingRecord.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total


async def create_meeting_record(
    db: AsyncSession,
    user: User,
    data: dict[str, Any],
) -> MeetingRecord:
    """创建会议记录，生成唯一会议编号。"""
    now = now_shanghai()
    date_str = now.strftime("%Y%m%d")
    prefix = f"MTG-{date_str}-"

    result = await db.execute(
        select(MeetingRecord.number)
        .where(MeetingRecord.number.like(f"{prefix}%"))
        .order_by(MeetingRecord.number.desc())
        .limit(1)
    )
    last_number = result.scalar_one_or_none()

    if last_number:
        seq_part = last_number.split("-")[-1]
        next_seq = int(seq_part) + 1
    else:
        next_seq = 1

    meeting_number = f"{prefix}{next_seq:03d}"

    item = MeetingRecord(
        id=uuid.uuid4(),
        number=meeting_number,
        title=data["title"],
        owner_id=user.id,
        visibility=data.get("visibility", "private"),
        restricted_users=data.get("restricted_users", []),
        restricted_tags=data.get("restricted_tags", []),
        status="not_started",
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def get_meeting_record(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    user: User,
) -> MeetingRecord | None:
    """获取会议详情，不存在或无权访问返回 None。"""
    user_tag_ids = await _get_user_tag_ids(db, user)
    try:
        return await _get_meeting_or_404(db, meeting_id, user, user_tag_ids)
    except HTTPException:
        return None


async def update_meeting_record(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    user: User,
    data: dict[str, Any],
) -> MeetingRecord | None:
    """更新会议记录（标题、可见性等）。"""
    user_tag_ids = await _get_user_tag_ids(db, user)
    item = await _get_meeting_or_404(db, meeting_id, user, user_tag_ids)

    if item.owner_id != user.id:
        raise HTTPException(
            status_code=403, detail="仅创建者可以更新会议"
        )

    for field in ("title", "visibility", "restricted_users", "restricted_tags", "notes"):
        if field in data and data[field] is not None:
            setattr(item, field, data[field])

    await db.flush()
    await db.refresh(item)
    return item


async def delete_meeting_record(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    user: User,
) -> bool:
    """删除会议记录。"""
    user_tag_ids = await _get_user_tag_ids(db, user)
    item = await _get_meeting_or_404(db, meeting_id, user, user_tag_ids)

    if item.owner_id != user.id:
        raise HTTPException(
            status_code=403, detail="仅创建者可以删除会议"
        )

    await db.delete(item)
    await db.flush()
    return True


async def start_meeting_record(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    user: User,
) -> MeetingRecord | None:
    """开始转录。"""
    user_tag_ids = await _get_user_tag_ids(db, user)
    item = await _get_meeting_or_404(db, meeting_id, user, user_tag_ids)

    if item.owner_id != user.id:
        raise HTTPException(
            status_code=403, detail="仅创建者可以开始会议"
        )

    if item.status != "not_started":
        raise HTTPException(
            status_code=400, detail="会议已开始，不能重复开始"
        )

    item.status = "recording"
    item.started_at = now_shanghai()
    item.paused_reason = None

    await db.flush()
    await db.refresh(item)
    return item


async def pause_meeting_record(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    user: User,
    reason: str = "manual",
) -> MeetingRecord | None:
    """暂停转录。"""
    user_tag_ids = await _get_user_tag_ids(db, user)
    item = await _get_meeting_or_404(db, meeting_id, user, user_tag_ids)

    if item.owner_id != user.id:
        raise HTTPException(
            status_code=403, detail="仅创建者可以暂停会议"
        )

    if item.status != "recording":
        raise HTTPException(
            status_code=400, detail="会议未在录音状态，不能暂停"
        )

    item.status = "paused"
    item.paused_reason = reason

    await db.flush()
    await db.refresh(item)
    return item


async def resume_meeting_record(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    user: User,
) -> MeetingRecord | None:
    """恢复转录。"""
    user_tag_ids = await _get_user_tag_ids(db, user)
    item = await _get_meeting_or_404(db, meeting_id, user, user_tag_ids)

    if item.owner_id != user.id:
        raise HTTPException(
            status_code=403, detail="仅创建者可以恢复会议"
        )

    if item.status != "paused":
        raise HTTPException(
            status_code=400, detail="会议未暂停，不能恢复"
        )

    item.status = "recording"
    item.paused_reason = None

    await db.flush()
    await db.refresh(item)
    return item


async def end_meeting_record(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    user: User,
) -> MeetingRecord | None:
    """结束会议，触发会后处理。"""
    user_tag_ids = await _get_user_tag_ids(db, user)
    item = await _get_meeting_or_404(db, meeting_id, user, user_tag_ids)

    if item.owner_id != user.id:
        raise HTTPException(
            status_code=403, detail="仅创建者可以结束会议"
        )

    if item.status not in ("recording", "paused"):
        raise HTTPException(
            status_code=400, detail="会议尚未开始或已结束"
        )

    item.status = "processing"
    item.ended_at = now_shanghai()

    if item.started_at:
        elapsed = (item.ended_at - item.started_at).total_seconds()
        item.duration_seconds = int(elapsed)

    await db.flush()
    await db.refresh(item)

    # 先提交本次会议状态变更，再入队会后处理任务。
    # 任务用独立连接重新读取 MeetingRecord，若在事务提交前入队，
    # 理论上可能读不到刚写入的 status / ended_at / audio_file_path。
    await db.commit()

    # 触发会后处理 Celery 任务（转录 + 纪要生成）
    try:
        process_meeting.delay(str(item.id))
    except Exception as e:
        logger.error(f"Failed to enqueue meeting processing task for {item.id}: {e}")
        item.status = "completed"
        item.minutes_status = "failed"
        await db.flush()

    return item


async def autosave_meeting_record(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    user: User,
    notes: str | None,
    transcript_segments: list[dict[str, Any]],
) -> MeetingRecord | None:
    """自动保存会议笔记与实时转录片段。

    - 笔记：直接覆盖 meeting_record.notes
    - 转录：按 meeting_id + seq upsert，避免重复堆积
    """
    user_tag_ids = await _get_user_tag_ids(db, user)
    item = await _get_meeting_or_404(db, meeting_id, user, user_tag_ids)

    if item.owner_id != user.id:
        raise HTTPException(status_code=403, detail="仅创建者可以更新会议")

    if notes is not None:
        item.notes = notes

    for seg in transcript_segments or []:
        seq = int(seg.get("seq", 0))
        text = seg.get("text", "")
        audio_start_ms = int(seg.get("audio_start_ms", 0))
        audio_end_ms = seg.get("audio_end_ms")
        speaker = seg.get("speaker")

        existing = await db.execute(
            select(MeetingTranscriptSegment).where(
                MeetingTranscriptSegment.meeting_id == meeting_id,
                MeetingTranscriptSegment.seq == seq,
            )
        )
        existing_seg = existing.scalar_one_or_none()
        if existing_seg:
            existing_seg.text = text
            existing_seg.audio_start_ms = audio_start_ms
            existing_seg.audio_end_ms = audio_end_ms if audio_end_ms is not None else None
            if speaker is not None:
                existing_seg.speaker = speaker
        else:
            db.add(
                MeetingTranscriptSegment(
                    id=uuid.uuid4(),
                    meeting_id=meeting_id,
                    seq=seq,
                    text=text,
                    audio_start_ms=audio_start_ms,
                    audio_end_ms=audio_end_ms if audio_end_ms is not None else None,
                    speaker=speaker,
                )
            )

    await db.flush()
    await db.refresh(item)
    return item


async def get_transcript_segments(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    user: User,
) -> list[MeetingTranscriptSegment]:
    """获取转录句子。"""
    user_tag_ids = await _get_user_tag_ids(db, user)
    await _get_meeting_or_404(db, meeting_id, user, user_tag_ids)

    result = await db.execute(
        select(MeetingTranscriptSegment)
        .where(MeetingTranscriptSegment.meeting_id == meeting_id)
        .order_by(MeetingTranscriptSegment.seq.asc())
    )
    return list(result.scalars().all())


async def review_meeting_minutes(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    user: User,
) -> MeetingRecord | None:
    """确认纪要审核。"""
    user_tag_ids = await _get_user_tag_ids(db, user)
    item = await _get_meeting_or_404(db, meeting_id, user, user_tag_ids)

    if item.owner_id != user.id:
        raise HTTPException(
            status_code=403, detail="仅创建者可以确认纪要"
        )

    if item.minutes_status != "done":
        raise HTTPException(
            status_code=400, detail="纪要尚未生成，无法审核"
        )

    item.minutes_reviewed = True

    await db.flush()
    await db.refresh(item)
    return item


async def export_meeting_data(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    user: User,
    export_type: str,
) -> dict[str, Any] | None:
    """导出会议内容（转录/音频/纪要）。"""
    user_tag_ids = await _get_user_tag_ids(db, user)
    item = await _get_meeting_or_404(db, meeting_id, user, user_tag_ids)

    if export_type == "transcript":
        segments = await get_transcript_segments(db, meeting_id, user)
        return {
            "type": "transcript",
            "number": item.number,
            "title": item.title,
            "segments": [
                {
                    "seq": seg.seq,
                    "text": seg.text,
                    "audio_start_ms": seg.audio_start_ms,
                    "audio_end_ms": seg.audio_end_ms,
                    "speaker": seg.speaker,
                }
                for seg in segments
            ],
        }

    if export_type == "minutes":
        if not item.minutes:
            raise HTTPException(status_code=404, detail="纪要尚未生成")
        return {
            "type": "minutes",
            "number": item.number,
            "title": item.title,
            "summary": item.minutes.summary,
            "key_points": item.minutes.key_points,
            "todos": item.minutes.todos,
            "model_used": item.minutes.model_used,
            "generated_at": (
                item.minutes.generated_at.isoformat()
                if item.minutes.generated_at
                else None
            ),
        }

    if export_type == "audio":
        if not item.audio_file_path:
            raise HTTPException(status_code=404, detail="音频文件不存在")
        return {
            "type": "audio",
            "number": item.number,
            "title": item.title,
            "audio_file_path": item.audio_file_path,
        }

    raise HTTPException(status_code=400, detail="不支持的导出类型")
