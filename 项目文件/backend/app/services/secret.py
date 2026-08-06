"""密钥业务逻辑"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.encryption import decrypt_data, encrypt_data
from app.core.security import verify_password
from app.core.visibility import Visibility
from app.models.secret import Secret
from app.models.user import User, UserRole
from app.services.notification.event_trigger import trigger_event_reminders
from app.services.visibility import check_visibility as build_visibility_filter


# ── 辅助函数 ──────────────────────────────────────────────────────────


def _visibility_get_check(item: Secret, user_id: uuid.UUID) -> bool:
    if item.owner_id == user_id:
        return True
    if item.visibility == Visibility.PUBLIC:
        return True
    if item.visibility == Visibility.RESTRICTED and item.restricted_users:
        if str(user_id) in item.restricted_users:
            return True
    return False


def _admin_can_manage_own_designated(item: Secret, user_id: uuid.UUID) -> bool:
    if item.owner_id == user_id:
        return True
    if item.visibility == Visibility.PUBLIC:
        return True
    if item.restricted_users and str(user_id) in item.restricted_users:
        return True
    return False


# ── 创建（不变）─────────────────────────────────────────────────────


async def create_secret(
    db: AsyncSession,
    data: dict,
    owner_id: uuid.UUID,
    name: str,
    secret_type: str = "other",
    note: str = "",
    category_id: uuid.UUID | None = None,
    sub_category: str = "",
) -> Secret:
    """创建密钥，加密 data 后存储"""
    settings = get_settings()
    encrypted = encrypt_data(data, settings.ENCRYPTION_MASTER_KEY)

    secret = Secret(
        name=name,
        secret_type=secret_type,
        encrypted_data=encrypted,
        note=note,
        owner_id=owner_id,
        category_id=category_id,
        sub_category=sub_category,
    )
    db.add(secret)
    await db.flush()
    return secret


# ── 列表 ──────────────────────────────────────────────────────────────


async def list_secrets(
    db: AsyncSession,
    current_user: User,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
) -> tuple[list[Secret], int]:
    """列出密钥（不含加密数据），可见性过滤"""
    visibility_cond = build_visibility_filter(Secret, current_user.id)
    query = select(Secret).where(visibility_cond)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(Secret.name.ilike(pattern), Secret.note.ilike(pattern))
        )

    query = query.order_by(Secret.created_at.desc())
    result = await db.execute(query)
    all_secrets = list(result.scalars().all())

    total = len(all_secrets)
    start = (page - 1) * page_size
    return all_secrets[start : start + page_size], total


# ── 获取 ──────────────────────────────────────────────────────────────


async def get_secret(
    db: AsyncSession, secret_id: uuid.UUID, current_user: User
) -> Secret:
    """获取密钥元数据（不含加密数据），检查可见性"""
    result = await db.execute(select(Secret).where(Secret.id == secret_id))
    secret = result.scalar_one_or_none()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="密钥不存在"
        )
    if not _visibility_get_check(secret, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权访问"
        )
    return secret


# ── 删除 ──────────────────────────────────────────────────────────────


async def delete_secret(
    db: AsyncSession, secret_id: uuid.UUID, current_user: User
) -> None:
    """删除密钥（owner 或 admin 满足 own+designated 规则）"""
    result = await db.execute(select(Secret).where(Secret.id == secret_id))
    secret = result.scalar_one_or_none()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="密钥不存在"
        )

    # 可见性检查
    if not _visibility_get_check(secret, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权访问"
        )

    # 管理权限：owner 或 admin（own+designated）
    if secret.owner_id != current_user.id:
        if current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="仅所有者或管理员可删除",
            )
        if not _admin_can_manage_own_designated(secret, current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="仅所有者或管理员可删除",
            )

    await db.delete(secret)
    await db.flush()


# ── 验证解密 ──────────────────────────────────────────────────────────


async def verify_and_decrypt(
    db: AsyncSession,
    secret_id: uuid.UUID,
    password: str,
    current_user: User,
) -> dict:
    """验证用户登录密码后解密并返回密钥数据，可见性检查"""
    if not verify_password(password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="密码验证失败"
        )

    # 先通过 get_secret 做可见性检查
    secret = await get_secret(db, secret_id, current_user)

    settings = get_settings()
    try:
        decrypted = decrypt_data(
            secret.encrypted_data, settings.ENCRYPTION_MASTER_KEY
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="密钥数据解密失败",
        )

    await trigger_event_reminders(
        db,
        "secret_access",
        {
            "secret_id": str(secret.id),
            "secret_name": secret.name,
            "user_id": str(current_user.id),
        },
    )

    return decrypted
