"""关联关系 API 路由"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.link_relation import (
    LinkRelationCreate,
    LinkRelationListResponse,
    LinkRelationResponse,
)
from app.services.link_relation import (
    create_relation,
    delete_relation,
    get_linked_entities,
    list_relations,
)

router = APIRouter()


@router.post("/", response_model=UnifiedResponse[LinkRelationListResponse])
async def create_relation_endpoint(
    request: LinkRelationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    relations = await create_relation(
        db,
        request.source_type,
        request.source_id,
        request.target_type,
        request.target_id,
    )
    return UnifiedResponse(
        data=LinkRelationListResponse(
            items=[LinkRelationResponse.model_validate(r) for r in relations],
            total=len(relations),
        )
    )


@router.get("/", response_model=UnifiedResponse[LinkRelationListResponse])
async def list_relations_endpoint(
    source_type: str = Query(...),
    source_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    relations, total = await list_relations(db, source_type, source_id)
    return UnifiedResponse(
        data=LinkRelationListResponse(
            items=[LinkRelationResponse.model_validate(r) for r in relations],
            total=total,
        )
    )


@router.get("/linked-entities", response_model=UnifiedResponse[list])
async def linked_entities_endpoint(
    source_type: str = Query(...),
    source_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entities = await get_linked_entities(db, source_type, source_id)
    return UnifiedResponse(data=entities)


@router.delete("/", response_model=UnifiedResponse[None])
async def delete_relation_endpoint(
    source_type: str = Query(...),
    source_id: uuid.UUID = Query(...),
    target_type: str = Query(...),
    target_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await delete_relation(db, source_type, source_id, target_type, target_id)
    if not ok:
        raise HTTPException(status_code=404, detail="关联关系不存在")
    return UnifiedResponse(msg="关联关系已删除")
