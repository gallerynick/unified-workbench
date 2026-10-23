"""会议记录 API 路由"""

from __future__ import annotations

import logging
import os
import uuid

logger = logging.getLogger(__name__)
from typing import Callable, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import decode_token
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.meeting_record import (
    MeetingAutosaveRequest,
    MeetingMinutesResponse,
    MeetingRecordCreate,
    MeetingRecordListResponse,
    MeetingRecordResponse,
    MeetingRecordUpdate,
    MeetingTranscriptSegmentResponse,
    SpeakerModelStatus,
)
from app.services.meeting_record import (
    autosave_meeting_record,
    create_meeting_record,
    delete_meeting_record,
    end_meeting_record,
    export_meeting_data,
    get_meeting_record,
    get_transcript_segments,
    list_meeting_records,
    pause_meeting_record,
    rediarize_meeting_record,
    regenerate_minutes_record,
    review_meeting_minutes,
    resume_meeting_record,
    set_segment_speaker,
    start_meeting_record,
    update_meeting_record,
)

router = APIRouter()


async def _get_current_user_from_bearer_or_query(
    request: Request,
    token: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return await _resolve_user_from_token(auth_header.removeprefix("Bearer ").strip(), db)

    if token:
        return await _resolve_user_from_token(token, db)

    raise HTTPException(status_code=401, detail="未提供访问令牌")


async def _resolve_user_from_token(token: str, db: AsyncSession) -> User:
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="无效的令牌")
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="无效的令牌")

    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user


@router.get("/", response_model=UnifiedResponse[MeetingRecordListResponse])
async def list_meetings_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取会议列表"""
    items, total = await list_meeting_records(
        db, current_user, page, page_size, status
    )
    return UnifiedResponse(
        data=MeetingRecordListResponse(
            items=[MeetingRecordResponse.model_validate(i) for i in items],
            total=total,
        )
    )


@router.post("/", response_model=UnifiedResponse[MeetingRecordResponse])
async def create_meeting_endpoint(
    request: MeetingRecordCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建会议"""
    item = await create_meeting_record(db, current_user, request.model_dump())
    return UnifiedResponse(data=MeetingRecordResponse.model_validate(item))


