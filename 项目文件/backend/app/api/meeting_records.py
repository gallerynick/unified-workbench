"""会议记录 API 路由"""

from __future__ import annotations

import uuid
from typing import Callable, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
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
    MeetingMinutesResponse,
    MeetingRecordCreate,
    MeetingRecordListResponse,
    MeetingRecordResponse,
    MeetingRecordUpdate,
    MeetingTranscriptSegmentResponse,
)
from app.services.meeting_record import (
    create_meeting_record,
    delete_meeting_record,
    end_meeting_record,
    export_meeting_data,
    get_meeting_record,
    get_transcript_segments,
    list_meeting_records,
    pause_meeting_record,
    review_meeting_minutes,
    resume_meeting_record,
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
        filename=f"{meeting.number}.wav",
    )


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
