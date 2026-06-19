"""客户/联系人 API 路由"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.contact import ContactCreate, ContactListResponse, ContactResponse, ContactUpdate
from app.services.contact import create_contact, delete_contact, get_contact, list_contacts, update_contact

router = APIRouter()


@router.get("", response_model=UnifiedResponse[ContactListResponse])
async def list_contacts_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    contact_type: str | None = Query(None),
    search: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contacts, total = await list_contacts(db, current_user.id, page, page_size, contact_type, search)
    return UnifiedResponse(
        data=ContactListResponse(
            items=[ContactResponse.model_validate(c) for c in contacts],
            total=total,
        )
    )


@router.post("", response_model=UnifiedResponse[ContactResponse])
async def create_contact_endpoint(
    request: ContactCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = await create_contact(db, current_user.id, request)
    return UnifiedResponse(data=ContactResponse.model_validate(contact))


@router.get("/{contact_id}", response_model=UnifiedResponse[ContactResponse])
async def get_contact_endpoint(
    contact_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = await get_contact(db, contact_id, current_user.id)
    if not contact:
        raise HTTPException(status_code=404, detail="联系人不存在")
    return UnifiedResponse(data=ContactResponse.model_validate(contact))


@router.put("/{contact_id}", response_model=UnifiedResponse[ContactResponse])
async def update_contact_endpoint(
    contact_id: uuid.UUID,
    request: ContactUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = await update_contact(db, contact_id, current_user.id, request)
    if not contact:
        raise HTTPException(status_code=404, detail="联系人不存在")
    return UnifiedResponse(data=ContactResponse.model_validate(contact))


@router.delete("/{contact_id}", response_model=UnifiedResponse[None])
async def delete_contact_endpoint(
    contact_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    success = await delete_contact(db, contact_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="联系人不存在")
    return UnifiedResponse(msg="联系人已删除")