@router.post("/{meeting_id}/audio-import", response_model=UnifiedResponse[MeetingRecordResponse])
async def import_audio_endpoint(
    meeting_id: uuid.UUID,
    file: UploadFile = File(..., description="录音文件（wav/mp3/flac 等）"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """导入会议录音：上传音频 → 存为会议音频 → 自动触发会后识别
    （转写 + 讲话人分离 + 纪要）。录音区、转录区、纪要以该音频为准。
    """
    from app.core.config import get_settings

    from app.tasks.meeting_process import process_meeting

    item = await get_meeting_record(db, meeting_id, current_user)
    if not item:
        raise HTTPException(status_code=404, detail="会议不存在")
    if item.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="仅创建者可以导入录音")
    # M3-3：处理中禁止重复导入——两个 Celery 任务并发跑同一会议会互相覆盖转录段
    if item.status == "processing":
        raise HTTPException(status_code=409, detail="会议正在处理中，请等待完成后再导入")

    # M3-1：扩展名白名单（处理时由 soundfile 自动解析格式）
    ALLOWED_AUDIO_EXTS = {".wav", ".mp3", ".flac", ".m4a", ".ogg", ".opus", ".aac"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_AUDIO_EXTS:
        raise HTTPException(status_code=400, detail=f"不支持的音频格式：{ext}")

    audio_dir = os.path.join(get_settings().FILE_STORAGE_PATH, "meetings", "audio")
    os.makedirs(audio_dir, exist_ok=True)
    dest = os.path.join(audio_dir, f"{meeting_id}{ext}")

    # M3-3：换扩展名重复导入时清理旧音频，避免孤儿文件
    old_path = item.audio_file_path
    if old_path and os.path.isfile(old_path) and os.path.abspath(old_path) != os.path.abspath(dest):
        try:
            os.remove(old_path)
            logger.info("Removed old audio on re-import: %s", old_path)
        except OSError as exc:
            logger.warning("旧音频删除失败 %s: %s", old_path, exc)

    # M3-2：流式落盘 + 大小上限——原实现 file.read() 整读进内存，
    # 大文件直接打爆容器（M3-2）
    MAX_AUDIO_BYTES = 500 * 1024 * 1024  # 500 MB 足够数小时会议
    size = 0
    with open(dest, "wb") as fh:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_AUDIO_BYTES:
                fh.close()
                os.remove(dest)
                raise HTTPException(status_code=400, detail="音频文件超过 500 MB 上限")
            fh.write(chunk)
    if size == 0:
        os.remove(dest)
        raise HTTPException(status_code=400, detail="文件为空")

    item.audio_file_path = dest
    item.status = "processing"
    item.diarization_status = "pending"
    item.minutes_status = "pending"
    item.processing_stage = "正在区分讲话人"
    await db.commit()

    # 触发会后识别（转写 + 说话人 + 纪要）
    try:
        process_meeting.delay(str(item.id))
    except Exception as exc:
        logger.error("导入录音后入队处理失败：%s", exc)
        item.status = "completed"
        item.minutes_status = "failed"
        await db.commit()

    # commit 后标量属性过期，且 minutes/segments 是懒加载关系——model_validate 在
    # 同步上下文访问会 MissingGreenlet。显式加载关系后再序列化。
    from sqlalchemy.orm import selectinload

    from app.models.meeting_record import MeetingRecord

    result = await db.execute(
        select(MeetingRecord)
        .where(MeetingRecord.id == meeting_id)
        .options(
            selectinload(MeetingRecord.minutes),
            selectinload(MeetingRecord.segments),
        )
    )
    item = result.scalar_one()
    return UnifiedResponse(data=MeetingRecordResponse.model_validate(item))

@router.get(
    "/speaker-model", response_model=UnifiedResponse[SpeakerModelStatus]
)
async def get_speaker_model_status(
    current_user: User = Depends(get_current_user),
):
    """声纹模型状态：界面据此提示「为什么没区分说话人」并提供一键下载。"""
    from app.services.speaker_diarization import model_status

    return UnifiedResponse(data=SpeakerModelStatus(**model_status()))


@router.post(
    "/speaker-model/download", response_model=UnifiedResponse[SpeakerModelStatus]
)
async def download_speaker_model(
    current_user: User = Depends(get_current_user),
):
    """触发声纹模型下载（后台任务，接口立即返回，前端轮询状态）。"""
    from app.services.speaker_diarization import model_status

    from app.tasks.model_warmup import ensure_speaker_models_task

    status = model_status()
    if not status["downloading"] and not status["available"]:
        ensure_speaker_models_task.delay()
    return UnifiedResponse(data=SpeakerModelStatus(**model_status()))


@router.get("/{meeting_id}", response_model=UnifiedResponse[MeetingRecordResponse])
async def get_meeting_endpoint(
    meeting_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取会议详情"""
    item = await get_meeting_record(db, meeting_id, current_user)
    if not item:
        raise HTTPException(status_code=404, detail="会议不存在")
    return UnifiedResponse(data=MeetingRecordResponse.model_validate(item))


@router.patch("/{meeting_id}", response_model=UnifiedResponse[MeetingRecordResponse])
async def update_meeting_endpoint(
    meeting_id: uuid.UUID,
    request: MeetingRecordUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新会议（标题、可见性）"""
    item = await update_meeting_record(
        db, meeting_id, current_user, request.model_dump(exclude_unset=True)
    )
    if not item:
        raise HTTPException(status_code=404, detail="会议不存在")
    return UnifiedResponse(data=MeetingRecordResponse.model_validate(item))


@router.post("/{meeting_id}/autosave", response_model=UnifiedResponse[MeetingRecordResponse])
async def autosave_meeting_endpoint(
    meeting_id: uuid.UUID,
    request: MeetingAutosaveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """自动保存会议笔记与实时转录片段"""
    item = await autosave_meeting_record(
        db,
        meeting_id,
        current_user,
        request.notes,
        [s.model_dump() for s in request.transcript_segments],
    )
    if not item:
        raise HTTPException(status_code=404, detail="会议不存在")
    return UnifiedResponse(data=MeetingRecordResponse.model_validate(item))


@router.delete("/{meeting_id}", response_model=UnifiedResponse[None])
async def delete_meeting_endpoint(
    meeting_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除会议"""
    success = await delete_meeting_record(db, meeting_id, current_user)
    if not success:
        raise HTTPException(status_code=404, detail="会议不存在")
    return UnifiedResponse(msg="会议已删除")


@router.post("/{meeting_id}/start", response_model=UnifiedResponse[MeetingRecordResponse])
async def start_meeting_endpoint(
    meeting_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """开始转录"""
    item = await start_meeting_record(db, meeting_id, current_user)
    if not item:
        raise HTTPException(status_code=404, detail="会议不存在")
    return UnifiedResponse(data=MeetingRecordResponse.model_validate(item))


@router.post("/{meeting_id}/pause", response_model=UnifiedResponse[MeetingRecordResponse])
async def pause_meeting_endpoint(
    meeting_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """暂停转录"""
    item = await pause_meeting_record(db, meeting_id, current_user)
    if not item:
        raise HTTPException(status_code=404, detail="会议不存在")
    return UnifiedResponse(data=MeetingRecordResponse.model_validate(item))


@router.post("/{meeting_id}/resume", response_model=UnifiedResponse[MeetingRecordResponse])
async def resume_meeting_endpoint(
    meeting_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """恢复转录"""
    item = await resume_meeting_record(db, meeting_id, current_user)
    if not item:
        raise HTTPException(status_code=404, detail="会议不存在")
    return UnifiedResponse(data=MeetingRecordResponse.model_validate(item))


@router.post("/{meeting_id}/end", response_model=UnifiedResponse[MeetingRecordResponse])
async def end_meeting_endpoint(
    meeting_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """结束会议（触发会后处理）"""
    item = await end_meeting_record(db, meeting_id, current_user)
    if not item:
        raise HTTPException(status_code=404, detail="会议不存在")
    return UnifiedResponse(data=MeetingRecordResponse.model_validate(item))


@router.get(
    "/{meeting_id}/transcript",
    response_model=UnifiedResponse[list[MeetingTranscriptSegmentResponse]],
)
async def get_transcript_endpoint(
    meeting_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取转录句子"""
    segments = await get_transcript_segments(db, meeting_id, current_user)
    return UnifiedResponse(
        data=[MeetingTranscriptSegmentResponse.model_validate(s) for s in segments]
    )


@router.get("/{meeting_id}/audio")
async def download_audio_endpoint(
    meeting_id: uuid.UUID,
    token: str | None = Query(None),
    current_user: User = Depends(_get_current_user_from_bearer_or_query),
    db: AsyncSession = Depends(get_db),
):
    """下载音频文件"""
    meeting = await get_meeting_record(db, meeting_id, current_user)
    if not meeting:
        raise HTTPException(status_code=404, detail="会议不存在")
    if not meeting.audio_file_path:
        raise HTTPException(status_code=404, detail="音频文件不存在")

    return FileResponse(
        path=meeting.audio_file_path,
        media_type="audio/wav",
        filename=f"{meeting.title}-{meeting_id}.wav",
    )


@router.put("/{meeting_id}/speakers", response_model=UnifiedResponse[MeetingRecordResponse])
async def update_speaker_names_endpoint(
    meeting_id: uuid.UUID,
    request: dict[str, str],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """批量改说话人显示名：{"说话人1": "张三", ...}，同步到所有转录段。
    改完名后前端再点「重新生成纪要」，AI 纪要会用真实名字。
    """
    from sqlalchemy import update as sa_update

    from app.models.meeting_transcript_segment import MeetingTranscriptSegment

    meeting = await get_meeting_record(db, meeting_id, current_user)
    if not meeting:
        raise HTTPException(status_code=404, detail="会议不存在")
    if meeting.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="仅创建者可以修改说话人")

    for old_name, new_name in (request or {}).items():
        if not old_name or not new_name:
            continue
        await db.execute(
            sa_update(MeetingTranscriptSegment)
            .where(MeetingTranscriptSegment.meeting_id == meeting_id)
            .where(MeetingTranscriptSegment.speaker == old_name)
            .values(speaker=new_name),
        )
    await db.commit()
    # M10：改名只同步转录段，纪要里的旧名字不会自动更新——
    # 明确告知用户需要重新生成纪要（避免自动重生成每次烧一次模型调用）
    return UnifiedResponse(
        data=MeetingRecordResponse.model_validate(meeting),
        msg="说话人名已更新；如需纪要同步使用新名字，请重新生成纪要",
    )

@router.patch(
    "/{meeting_id}/segments/{seq}/speaker",
    response_model=UnifiedResponse[None],
)
async def set_segment_speaker_endpoint(
    meeting_id: uuid.UUID,
    seq: int,
    speaker: str | None = Query(None, description="说话人名称；留空表示清除"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """手动指定某一句的说话人（模型分不出来时的最终出口）。"""
    await set_segment_speaker(db, meeting_id, current_user, seq, speaker)
    return UnifiedResponse(msg="已更新该句说话人")


@router.put(
    "/{meeting_id}/speakers/rediarize",
    response_model=UnifiedResponse[MeetingRecordResponse],
)
async def rediarize_speakers_endpoint(
    meeting_id: uuid.UUID,
    num_speakers: int = Query(..., ge=1, le=20, description="实际讲话人人数"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """按指定人数重新区分说话人（不重跑转写，几秒完成）。

    自动聚类对小模型不可靠（同一段音频可能分出 1~9 个「说话人」），
    真实人数只有用户知道——这条路径用用户给的人数强制 N 簇，结果可靠。
    """
    item = await rediarize_meeting_record(db, meeting_id, current_user, num_speakers)
    return UnifiedResponse(
        data=MeetingRecordResponse.model_validate(item),
        msg=f"已按 {num_speakers} 位讲话人重新区分；如需纪要同步请重新生成纪要",
    )


@router.post(
    "/{meeting_id}/minutes/generate",
    response_model=UnifiedResponse[MeetingRecordResponse],
)
async def generate_minutes_endpoint(
    meeting_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """手动重新生成会议纪要（失败重试入口）"""
    item = await regenerate_minutes_record(db, meeting_id, current_user)
    if not item:
        raise HTTPException(status_code=404, detail="会议不存在")
    return UnifiedResponse(data=MeetingRecordResponse.model_validate(item))


@router.get(
    "/{meeting_id}/minutes",
    response_model=UnifiedResponse[MeetingMinutesResponse],
)
async def get_minutes_endpoint(
    meeting_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取纪要"""
    item = await get_meeting_record(db, meeting_id, current_user)
    if not item:
        raise HTTPException(status_code=404, detail="会议不存在")
    if not item.minutes:
        raise HTTPException(status_code=404, detail="纪要尚未生成")
    return UnifiedResponse(
        data=MeetingMinutesResponse.model_validate(item.minutes)
    )


@router.post(
    "/{meeting_id}/minutes/review",
    response_model=UnifiedResponse[MeetingRecordResponse],
)
async def review_minutes_endpoint(
    meeting_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """确认纪要审核"""
    item = await review_meeting_minutes(db, meeting_id, current_user)
    if not item:
        raise HTTPException(status_code=404, detail="会议不存在")
    return UnifiedResponse(data=MeetingRecordResponse.model_validate(item))


@router.post("/{meeting_id}/export")
async def export_meeting_endpoint(
    meeting_id: uuid.UUID,
    export_type: Literal["transcript", "audio", "minutes"] = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """导出会议内容（转录/音频/纪要）"""
    data = await export_meeting_data(db, meeting_id, current_user, export_type)
    if not data:
        raise HTTPException(status_code=404, detail="会议不存在")

    return UnifiedResponse(data=data)
