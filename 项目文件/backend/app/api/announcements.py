"""公告 API 路由"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.user import User, UserRole
from app.schemas.common import UnifiedResponse
from app.schemas.announcement import AnnouncementCreate, AnnouncementListResponse, AnnouncementResponse, AnnouncementUpdate
from app.services.announcement import create_announcement, delete_announcement, get_announcement, list_announcements, update_announcement

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[AnnouncementListResponse])
async def list_announcements_endpoint(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), owner_id: uuid.UUID | None = Query(None), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    announcements, total = await list_announcements(db, page, page_size, owner_id)
    return UnifiedResponse(data=AnnouncementListResponse(items=[AnnouncementResponse.model_validate(a) for a in announcements], total=total))


@router.post("/", response_model=UnifiedResponse[AnnouncementResponse])
async def create_announcement_endpoint(request: AnnouncementCreate, current_user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    announcement = await create_announcement(db, current_user.id, request)
    return UnifiedResponse(data=AnnouncementResponse.model_validate(announcement))


@router.put("/{announcement_id}", response_model=UnifiedResponse[AnnouncementResponse])
async def update_announcement_endpoint(announcement_id: uuid.UUID, request: AnnouncementUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    announcement = await get_announcement(db, announcement_id)
    if not announcement:
        raise HTTPException(status_code=404, detail="公告不存在")
    if announcement.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="无权编辑此公告")
    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(announcement, field, value)
    await db.flush()
    await db.refresh(announcement)
    return UnifiedResponse(data=AnnouncementResponse.model_validate(announcement))


@router.delete("/{announcement_id}", response_model=UnifiedResponse[None])
async def delete_announcement_endpoint(announcement_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    announcement = await get_announcement(db, announcement_id)
    if not announcement:
        raise HTTPException(status_code=404, detail="公告不存在")
    if announcement.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="无权删除此公告")
    await db.delete(announcement)
    await db.flush()
    return UnifiedResponse(msg="公告已删除")
