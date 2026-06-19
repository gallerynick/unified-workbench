"""密钥分类服务。"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.secret_category import SecretCategory
from app.schemas.secret_category import (
    SecretCategoryCreateRequest,
    SecretCategoryUpdateRequest,
)


async def list_categories(
    db: AsyncSession,
    owner_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[SecretCategory], int]:
    query = select(SecretCategory).where(SecretCategory.owner_id == owner_id)
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(SecretCategory.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_category(
    db: AsyncSession,
    category_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> SecretCategory | None:
    result = await db.execute(
        select(SecretCategory).where(
            SecretCategory.id == category_id,
            SecretCategory.owner_id == owner_id,
        )
    )
    return result.scalar_one_or_none()


async def create_category(
    db: AsyncSession,
    owner_id: uuid.UUID,
    request: SecretCategoryCreateRequest,
) -> SecretCategory:
    category = SecretCategory(
        name=request.name,
        description=request.description,
        owner_id=owner_id,
    )
    db.add(category)
    await db.flush()
    await db.refresh(category)
    return category


async def update_category(
    db: AsyncSession,
    category_id: uuid.UUID,
    owner_id: uuid.UUID,
    request: SecretCategoryUpdateRequest,
) -> SecretCategory | None:
    category = await get_category(db, category_id, owner_id)
    if not category:
        return None
    if request.name is not None:
        category.name = request.name
    if request.description is not None:
        category.description = request.description
    await db.flush()
    await db.refresh(category)
    return category


async def delete_category(
    db: AsyncSession,
    category_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> bool:
    category = await get_category(db, category_id, owner_id)
    if not category:
        return False
    await db.delete(category)
    await db.flush()
    return True
