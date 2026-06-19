"""密钥分类 API 路由。"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.secret_category import (
    SecretCategoryCreateRequest,
    SecretCategoryListResponse,
    SecretCategoryResponse,
    SecretCategoryUpdateRequest,
)
from app.services.secret_category import (
    create_category,
    delete_category,
    get_category,
    list_categories,
    update_category,
)

router = APIRouter()


@router.get("", response_model=UnifiedResponse[SecretCategoryListResponse])
async def list_categories_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    categories, total = await list_categories(db, current_user.id, page, page_size)
    return UnifiedResponse(
        data=SecretCategoryListResponse(
            items=[SecretCategoryResponse.model_validate(c) for c in categories],
            total=total,
        )
    )


@router.post("", response_model=UnifiedResponse[SecretCategoryResponse])
async def create_category_endpoint(
    request: SecretCategoryCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category = await create_category(db, current_user.id, request)
    return UnifiedResponse(data=SecretCategoryResponse.model_validate(category))


@router.get("/{category_id}", response_model=UnifiedResponse[SecretCategoryResponse])
async def get_category_endpoint(
    category_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category = await get_category(db, category_id, current_user.id)
    if not category:
        raise HTTPException(status_code=404, detail="分类不存在")
    return UnifiedResponse(data=SecretCategoryResponse.model_validate(category))


@router.put("/{category_id}", response_model=UnifiedResponse[SecretCategoryResponse])
async def update_category_endpoint(
    category_id: uuid.UUID,
    request: SecretCategoryUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category = await update_category(db, category_id, current_user.id, request)
    if not category:
        raise HTTPException(status_code=404, detail="分类不存在")
    return UnifiedResponse(data=SecretCategoryResponse.model_validate(category))


@router.delete("/{category_id}", response_model=UnifiedResponse[None])
async def delete_category_endpoint(
    category_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    success = await delete_category(db, category_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="分类不存在")
    return UnifiedResponse(msg="分类已删除")
