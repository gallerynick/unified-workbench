"""项目文档 API 路由"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.project_document import (
    ProjectDocumentCreate,
    ProjectDocumentListResponse,
    ProjectDocumentResponse,
    ProjectDocumentUpdate,
)
from app.services.project_document import (
    create_project_document,
    delete_project_document,
    get_project_document,
    list_project_documents,
    update_project_document,
)

router = APIRouter()


@router.post("/", response_model=UnifiedResponse[ProjectDocumentResponse])
async def create_project_document_endpoint(
    request: ProjectDocumentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await create_project_document(db, request.model_dump(), current_user.id)
    return UnifiedResponse(data=ProjectDocumentResponse.model_validate(doc))


@router.get("/", response_model=UnifiedResponse[ProjectDocumentListResponse])
async def list_project_documents_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    project_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    docs, total = await list_project_documents(
        db, current_user, page, page_size, project_id
    )
    items = [ProjectDocumentResponse.model_validate(d) for d in docs]
    return UnifiedResponse(data=ProjectDocumentListResponse(items=items, total=total))


@router.get("/{document_id}", response_model=UnifiedResponse[ProjectDocumentResponse])
async def get_project_document_endpoint(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await get_project_document(db, document_id, current_user)
    return UnifiedResponse(data=ProjectDocumentResponse.model_validate(doc))


@router.put("/{document_id}", response_model=UnifiedResponse[ProjectDocumentResponse])
async def update_project_document_endpoint(
    document_id: uuid.UUID,
    request: ProjectDocumentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await update_project_document(
        db, document_id, request.model_dump(exclude_unset=True), current_user
    )
    return UnifiedResponse(data=ProjectDocumentResponse.model_validate(doc))


@router.delete("/{document_id}", response_model=UnifiedResponse[None])
async def delete_project_document_endpoint(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_project_document(db, document_id, current_user)
    return UnifiedResponse(msg="项目文档删除成功")
