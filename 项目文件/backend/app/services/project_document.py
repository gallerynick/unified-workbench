"""项目文档业务逻辑"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project_document import ProjectDocument
from app.models.user import User


async def create_project_document(
    db: AsyncSession,
    data: dict,
    owner_id: uuid.UUID,
) -> ProjectDocument:
    """创建项目文档"""
    doc = ProjectDocument(
        project_id=data["project_id"],
        title=data["title"],
        content=data.get("content", {}),
        template_id=data.get("template_id"),
        owner_id=owner_id,
    )
    db.add(doc)
    await db.flush()
    return doc


async def list_project_documents(
    db: AsyncSession,
    current_user: User,
    page: int = 1,
    page_size: int = 20,
    project_id: uuid.UUID | None = None,
) -> tuple[list[ProjectDocument], int]:
    """列出项目文档，支持按项目和所有者过滤。非管理员仅能看到自己的文档。"""
    query = select(ProjectDocument)
    count_query = select(func.count()).select_from(ProjectDocument)

    # 非管理员只能查看自己的文档
    if current_user.role.value != "admin":
        query = query.where(ProjectDocument.owner_id == current_user.id)
        count_query = count_query.where(ProjectDocument.owner_id == current_user.id)

    if project_id:
        query = query.where(ProjectDocument.project_id == project_id)
        count_query = count_query.where(ProjectDocument.project_id == project_id)

    # 总数
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # 分页
    query = query.order_by(ProjectDocument.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    docs = list(result.scalars().all())

    return docs, total


async def get_project_document(
    db: AsyncSession, document_id: uuid.UUID, current_user: User
) -> ProjectDocument:
    """获取单个项目文档，非管理员只能访问自己的文档。"""
    result = await db.execute(
        select(ProjectDocument).where(ProjectDocument.id == document_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="项目文档不存在"
        )
    if current_user.role.value != "admin" and doc.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权访问此项目文档"
        )
    return doc


async def update_project_document(
    db: AsyncSession,
    document_id: uuid.UUID,
    data: dict,
    current_user: User,
) -> ProjectDocument:
    """更新项目文档，仅所有者可修改。"""
    doc = await get_project_document(db, document_id, current_user)
    if doc.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="仅所有者可修改"
        )

    if "title" in data and data["title"] is not None:
        doc.title = data["title"]
    if "content" in data and data["content"] is not None:
        doc.content = data["content"]

    await db.flush()
    await db.refresh(doc)
    return doc


async def delete_project_document(
    db: AsyncSession, document_id: uuid.UUID, current_user: User
) -> None:
    """删除项目文档，仅所有者可删除。"""
    doc = await get_project_document(db, document_id, current_user)
    if doc.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="仅所有者可删除"
        )
    await db.delete(doc)
    await db.flush()
