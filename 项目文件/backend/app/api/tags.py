"""标签 API 路由"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.tag import TagCreateRequest, TagListResponse, TagResponse, TagUpdateRequest
from app.services.tag import create_tag, delete_tag, get_tag, list_tags, update_tag

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[TagListResponse])
async def list_tags_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tags = await list_tags(db)
    return UnifiedResponse(
        data=TagListResponse(
            items=[TagResponse.model_validate(t) for t in tags],
            total=len(tags),
        )
    )


@router.post("/", response_model=UnifiedResponse[TagResponse])
async def create_tag_endpoint(
    request: TagCreateRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        tag = await create_tag(db, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return UnifiedResponse(data=TagResponse.model_validate(tag))


@router.get("/{tag_id}", response_model=UnifiedResponse[TagResponse])
async def get_tag_endpoint(
    tag_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tag = await get_tag(db, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")
    return UnifiedResponse(data=TagResponse.model_validate(tag))


@router.put("/{tag_id}", response_model=UnifiedResponse[TagResponse])
async def update_tag_endpoint(
    tag_id: uuid.UUID,
    request: TagUpdateRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        tag = await update_tag(db, tag_id, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")
    return UnifiedResponse(data=TagResponse.model_validate(tag))


@router.delete("/{tag_id}", response_model=UnifiedResponse[None])
async def delete_tag_endpoint(
    tag_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    success = await delete_tag(db, tag_id)
    if not success:
        raise HTTPException(status_code=404, detail="标签不存在")
    return UnifiedResponse(msg="标签已删除")
