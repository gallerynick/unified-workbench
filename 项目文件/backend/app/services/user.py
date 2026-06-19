"""用户管理业务逻辑。"""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.tag import Tag
from app.models.user import User, UserRole, UserStatus
from app.models.user_tag import UserTag
from app.schemas.user import UserCreateRequest, UserUpdateRequest


async def list_users(
    db: AsyncSession, page: int = 1, page_size: int = 20, search: str = ""
) -> tuple[list[User], int]:
    """分页查询用户列表，支持按用户名/昵称搜索。"""
    query = select(User)
    count_query = select(func.count()).select_from(User)

    if search:
        like_pattern = f"%{search}%"
        condition = or_(
            User.username.ilike(like_pattern),
            User.nickname.ilike(like_pattern),
        )
        query = query.where(condition)
        count_query = count_query.where(condition)

    # 总数
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # 分页
    offset = (page - 1) * page_size
    query = query.order_by(User.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    users = list(result.scalars().all())

    return users, total


async def create_user(db: AsyncSession, request: UserCreateRequest) -> User:
    """创建用户（含密码哈希 + 标签关联）。"""
    # 检查用户名唯一性
    existing = await db.execute(select(User).where(User.username == request.username))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="用户名已存在"
        )

    user = User(
        username=request.username,
        password_hash=hash_password(request.password),
        nickname=request.nickname,
        role=UserRole(request.role),
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    await db.flush()

    # 关联标签
    if request.tags:
        for tag_id in request.tags:
            tag_result = await db.execute(select(Tag).where(Tag.id == uuid.UUID(str(tag_id))))
            tag = tag_result.scalar_one_or_none()
            if tag:
                db.add(UserTag(user_id=user.id, tag_id=tag.id))
        await db.flush()

    return user


async def get_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    """根据 ID 获取用户，不存在则 404。"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在"
        )
    return user


async def update_user(
    db: AsyncSession, user_id: uuid.UUID, request: UserUpdateRequest
) -> User:
    """更新用户信息。"""
    user = await get_user(db, user_id)

    changing_role = request.role is not None and request.role != user.role.value
    disabling = request.status is not None and request.status == "disabled" and user.status == UserStatus.ACTIVE

    if (changing_role or disabling) and user.role == UserRole.ADMIN:
        admin_count = await db.execute(
            select(func.count()).select_from(User).where(
                User.role == UserRole.ADMIN,
                User.status == UserStatus.ACTIVE,
            )
        )
        if admin_count.scalar_one() <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="至少需要保留一名管理员，无法修改最后一名管理员的角色或状态",
            )

    if request.nickname is not None:
        user.nickname = request.nickname
    if request.avatar is not None:
        user.avatar = request.avatar
    if request.role is not None:
        user.role = UserRole(request.role)
    if request.status is not None:
        user.status = UserStatus(request.status)

    # 标签更新：先删后建
    if request.tags is not None:
        # 删除旧关联
        await db.execute(
            delete(UserTag).where(UserTag.user_id == user.id)
        )
        # 建立新关联
        for tag_id in request.tags:
            tag_result = await db.execute(select(Tag).where(Tag.id == uuid.UUID(str(tag_id))))
            tag = tag_result.scalar_one_or_none()
            if tag:
                db.add(UserTag(user_id=user.id, tag_id=tag.id))

    await db.flush()
    return user


async def disable_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    """软删除：将用户状态设为禁用。"""
    user = await get_user(db, user_id)

    if user.role == UserRole.ADMIN:
        admin_count = await db.execute(
            select(func.count()).select_from(User).where(
                User.role == UserRole.ADMIN,
                User.status == UserStatus.ACTIVE,
            )
        )
        if admin_count.scalar_one() <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="至少需要保留一名管理员，无法禁用最后一名管理员",
            )

    user.status = UserStatus.DISABLED
    await db.flush()
    return user
