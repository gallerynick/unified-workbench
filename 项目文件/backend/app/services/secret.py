"""密钥业务逻辑"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.encryption import decrypt_data, encrypt_data
from app.core.security import verify_password
from app.models.secret import Secret
from app.models.user import User
from app.services.notification.event_trigger import trigger_event_reminders


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


async def list_secrets(
    db: AsyncSession,
    current_user: User,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
) -> tuple[list[Secret], int]:
    """列出密钥（不含加密数据），强制私有：仅返回当前用户的密钥"""
    query = select(Secret).where(Secret.owner_id == current_user.id)

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


async def get_secret(db: AsyncSession, secret_id: uuid.UUID, current_user: User) -> Secret:
    """获取密钥元数据（不含加密数据），强制私有：仅所有者可访问"""
    result = await db.execute(select(Secret).where(Secret.id == secret_id))
    secret = result.scalar_one_or_none()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="密钥不存在"
        )
    if secret.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="密钥不存在"
        )
    return secret


async def delete_secret(db: AsyncSession, secret_id: uuid.UUID, current_user: User) -> None:
    """删除密钥（仅所有者或管理员）"""
    result = await db.execute(select(Secret).where(Secret.id == secret_id))
    secret = result.scalar_one_or_none()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="密钥不存在"
        )

    from app.models.user import UserRole

    if secret.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="仅所有者或管理员可删除"
        )

    await db.delete(secret)
    await db.flush()


async def verify_and_decrypt(
    db: AsyncSession,
    secret_id: uuid.UUID,
    password: str,
    current_user: User,
) -> dict:
    """验证用户登录密码后解密并返回密钥数据，强制私有：仅所有者可访问"""
    if not verify_password(password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="密码验证失败"
        )

    result = await db.execute(select(Secret).where(Secret.id == secret_id))
    secret = result.scalar_one_or_none()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="密钥不存在"
        )
    if secret.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="密钥不存在"
        )

    settings = get_settings()
    try:
        decrypted = decrypt_data(secret.encrypted_data, settings.ENCRYPTION_MASTER_KEY)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="密钥数据解密失败",
        )

    await trigger_event_reminders(db, "secret_access", {
        "secret_id": str(secret.id),
        "secret_name": secret.name,
        "user_id": str(current_user.id),
    })

    return decrypted
