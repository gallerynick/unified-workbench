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
    """创建会议记录。"""
    item = MeetingRecord(
        id=uuid.uuid4(),
        title=data["title"],
        owner_id=user.id,
        visibility=data.get("visibility", "private"),
        restricted_users=data.get("restricted_users", []),
        restricted_tags=data.get("restricted_tags", []),
        expected_speakers=data.get("expected_speakers"),
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

    for field in ("title", "visibility", "restricted_users", "restricted_tags", "expected_speakers", "notes"):
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
    """删除会议记录（彻底：连同音频文件一并删除）。"""
    user_tag_ids = await _get_user_tag_ids(db, user)
    item = await _get_meeting_or_404(db, meeting_id, user, user_tag_ids)

    if item.owner_id != user.id:
        raise HTTPException(
            status_code=403, detail="仅创建者可以删除会议"
        )

    audio_path = item.audio_file_path
    await db.delete(item)
    await db.flush()

    # 同步删除音频文件（数据库记录已删，若文件删除失败仅记日志不影响删除结果）。
    # 用独立事务提交后删除，避免文件系统操作阻塞数据库会话。
    if audio_path:
        import os

        try:
            if os.path.isfile(audio_path):
                os.remove(audio_path)
                logger.info("Removed audio file for meeting %s: %s", meeting_id, audio_path)
        except Exception as exc:
            logger.warning("Failed to remove audio file %s: %s", audio_path, exc)

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

    # 时长以实际录音时长为准（中途离开/暂停的空白不能计入）；
    # 无音频文件时回退到墙钟时间。
    from app.utils.timeutil import wav_duration_seconds

    audio_duration = wav_duration_seconds(item.audio_file_path)
    if audio_duration is not None:
        item.duration_seconds = audio_duration
    elif item.started_at:
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


async def _save_minutes_record(
    db: AsyncSession,
    meeting: MeetingRecord,
    minutes_data: dict[str, Any],
    model_used: str,
) -> None:
    """保存/更新会议纪要（按 meeting_id upsert）。"""
    from sqlalchemy import select

    from app.models.meeting_minutes import MeetingMinutes
    from app.utils.timeutil import now_shanghai

    result = await db.execute(
        select(MeetingMinutes).where(MeetingMinutes.meeting_id == meeting.id)
    )
    existing = result.scalar_one_or_none()
    payload = {
        "summary": minutes_data.get("summary", ""),
        "key_points": minutes_data.get("key_points", []),
        "todos": minutes_data.get("todos", []),
        "model_used": model_used,
    }
    if existing:
        existing.summary = payload["summary"]
        existing.key_points = payload["key_points"]
        existing.todos = payload["todos"]
        existing.model_used = payload["model_used"]
        existing.generated_at = now_shanghai()
    else:
        db.add(MeetingMinutes(
            id=uuid.uuid4(),
            meeting_id=meeting.id,
            summary=payload["summary"],
            key_points=payload["key_points"],
            todos=payload["todos"],
            model_used=payload["model_used"],
            generated_at=now_shanghai(),
        ))

async def regenerate_minutes_record(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    user: User,
) -> MeetingRecord | None:
    """手动重新生成会议纪要（供前端「再次生成」/失败重试）。

    - 仅创建者可触发；
    - 会议已结束（completed）才允许；
    - **异步执行**：置 processing 后入队 regenerate_minutes_task，
      请求立即返回，模型生成（30~120s）由 Celery 后台完成，
      前端按钮不再长时间转圈，由轮询获取完成/失败；
    - **只重新生成纪要**：任务内用现有转录段（含用户改过的说话人名），
      不重跑转写/说话人分离（否则会把改的名覆盖掉）。
    """
    user_tag_ids = await _get_user_tag_ids(db, user)
    item = await _get_meeting_or_404(db, meeting_id, user, user_tag_ids)

    if item.owner_id != user.id:
        raise HTTPException(status_code=403, detail="仅创建者可以重新生成纪要")

    # 已在处理中：幂等返回现状，不重复入队（避免 400 让前端状态卡死）
    if item.status == "processing":
        return item

    if item.status != "completed":
        raise HTTPException(
            status_code=400, detail="会议尚未结束，不能重新生成纪要"
        )

    # 置为处理中，前端轮询显示生成进度
    item.status = "processing"
    item.minutes_status = "pending"
    item.processing_stage = "正在生成纪要"
    await db.flush()
    await db.refresh(item)
    await db.commit()

    try:
        from app.tasks.meeting_process import regenerate_minutes_task

        regenerate_minutes_task.delay(str(item.id))
    except Exception as exc:
        logger.error("Failed to enqueue minutes regeneration for %s: %s", item.id, exc)
        item.status = "completed"
        item.minutes_status = "failed"
        item.processing_stage = None
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
        # M12：不再返回容器内部路径（前端无法使用）；
        # 前端导出录音应走 GET /{meeting_id}/audio 下载端点
        return {
            "type": "audio",
            "title": item.title,
            "audio_download_url": f"/api/v1/meetings/{meeting_id}/audio",
        }

    raise HTTPException(status_code=400, detail="不支持的导出类型")

async def set_segment_speaker(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    user: User,
    seq: int,
    speaker: str | None,
) -> MeetingTranscriptSegment:
    """手动指定某一句的说话人（模型分不出来时的最终出口）。

    自动聚类/分离都可能失败（实测 22 秒近场音频 pyannote 只检出 0.7 秒
    语音，即使放大 4.6 倍也仅 8% 覆盖）——这种情况下唯一可靠的办法
    是让用户自己标。只改这一句，不动其它段。
    """
    user_tag_ids = await _get_user_tag_ids(db, user)
    item = await _get_meeting_or_404(db, meeting_id, user, user_tag_ids)

    if item.owner_id != user.id:
        raise HTTPException(status_code=403, detail="仅创建者可以修改说话人")

    result = await db.execute(
        select(MeetingTranscriptSegment).where(
            MeetingTranscriptSegment.meeting_id == meeting_id,
            MeetingTranscriptSegment.seq == seq,
        )
    )
    seg = result.scalar_one_or_none()
    if not seg:
        raise HTTPException(status_code=404, detail="该转录句子不存在")

    seg.speaker = (speaker or "").strip() or None
    await db.flush()
    return seg


async def rediarize_meeting_record(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    user: User,
    num_speakers: int,
) -> MeetingRecord:
    """按指定人数重新区分说话人（不重跑转写）。

    自动聚类对小模型不可靠：同一段音频在不同阈值下可能分出 1~9 个
    "说话人"，没有通用阈值。真实人数只有用户知道，所以提供这条
    "用户指定人数 → 强制 N 簇"的可靠路径。

    做法：用 num_speakers=N 重跑说话人分离，再按**时间重叠度**把
    已落库的转录段重新归属到新的说话人——不重新做 ASR，几秒完成。
    """
    import asyncio

    user_tag_ids = await _get_user_tag_ids(db, user)
    item = await _get_meeting_or_404(db, meeting_id, user, user_tag_ids)

    if item.owner_id != user.id:
        raise HTTPException(status_code=403, detail="仅创建者可以重新区分说话人")
    if not item.audio_file_path:
        raise HTTPException(status_code=400, detail="该会议没有音频文件，无法区分说话人")
    if num_speakers < 1 or num_speakers > 20:
        raise HTTPException(status_code=400, detail="讲话人人数需在 1-20 之间")

    from app.services.speaker_diarization import diarize_speakers

    try:
        turs = await asyncio.to_thread(
            diarize_speakers, item.audio_file_path, num_speakers
        )
    except Exception as exc:
        logger.error("重新区分说话人失败：%s", exc)
        raise HTTPException(status_code=500, detail=f"说话人分离失败：{exc}")

    if not turs:
        raise HTTPException(
            status_code=400, detail="音频中未检测到语音，无法区分说话人"
        )

    # spk 编号 → 连续「说话人N」，按首次出现时间排序，保证稳定
    spk_order: list[int] = []
    for seg in sorted(turs, key=lambda x: x["start_time"]):
        if seg["spk"] not in spk_order:
            spk_order.append(seg["spk"])
    spk_name = {spk: f"说话人{i + 1}" for i, spk in enumerate(spk_order)}

    # 读取现有转录段，逐段按最大时间重叠归属
    result = await db.execute(
        select(MeetingTranscriptSegment)
        .where(MeetingTranscriptSegment.meeting_id == meeting_id)
        .order_by(MeetingTranscriptSegment.seq)
    )
    segments = list(result.scalars().all())

    for seg in segments:
        seg_start = seg.audio_start_ms or 0
        seg_end = seg.audio_end_ms
        if seg_end is None:
            # 老数据可能没有结束时间：按文本长度粗估 5 字/秒，最少 1 秒
            seg_end = seg_start + max(1000, len(seg.text or "") * 200)

        best_spk: int | None = None
        best_overlap = 0.0
        for turn in turs:
            overlap = min(seg_end, turn["end_time"]) - max(seg_start, turn["start_time"])
            if overlap > best_overlap:
                best_overlap = overlap
                best_spk = turn["spk"]

        # 无重叠（静音/噪声段）保持原归属，不改动
        if best_spk is not None and best_overlap > 0:
            seg.speaker = spk_name[best_spk]

    item.expected_speakers = num_speakers
    item.diarization_status = "done"
    await db.flush()
    await db.refresh(item)
    logger.info(
        "会议 %s 按指定人数 %d 重新区分说话人完成，%d 段已重新归属",
        meeting_id, num_speakers, len(segments),
    )
    return item

