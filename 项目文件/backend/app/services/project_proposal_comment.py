"""项目提案评论业务逻辑"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project_proposal_comment import ProjectProposalComment
from app.models.user import User
from app.services.project_common import (
    get_project_or_404,
    require_project_member,
    require_project_section_permission,
)
from app.services.project_proposal import get_project_proposal


async def list_project_proposal_comments(
    db: AsyncSession,
    proposal_id: uuid.UUID,
    current_user: User,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[ProjectProposalComment], int]:
    """列出某条提案的评论，仅项目成员可见，按 created_at 降序排列。"""
    proposal = await get_project_proposal(db, proposal_id, current_user)
    await require_project_member(db, proposal.project_id, current_user)

    base_query = (
        select(ProjectProposalComment)
        .where(ProjectProposalComment.proposal_id == proposal_id)
    )
    count_query = select(func.count()).select_from(base_query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = (
        base_query
        .order_by(ProjectProposalComment.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def create_project_proposal_comment(
    db: AsyncSession,
    proposal_id: uuid.UUID,
    current_user: User,
    data: dict,
) -> ProjectProposalComment:
    """创建项目提案评论，仅项目成员且 proposals 分区非只读时可创建。"""
    proposal = await get_project_proposal(db, proposal_id, current_user)
    project = await get_project_or_404(db, proposal.project_id)
    require_project_section_permission(project, current_user, "proposals")
    item = ProjectProposalComment(
        proposal_id=proposal_id,
        creator_id=current_user.id,
        content=data["content"],
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def delete_project_proposal_comment(
    db: AsyncSession,
    comment_id: uuid.UUID,
    current_user: User,
) -> None:
    """删除项目提案评论，仅评论创建者、全局管理员或项目 owner 且 proposals 分区非只读时可删除。"""
    result = await db.execute(
        select(ProjectProposalComment).where(ProjectProposalComment.id == comment_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="评论不存在"
        )
    project = await get_project_or_404(db, item.proposal.project_id)
    # 可见性 + 项目成员校验
    await require_project_member(db, project.id, current_user)
    # 分区权限校验（proposals 分区只读时禁止）
    require_project_section_permission(project, current_user, "proposals")
    # 只有评论创建者、全局管理员或项目 owner 可删除
    is_creator = item.creator_id == current_user.id
    is_project_owner = project.owner_id == current_user.id
    is_global_admin = current_user.role.value == "admin"
    if not (is_creator or is_project_owner or is_global_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅有评论创建者、管理员或项目 owner 可删除该评论",
        )
    await db.delete(item)
    await db.flush()