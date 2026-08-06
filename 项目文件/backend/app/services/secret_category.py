"""密钥分类服务。"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.visibility import Visibility
from app.models.secret import Secret
from app.models.secret_category import SecretCategory
from app.models.user import User, UserRole
from app.schemas.secret_category import (
    SecretCategoryCreateRequest,
    SecretCategoryUpdateRequest,
)
from app.services.visibility import check_visibility as build_visibility_filter


# ── 辅助函数 ──────────────────────────────────────────────────────────


def _visibility_get_check(item: SecretCategory, user_id: uuid.UUID) -> bool:
    if item.owner_id == user_id:
        return True
    if item.visibility == Visibility.PUBLIC:
        return True
    if item.visibility == Visibility.RESTRICTED and item.restricted_users:
        if str(user_id) in item.restricted_users:
            return True
    return False


def _admin_can_manage_own_designated(
    item: SecretCategory, user_id: uuid.UUID
) -> bool:
    if item.owner_id == user_id:
        return True
    if item.visibility == Visibility.PUBLIC:
        return True
    if item.restricted_users and str(user_id) in item.restricted_users:
        return True
    return False


# ── 列表 ──────────────────────────────────────────────────────────────


async def list_categories(
    db: AsyncSession,
    owner_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[SecretCategory], int]:
    user_id = owner_id
    visibility_cond = build_visibility_filter(SecretCategory, user_id)
    query = select(SecretCategory).where(visibility_cond)
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(SecretCategory.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


# ── 获取 ──────────────────────────────────────────────────────────────


async def get_category(
    db: AsyncSession,
    category_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> SecretCategory | None:
    user_id = owner_id
    result = await db.execute(
        select(SecretCategory).where(SecretCategory.id == category_id)
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


# ── 更新 ──────────────────────────────────────────────────────────────


async def update_category(
    db: AsyncSession,
    category_id: uuid.UUID,
    owner_id: uuid.UUID,
    request: SecretCategoryUpdateRequest,
) -> SecretCategory | None:
    user_id = owner_id
    category = await get_category(db, category_id, user_id)
    if not category:
        return None

    # 权限检查：owner 或 admin（own+designated）
    if category.owner_id != user_id:
        _role_result = await db.execute(
            select(User.role).where(User.id == user_id)
        )
        _user_role = _role_result.scalar_one_or_none()
        _is_admin = _user_role == UserRole.ADMIN
        if not (
            _is_admin
            and _admin_can_manage_own_designated(category, user_id)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权修改"
            )

    if request.name is not None:
        category.name = request.name
    if request.description is not None:
        category.description = request.description
    await db.flush()
    await db.refresh(category)
    return category


# ── 删除 ──────────────────────────────────────────────────────────────


async def delete_category(
    db: AsyncSession,
    category_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> bool:
    user_id = owner_id
    category = await get_category(db, category_id, user_id)
    if not category:
        return False

    # 权限检查：owner 或 admin（own+designated）
    if category.owner_id != user_id:
        _role_result = await db.execute(
            select(User.role).where(User.id == user_id)
        )
        _user_role = _role_result.scalar_one_or_none()
        _is_admin = _user_role == UserRole.ADMIN
        if not (
            _is_admin
            and _admin_can_manage_own_designated(category, user_id)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权删除"
            )

    # 先将该分类下的密钥的 category_id 设为 NULL
    await db.execute(
        update(Secret)
        .where(Secret.category_id == category_id)
        .values(category_id=None)
    )
    await db.delete(category)
    await db.flush()
    return True
