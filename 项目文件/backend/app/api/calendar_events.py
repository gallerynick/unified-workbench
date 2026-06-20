"""日历事件 API 路由"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.calendar_event import CalendarEventCreate, CalendarEventListResponse, CalendarEventResponse, CalendarEventUpdate
from app.services.calendar_event import create_event, delete_event, get_event, list_events, update_event

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[CalendarEventListResponse])
async def list_events_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    events, total = await list_events(db, current_user.id, page, page_size, start_date, end_date)
    return UnifiedResponse(
        data=CalendarEventListResponse(
            items=[CalendarEventResponse.model_validate(e) for e in events],
            total=total,
        )
    )


@router.post("/", response_model=UnifiedResponse[CalendarEventResponse])
async def create_event_endpoint(
    request: CalendarEventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = await create_event(db, current_user.id, request)
    return UnifiedResponse(data=CalendarEventResponse.model_validate(event))


@router.get("/{event_id}", response_model=UnifiedResponse[CalendarEventResponse])
async def get_event_endpoint(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = await get_event(db, event_id, current_user.id)
    if not event:
        raise HTTPException(status_code=404, detail="事件不存在")
    return UnifiedResponse(data=CalendarEventResponse.model_validate(event))


@router.put("/{event_id}", response_model=UnifiedResponse[CalendarEventResponse])
async def update_event_endpoint(
    event_id: uuid.UUID,
    request: CalendarEventUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = await update_event(db, event_id, current_user.id, request)
    if not event:
        raise HTTPException(status_code=404, detail="事件不存在")
    return UnifiedResponse(data=CalendarEventResponse.model_validate(event))


@router.delete("/{event_id}", response_model=UnifiedResponse[None])
async def delete_event_endpoint(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    success = await delete_event(db, event_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="事件不存在")
    return UnifiedResponse(msg="事件已删除")
