"""客户/联系人服务"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.visibility import Visibility
from app.models.contact import Contact, ContactType
from app.models.user import User, UserRole
from app.schemas.contact import ContactCreate, ContactUpdate
from app.services.visibility import check_visibility as build_visibility_filter


# ── 辅助函数 ──────────────────────────────────────────────────────────


def _visibility_get_check(item: Contact, user_id: uuid.UUID) -> bool:
    if item.owner_id == user_id:
        return True
    if item.visibility == Visibility.PUBLIC:
        return True
    if item.visibility == Visibility.RESTRICTED and item.restricted_users:
        if str(user_id) in item.restricted_users:
            return True
    return False


def _admin_can_manage_own_designated(item: Contact, user_id: uuid.UUID) -> bool:
    if item.owner_id == user_id:
        return True
    if item.visibility == Visibility.PUBLIC:
        return True
    if item.restricted_users and str(user_id) in item.restricted_users:
        return True
    return False


# ── 列表 ──────────────────────────────────────────────────────────────


async def list_contacts(
    db: AsyncSession,
    owner_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
    contact_type: str | None = None,
    search: str | None = None,
) -> tuple[list[Contact], int]:
    user_id = owner_id
    visibility_cond = build_visibility_filter(Contact, user_id)
    query = select(Contact).where(visibility_cond)

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


# ── 获取 ──────────────────────────────────────────────────────────────


async def get_contact(
    db: AsyncSession, contact_id: uuid.UUID, owner_id: uuid.UUID
) -> Contact | None:
    user_id = owner_id
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        return None
    if not _visibility_get_check(item, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权访问"
        )
    return item


# ── 创建（不变）─────────────────────────────────────────────────────


async def create_contact(
    db: AsyncSession, owner_id: uuid.UUID, request: ContactCreate
) -> Contact:
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


# ── 更新 ──────────────────────────────────────────────────────────────


async def update_contact(
    db: AsyncSession,
    contact_id: uuid.UUID,
    owner_id: uuid.UUID,
    request: ContactUpdate,
) -> Contact | None:
    user_id = owner_id
    contact = await get_contact(db, contact_id, user_id)
    if not contact:
        return None

    if contact.owner_id != user_id:
        _role_result = await db.execute(
            select(User.role).where(User.id == user_id)
        )
        _user_role = _role_result.scalar_one_or_none()
        _is_admin = _user_role == UserRole.ADMIN
        if not (_is_admin and _admin_can_manage_own_designated(contact, user_id)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权修改"
            )

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


# ── 删除 ──────────────────────────────────────────────────────────────


async def delete_contact(
    db: AsyncSession, contact_id: uuid.UUID, owner_id: uuid.UUID
) -> bool:
    user_id = owner_id
    contact = await get_contact(db, contact_id, user_id)
    if not contact:
        return False

    if contact.owner_id != user_id:
        _role_result = await db.execute(
            select(User.role).where(User.id == user_id)
        )
        _user_role = _role_result.scalar_one_or_none()
        _is_admin = _user_role == UserRole.ADMIN
        if not (_is_admin and _admin_can_manage_own_designated(contact, user_id)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权删除"
            )

    await db.delete(contact)
    await db.flush()
    return True
