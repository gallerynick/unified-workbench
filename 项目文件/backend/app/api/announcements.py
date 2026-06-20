"""公告 API 路由"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.announcement import AnnouncementCreate, AnnouncementListResponse, AnnouncementResponse, AnnouncementUpdate
from app.services.announcement import create_announcement, delete_announcement, get_announcement, list_announcements, update_announcement

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[AnnouncementListResponse])
async def list_announcements_endpoint(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    announcements, total = await list_announcements(db, page, page_size)
    return UnifiedResponse(data=AnnouncementListResponse(items=[AnnouncementResponse.model_validate(a) for a in announcements], total=total))


@router.post("/", response_model=UnifiedResponse[AnnouncementResponse])
async def create_announcement_endpoint(request: AnnouncementCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    announcement = await create_announcement(db, current_user.id, request)
    return UnifiedResponse(data=AnnouncementResponse.model_validate(announcement))


@router.put("/{announcement_id}", response_model=UnifiedResponse[AnnouncementResponse])
async def update_announcement_endpoint(announcement_id: uuid.UUID, request: AnnouncementUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    announcement = await update_announcement(db, announcement_id, current_user.id, request)
    if not announcement:
        raise HTTPException(status_code=404, detail="公告不存在")
    return UnifiedResponse(data=AnnouncementResponse.model_validate(announcement))


@router.delete("/{announcement_id}", response_model=UnifiedResponse[None])
async def delete_announcement_endpoint(announcement_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not await delete_announcement(db, announcement_id, current_user.id):
        raise HTTPException(status_code=404, detail="公告不存在")
    return UnifiedResponse(msg="公告已删除")
