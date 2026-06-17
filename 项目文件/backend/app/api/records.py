"""记录 API 路由"""

from __future__ import annotations

import uuid
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.record import (
    RecordCreate,
    RecordListResponse,
    RecordResponse,
    RecordStatusUpdate,
    RecordUpdate,
)
from app.services.export import export_to_excel, export_to_pdf, export_to_word
from app.services.record import (
    create_record,
    delete_record,
    get_record,
    list_records,
    update_record,
    update_record_status,
)


def _content_disposition(filename: str) -> str:
    """生成 RFC 5987 Content-Disposition header，支持中文文件名。"""
    encoded = quote(filename)
    return f"attachment; filename*=UTF-8''{encoded}"

router = APIRouter()


@router.post("/", response_model=UnifiedResponse[RecordResponse])
async def create_record_endpoint(
    request: RecordCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = await create_record(db, request.model_dump(), current_user.id)
    return UnifiedResponse(data=RecordResponse.model_validate(record))


@router.get("/", response_model=UnifiedResponse[RecordListResponse])
async def list_records_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type: str | None = Query(None),
    status: str | None = Query(None),
    search: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    records, total = await list_records(db, current_user, page, page_size, type, status, search)
    items = [RecordResponse.model_validate(r) for r in records]
    return UnifiedResponse(data=RecordListResponse(items=items, total=total))


@router.get("/{record_id}", response_model=UnifiedResponse[RecordResponse])
async def get_record_endpoint(
    record_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = await get_record(db, record_id, current_user)
    return UnifiedResponse(data=RecordResponse.model_validate(record))


@router.put("/{record_id}", response_model=UnifiedResponse[RecordResponse])
async def update_record_endpoint(
    record_id: uuid.UUID,
    request: RecordUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = await update_record(
        db, record_id, request.model_dump(exclude_unset=True), current_user
    )
    return UnifiedResponse(data=RecordResponse.model_validate(record))


@router.delete("/{record_id}", response_model=UnifiedResponse[None])
async def delete_record_endpoint(
    record_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_record(db, record_id, current_user)
    return UnifiedResponse(msg="记录删除成功")


@router.put("/{record_id}/status", response_model=UnifiedResponse[RecordResponse])
async def update_record_status_endpoint(
    record_id: uuid.UUID,
    request: RecordStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = await update_record_status(db, record_id, request.status, current_user)
    return UnifiedResponse(data=RecordResponse.model_validate(record))


@router.get("/{record_id}/export/word")
async def export_word_endpoint(
    record_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = await get_record(db, record_id, current_user)
    buf = export_to_word(record)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": _content_disposition(f"{record.title}.docx")},
    )


@router.get("/{record_id}/export/pdf")
async def export_pdf_endpoint(
    record_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = await get_record(db, record_id, current_user)
    buf = export_to_pdf(record)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": _content_disposition(f"{record.title}.pdf")},
    )


@router.get("/{record_id}/export/excel")
async def export_excel_endpoint(
    record_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = await get_record(db, record_id, current_user)
    buf = export_to_excel(record)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": _content_disposition(f"{record.title}.xlsx")},
    )
