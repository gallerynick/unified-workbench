"""内容管理 API 路由。"""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.content import (
    ContentCreateRequest,
    ContentListResponse,
    ContentResponse,
    ContentUpdateRequest,
)
from app.services.content import (
    create_content,
    delete_content,
    get_content,
    list_contents,
    update_content,
)

router = APIRouter()


@router.post("", response_model=UnifiedResponse[ContentResponse])
async def create_content_endpoint(
    request: ContentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建内容。"""
    content = await create_content(db, request, current_user)
    return UnifiedResponse(data=ContentResponse.model_validate(content))


@router.get("", response_model=UnifiedResponse[ContentListResponse])
async def list_contents_endpoint(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    search: str = Query("", description="搜索关键词（标题/正文）"),
    tag: str = Query("", description="标签筛选"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """查询内容列表（含可见性过滤和搜索）。"""
    contents, total = await list_contents(
        db,
        current_user,
        search=search or None,
        tag=tag or None,
        page=page,
        page_size=page_size,
    )
    return UnifiedResponse(
        data=ContentListResponse(
            items=[ContentResponse.model_validate(c) for c in contents],
            total=total,
        )
    )


@router.get("/{content_id}", response_model=UnifiedResponse[ContentResponse])
async def get_content_endpoint(
    content_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取内容详情。"""
    content = await get_content(db, uuid.UUID(content_id), current_user)
    return UnifiedResponse(data=ContentResponse.model_validate(content))


@router.put("/{content_id}", response_model=UnifiedResponse[ContentResponse])
async def update_content_endpoint(
    content_id: str,
    request: ContentUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新内容（仅 owner 或 admin）。"""
    content = await update_content(db, uuid.UUID(content_id), request, current_user)
    return UnifiedResponse(data=ContentResponse.model_validate(content))


@router.delete("/{content_id}", response_model=UnifiedResponse[None])
async def delete_content_endpoint(
    content_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除内容（仅 owner 或 admin）。"""
    await delete_content(db, uuid.UUID(content_id), current_user)
    return UnifiedResponse(msg="内容已删除")
