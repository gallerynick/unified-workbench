"""标签服务"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import Tag
from app.models.user_tag import UserTag
from app.schemas.tag import TagCreateRequest, TagUpdateRequest


async def list_tags(db: AsyncSession) -> list[Tag]:
    result = await db.execute(select(Tag).order_by(Tag.created_at.desc()))
    return list(result.scalars().all())


async def get_tag(db: AsyncSession, tag_id: uuid.UUID) -> Tag | None:
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    return result.scalar_one_or_none()


async def create_tag(db: AsyncSession, request: TagCreateRequest) -> Tag:
    tag = Tag(name=request.name, color=request.color)
    db.add(tag)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise ValueError("标签名称已存在")
    await db.refresh(tag)
    return tag


async def update_tag(db: AsyncSession, tag_id: uuid.UUID, request: TagUpdateRequest) -> Tag | None:
    tag = await get_tag(db, tag_id)
    if not tag:
        return None
    if request.name is not None:
        tag.name = request.name
    if request.color is not None:
        tag.color = request.color
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise ValueError("标签名称已存在")
    await db.refresh(tag)
    return tag


async def delete_tag(db: AsyncSession, tag_id: uuid.UUID) -> bool:
    tag = await get_tag(db, tag_id)
    if not tag:
        return False
    await db.execute(
        UserTag.__table__.delete().where(UserTag.tag_id == tag_id)
    )
    await db.delete(tag)
    await db.flush()
    return True
