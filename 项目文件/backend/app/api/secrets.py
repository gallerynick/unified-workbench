"""密钥 API 路由"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.secret import (
    PasswordVerifyRequest,
    SecretCreate,
    SecretListResponse,
    SecretResponse,
    SecretVerifyResponse,
)
from app.services.secret import (
    create_secret,
    delete_secret,
    get_secret,
    list_secrets,
    verify_and_decrypt,
)

router = APIRouter()


@router.post("/", response_model=UnifiedResponse[SecretResponse])
async def create_secret_endpoint(
    request: SecretCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建密钥"""
    secret = await create_secret(
        db,
        data=request.data,
        owner_id=current_user.id,
        name=request.name,
        secret_type=request.secret_type,
        note=request.note,
    )
    return UnifiedResponse(data=SecretResponse.model_validate(secret))


@router.get("/", response_model=UnifiedResponse[SecretListResponse])
async def list_secrets_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出密钥"""
    secrets, total = await list_secrets(db, current_user, page, page_size, search)
    items = [SecretResponse.model_validate(s) for s in secrets]
    return UnifiedResponse(data=SecretListResponse(items=items, total=total))


@router.get("/{secret_id}", response_model=UnifiedResponse[SecretResponse])
async def get_secret_endpoint(
    secret_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取密钥元数据"""
    secret = await get_secret(db, secret_id, current_user)
    return UnifiedResponse(data=SecretResponse.model_validate(secret))


@router.delete("/{secret_id}", response_model=UnifiedResponse[None])
async def delete_secret_endpoint(
    secret_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除密钥"""
    await delete_secret(db, secret_id, current_user)
    return UnifiedResponse(msg="密钥删除成功")


@router.post("/{secret_id}/verify", response_model=UnifiedResponse[SecretVerifyResponse])
async def verify_secret_endpoint(
    secret_id: uuid.UUID,
    request: PasswordVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """验证密码后解密并返回密钥数据"""
    decrypted = await verify_and_decrypt(db, secret_id, request.password, current_user)
    secret = await get_secret(db, secret_id, current_user)
    return UnifiedResponse(
        data=SecretVerifyResponse(
            id=secret.id,
            name=secret.name,
            secret_type=secret.secret_type,
            data=decrypted,
            note=secret.note,
            created_at=secret.created_at,
        )
    )
