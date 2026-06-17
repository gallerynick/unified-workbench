"""内容管理业务逻辑。"""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import String, cast, delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import check_visibility
from app.models.content import Content
from app.models.content_file import ContentFile
from app.models.user import User, UserRole
from app.schemas.content import ContentCreateRequest, ContentUpdateRequest
from app.services.audit import log_audit


async def create_content(
    db: AsyncSession, request: ContentCreateRequest, current_user: User
) -> Content:
    """创建内容，关联文件，记录审计日志。"""
    content = Content(
        title=request.title,
        body=request.body,
        owner_id=current_user.id,
        visibility=request.visibility,
        restricted_users=request.restricted_users,
        restricted_tags=request.restricted_tags,
        tags=request.tags,
    )
    db.add(content)
    await db.flush()

    # 关联文件
    if request.file_ids:
        for file_id in request.file_ids:
            cf = ContentFile(content_id=content.id, file_id=uuid.UUID(file_id))
            db.add(cf)
        await db.flush()

    # 审计日志
    await log_audit(
        db,
        user_id=current_user.id,
        action="create_content",
        target_type="content",
        target_id=str(content.id),
        detail={"title": content.title},
    )

    return content


async def get_content(
    db: AsyncSession, content_id: uuid.UUID, current_user: User
) -> Content:
    """获取内容详情，检查可见性。"""
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="内容不存在"
        )

    # 可见性检查
    restricted_users_set = None
    if content.restricted_users:
        restricted_users_set = {
            uuid.UUID(uid) if isinstance(uid, str) else uid
            for uid in content.restricted_users
        }
    restricted_tags_set = set(content.restricted_tags) if content.restricted_tags else None

    if not check_visibility(
        user=current_user,
        visibility=content.visibility,
        owner_id=content.owner_id,
        restricted_users=restricted_users_set,
        restricted_tags=restricted_tags_set,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权查看此内容"
        )

    return content


async def update_content(
    db: AsyncSession,
    content_id: uuid.UUID,
    request: ContentUpdateRequest,
    current_user: User,
) -> Content:
    """更新内容，仅 owner 或 admin 可操作。"""
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="内容不存在"
        )

    # 权限检查：owner 或 admin
    if content.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权修改此内容"
        )

    # 更新字段
    if request.title is not None:
        content.title = request.title
    if request.body is not None:
        content.body = request.body
    if request.visibility is not None:
        content.visibility = request.visibility
    if request.restricted_users is not None:
        content.restricted_users = request.restricted_users
    if request.restricted_tags is not None:
        content.restricted_tags = request.restricted_tags
    if request.tags is not None:
        content.tags = request.tags

    # 更新文件关联：先删后建
    if request.file_ids is not None:
        await db.execute(
            delete(ContentFile).where(ContentFile.content_id == content_id)
        )
        for file_id in request.file_ids:
            cf = ContentFile(content_id=content_id, file_id=uuid.UUID(file_id))
            db.add(cf)

    await db.flush()
    await db.refresh(content)

    # 审计日志
    await log_audit(
        db,
        user_id=current_user.id,
        action="update_content",
        target_type="content",
        target_id=str(content.id),
        detail={"title": content.title},
    )

    return content


async def delete_content(
    db: AsyncSession, content_id: uuid.UUID, current_user: User
) -> None:
    """删除内容，仅 owner 或 admin 可操作。"""
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="内容不存在"
        )

    # 权限检查：owner 或 admin
    if content.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权删除此内容"
        )

    # 审计日志（先记再删）
    await log_audit(
        db,
        user_id=current_user.id,
        action="delete_content",
        target_type="content",
        target_id=str(content.id),
        detail={"title": content.title},
    )

    # 删除关联文件记录
    await db.execute(
        delete(ContentFile).where(ContentFile.content_id == content_id)
    )

    # 删除内容
    await db.delete(content)
    await db.flush()


async def list_contents(
    db: AsyncSession,
    current_user: User,
    search: str | None = None,
    tag: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Content], int]:
    """分页查询内容列表，支持搜索和可见性过滤。"""
    query = select(Content)

    # 搜索过滤
    if search:
        like_pattern = f"%{search}%"
        search_condition = or_(
            Content.title.ilike(like_pattern),
            cast(Content.body, String).like(like_pattern),
        )
        query = query.where(search_condition)

    # 标签过滤
    if tag:
        tag_pattern = f'%"{tag}"%'
        query = query.where(cast(Content.tags, String).like(tag_pattern))

    # 按创建时间倒序
    query = query.order_by(Content.created_at.desc())

    result = await db.execute(query)
    all_contents = list(result.scalars().all())

    # 可见性过滤（在 Python 中处理，因为 restricted 检查涉及用户标签匹配）
    visible_contents = []
    for content in all_contents:
        restricted_users_set = None
        if content.restricted_users:
            restricted_users_set = {
                uuid.UUID(uid) if isinstance(uid, str) else uid
                for uid in content.restricted_users
            }
        restricted_tags_set = (
            set(content.restricted_tags) if content.restricted_tags else None
        )

        if check_visibility(
            user=current_user,
            visibility=content.visibility,
            owner_id=content.owner_id,
            restricted_users=restricted_users_set,
            restricted_tags=restricted_tags_set,
        ):
            visible_contents.append(content)

    total = len(visible_contents)

    # 分页
    offset = (page - 1) * page_size
    items = visible_contents[offset : offset + page_size]

    return items, total
