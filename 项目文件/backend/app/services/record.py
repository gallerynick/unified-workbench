"""记录业务逻辑"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.permissions import check_visibility
from app.models.record import Record, RecordStatus
from app.models.template import Template
from app.models.user import User
from app.services.notification.event_trigger import trigger_event_reminders

# 合法状态流转路径
VALID_TRANSITIONS: dict[str, list[str]] = {
    RecordStatus.DRAFT: [RecordStatus.ONGOING],
    RecordStatus.ONGOING: [RecordStatus.DONE],
    RecordStatus.DONE: [RecordStatus.ARCHIVED],
    RecordStatus.ARCHIVED: [],
}


async def create_record(
    db: AsyncSession,
    data: dict[str, Any],
    owner_id: uuid.UUID,
) -> Record:
    """创建记录，从模板拷贝 schema 到 template_snapshot。"""
    template_id = data["template_id"]
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="模板不存在"
        )

    record = Record(
        template_id=template_id,
        template_snapshot=template.schema,
        data=data.get("data", {}),
        type=data.get("type", "record"),
        title=data["title"],
        status=RecordStatus.DRAFT,
        owner_id=owner_id,
        visibility=data.get("visibility", "private"),
        restricted_users=data.get("restricted_users"),
        restricted_tags=data.get("restricted_tags"),
    )
    db.add(record)
    await db.flush()
    return record


async def list_records(
    db: AsyncSession,
    current_user: User,
    page: int = 1,
    page_size: int = 20,
    type: str | None = None,
    status: str | None = None,
    search: str | None = None,
) -> tuple[list[Record], int]:
    """列出记录，支持按 type/status 筛选，搜索 title，并过滤可见性。"""
    query = select(Record).options(selectinload(Record.owner))

    if type is not None:
        query = query.where(Record.type == type)
    if status is not None:
        query = query.where(Record.status == status)
    if search:
        query = query.where(Record.title.ilike(f"%{search}%"))

    query = query.order_by(Record.created_at.desc())
    result = await db.execute(query)
    all_records = list(result.scalars().all())

    # 按可见性过滤
    visible_records: list[Record] = []
    for record in all_records:
        if record.owner_id == current_user.id:
            visible_records.append(record)
        elif record.visibility == "public":
            visible_records.append(record)
        elif record.visibility == "restricted":
            r_users = set(record.restricted_users) if record.restricted_users else set()
            r_tags = set(record.restricted_tags) if record.restricted_tags else set()
            if check_visibility(current_user, record.visibility, record.owner_id, r_users, r_tags):
                visible_records.append(record)

    total = len(visible_records)
    start = (page - 1) * page_size
    return visible_records[start : start + page_size], total


async def get_record(db: AsyncSession, record_id: uuid.UUID, current_user: User) -> Record:
    """获取单条记录，不存在或无权访问则 404。"""
    result = await db.execute(select(Record).where(Record.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在"
        )
    # 可见性检查
    if record.visibility == "private" and record.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在"
        )
    if record.visibility == "restricted":
        r_users = set(record.restricted_users) if record.restricted_users else set()
        r_tags = set(record.restricted_tags) if record.restricted_tags else set()
        if not check_visibility(current_user, record.visibility, record.owner_id, r_users, r_tags):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在"
            )
    return record


async def update_record(
    db: AsyncSession,
    record_id: uuid.UUID,
    data: dict[str, Any],
    current_user: User,
) -> Record:
    """更新记录字段，仅所有者可修改。"""
    record = await get_record(db, record_id, current_user)
    if record.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="仅所有者可修改"
        )
    if "title" in data and data["title"] is not None:
        record.title = data["title"]
    if "data" in data and data["data"] is not None:
        record.data = data["data"]
    if "visibility" in data and data["visibility"] is not None:
        record.visibility = data["visibility"]
    if "restricted_users" in data:
        record.restricted_users = data["restricted_users"]
    if "restricted_tags" in data:
        record.restricted_tags = data["restricted_tags"]
    await db.flush()
    await db.refresh(record)
    return record


async def delete_record(db: AsyncSession, record_id: uuid.UUID, current_user: User) -> None:
    """删除记录，仅所有者可删除。"""
    record = await get_record(db, record_id, current_user)
    if record.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="仅所有者可删除"
        )
    await db.delete(record)
    await db.flush()


async def update_record_status(
    db: AsyncSession,
    record_id: uuid.UUID,
    new_status: RecordStatus,
    current_user: User,
) -> Record:
    """更新记录状态，验证状态流转合法性，仅所有者可变更。"""
    record = await get_record(db, record_id, current_user)
    if record.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="仅所有者可变更状态"
        )
    current_status = record.status
    allowed = VALID_TRANSITIONS.get(current_status, [])
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"状态流转不合法：{current_status} → {new_status}",
        )
    record.status = new_status
    await db.flush()
    await db.refresh(record)

    await trigger_event_reminders(db, "record_status_change", {
        "record_id": str(record.id),
        "record_title": record.title,
        "old_status": current_status,
        "new_status": new_status,
    })

    return record
