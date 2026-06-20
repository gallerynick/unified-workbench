"""模板 API 路由"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.template import (
    TemplateCreate,
    TemplateListResponse,
    TemplateResponse,
    TemplateUpdate,
)
from app.services.template import (
    create_template,
    delete_template,
    export_template_json,
    get_template,
    import_template_json,
    list_templates,
    update_template,
)

router = APIRouter()


@router.post("/", response_model=UnifiedResponse[TemplateResponse])
async def create_template_endpoint(
    request: TemplateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    template = await create_template(
        db, request.model_dump(by_alias=True), current_user.id
    )
    return UnifiedResponse(data=TemplateResponse.model_validate(template))


@router.get("/", response_model=UnifiedResponse[TemplateListResponse])
async def list_templates_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: str | None = Query(None),
    search: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    templates, total = await list_templates(db, page, page_size, category, search)
    items = [TemplateResponse.model_validate(t) for t in templates]
    return UnifiedResponse(data=TemplateListResponse(items=items, total=total))


@router.get("/{template_id}", response_model=UnifiedResponse[TemplateResponse])
async def get_template_endpoint(
    template_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    template = await get_template(db, template_id)
    return UnifiedResponse(data=TemplateResponse.model_validate(template))


@router.put("/{template_id}", response_model=UnifiedResponse[TemplateResponse])
async def update_template_endpoint(
    template_id: uuid.UUID,
    request: TemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    template = await update_template(
        db, template_id, request.model_dump(exclude_unset=True, by_alias=True), current_user
    )
    return UnifiedResponse(data=TemplateResponse.model_validate(template))


@router.delete("/{template_id}", response_model=UnifiedResponse[None])
async def delete_template_endpoint(
    template_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_template(db, template_id, current_user)
    return UnifiedResponse(msg="模板删除成功")


@router.get("/{template_id}/export", response_model=UnifiedResponse[dict])
async def export_template_endpoint(
    template_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await export_template_json(db, template_id)
    return UnifiedResponse(data=data)


@router.post("/import", response_model=UnifiedResponse[TemplateResponse])
async def import_template_endpoint(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    template = await import_template_json(db, request, current_user.id)
    return UnifiedResponse(data=TemplateResponse.model_validate(template))
