"""笔记 API 路由"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.note import NoteCreate, NoteListResponse, NoteResponse, NoteUpdate
from app.services.note import create_note, delete_note, get_note, list_notes, list_all_notes, move_note, update_note

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[NoteListResponse])
async def list_notes_endpoint(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), search: str | None = Query(None), category: str | None = Query(None), parent_id: uuid.UUID | None = Query(None), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    notes, total = await list_notes(db, current_user.id, page, page_size, search, category)
    return UnifiedResponse(data=NoteListResponse(items=[NoteResponse.model_validate(n) for n in notes], total=total))


@router.get("/all", response_model=UnifiedResponse[NoteListResponse])
async def list_all_notes_endpoint(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    notes = await list_all_notes(db, current_user.id)
    return UnifiedResponse(data=NoteListResponse(items=[NoteResponse.model_validate(n) for n in notes], total=len(notes)))


@router.post("/", response_model=UnifiedResponse[NoteResponse])
async def create_note_endpoint(request: NoteCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    note = await create_note(db, current_user.id, request)
    return UnifiedResponse(data=NoteResponse.model_validate(note))


@router.get("/{note_id}", response_model=UnifiedResponse[NoteResponse])
async def get_note_endpoint(note_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    note = await get_note(db, note_id, current_user.id)
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    return UnifiedResponse(data=NoteResponse.model_validate(note))


@router.put("/{note_id}", response_model=UnifiedResponse[NoteResponse])
async def update_note_endpoint(note_id: uuid.UUID, request: NoteUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    note = await update_note(db, note_id, current_user.id, request)
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    return UnifiedResponse(data=NoteResponse.model_validate(note))


@router.put("/{note_id}/move", response_model=UnifiedResponse[NoteResponse])
async def move_note_endpoint(note_id: uuid.UUID, request: NoteUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        note = await move_note(db, note_id, current_user.id, request.parent_id)
        if not note:
            raise HTTPException(status_code=404, detail="笔记不存在")
        return UnifiedResponse(data=NoteResponse.model_validate(note))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{note_id}", response_model=UnifiedResponse[None])
async def delete_note_endpoint(note_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not await delete_note(db, note_id, current_user.id):
        raise HTTPException(status_code=404, detail="笔记不存在")
    return UnifiedResponse(msg="笔记已删除")
