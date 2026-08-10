"""项目提案业务逻辑"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project_proposal import ProjectProposal
from app.models.user import User
from app.services.project_common import (
    get_project_or_404,
    require_project_member,
    require_project_section_permission,
)


async def list_project_proposals(
    db: AsyncSession,
    project_id: uuid.UUID,
    current_user: User,
    page: int = 1,
    page_size: int = 20,
    type: str | None = None,
    priority: str | None = None,
    status: str | None = None,
) -> tuple[list[ProjectProposal], int]:
    """列出项目提案，按 type/priority/status 筛选，仅项目成员可见。"""
    await require_project_member(db, project_id, current_user)
    query = select(ProjectProposal).where(ProjectProposal.project_id == project_id)

    if type:
        query = query.where(ProjectProposal.type == type)
    if priority:
        query = query.where(ProjectProposal.priority == priority)
    if status:
        query = query.where(ProjectProposal.status == status)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(ProjectProposal.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_project_proposal(
    db: AsyncSession,
    proposal_id: uuid.UUID,
    current_user: User,
) -> ProjectProposal:
    """获取单个项目提案，不存在或无权访问则 404/403。"""
    result = await db.execute(
        select(ProjectProposal).where(ProjectProposal.id == proposal_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="项目提案不存在"
        )
    await require_project_member(db, item.project_id, current_user)
    return item


async def create_project_proposal(
    db: AsyncSession,
    project_id: uuid.UUID,
    current_user: User,
    data: dict,
) -> ProjectProposal:
    """创建项目提案，仅项目成员可创建，创建者由后端填充，proposals 分区只读时禁止。"""
    project = await require_project_member(db, project_id, current_user)
    require_project_section_permission(project, current_user, "proposals")
    item = ProjectProposal(
        project_id=project_id,
        number=data["number"],
        title=data["title"],
        type=data.get("type", "feature"),
        priority=data.get("priority", "P2"),
        description=data.get("description"),
        status=data.get("status", "pending"),
        reject_reason=data.get("reject_reason"),
        attachment_links=data.get("attachment_links", []),
        assignee_id=data.get("assignee_id"),
        creator_id=current_user.id,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def update_project_proposal(
    db: AsyncSession,
    proposal_id: uuid.UUID,
    current_user: User,
    data: dict,
) -> ProjectProposal:
    """更新项目提案，仅项目成员可更新，proposals 分区只读时禁止。"""
    item = await get_project_proposal(db, proposal_id, current_user)
    project = await get_project_or_404(db, item.project_id)
    require_project_section_permission(project, current_user, "proposals")
    for field in (
        "number",
        "title",
        "type",
        "priority",
        "description",
        "status",
        "reject_reason",
        "attachment_links",
        "assignee_id",
    ):
        if field in data and data[field] is not None:
            setattr(item, field, data[field])
    await db.flush()
    await db.refresh(item)
    return item


async def delete_project_proposal(
    db: AsyncSession,
    proposal_id: uuid.UUID,
    current_user: User,
) -> None:
    """删除项目提案，仅项目成员可删除，proposals 分区只读时禁止。"""
    item = await get_project_proposal(db, proposal_id, current_user)
    project = await get_project_or_404(db, item.project_id)
    require_project_section_permission(project, current_user, "proposals")
    await db.delete(item)
    await db.flush()
