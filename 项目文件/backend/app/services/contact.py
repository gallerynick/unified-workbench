"""客户/联系人服务"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact, ContactType
from app.schemas.contact import ContactCreate, ContactUpdate


async def list_contacts(
    db: AsyncSession,
    owner_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
    contact_type: str | None = None,
    search: str | None = None,
) -> tuple[list[Contact], int]:
    query = select(Contact).where(Contact.owner_id == owner_id)
    if contact_type:
        query = query.where(Contact.contact_type == ContactType(contact_type))
    if search:
        query = query.where(
            Contact.name.ilike(f"%{search}%")
            | Contact.company.ilike(f"%{search}%")
            | Contact.email.ilike(f"%{search}%")
        )
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Contact.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_contact(db: AsyncSession, contact_id: uuid.UUID, owner_id: uuid.UUID) -> Contact | None:
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.owner_id == owner_id)
    )
    return result.scalar_one_or_none()


async def create_contact(db: AsyncSession, owner_id: uuid.UUID, request: ContactCreate) -> Contact:
    contact = Contact(
        name=request.name,
        company=request.company,
        email=request.email,
        phone=request.phone,
        address=request.address,
        contact_type=ContactType(request.contact_type),
        tags=request.tags,
        notes=request.notes,
        owner_id=owner_id,
    )
    db.add(contact)
    await db.flush()
    await db.refresh(contact)
    return contact


async def update_contact(db: AsyncSession, contact_id: uuid.UUID, owner_id: uuid.UUID, request: ContactUpdate) -> Contact | None:
    contact = await get_contact(db, contact_id, owner_id)
    if not contact:
        return None
    if request.name is not None:
        contact.name = request.name
    if request.company is not None:
        contact.company = request.company
    if request.email is not None:
        contact.email = request.email
    if request.phone is not None:
        contact.phone = request.phone
    if request.address is not None:
        contact.address = request.address
    if request.contact_type is not None:
        contact.contact_type = ContactType(request.contact_type)
    if request.tags is not None:
        contact.tags = request.tags
    if request.notes is not None:
        contact.notes = request.notes
    await db.flush()
    await db.refresh(contact)
    return contact


async def delete_contact(db: AsyncSession, contact_id: uuid.UUID, owner_id: uuid.UUID) -> bool:
    contact = await get_contact(db, contact_id, owner_id)
    if not contact:
        return False
    await db.delete(contact)
    await db.flush()
    return True
