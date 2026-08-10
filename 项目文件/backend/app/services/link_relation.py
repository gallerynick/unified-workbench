"""通用关联关系业务逻辑"""

from __future__ import annotations

import uuid

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.link_relation import LinkRelation


async def create_relation(
    db: AsyncSession,
    source_type: str,
    source_id: uuid.UUID,
    target_type: str,
    target_id: uuid.UUID,
) -> list[LinkRelation]:
    """创建双向关联：同时插入 (source→target) 与 (target→source)，已存在则跳过。"""
    pairs = [
        (source_type, source_id, target_type, target_id),
        (target_type, target_id, source_type, source_id),
    ]
    created: list[LinkRelation] = []
    for st, sid, tt, tid in pairs:
        result = await db.execute(
            select(LinkRelation).where(
                LinkRelation.source_type == st,
                LinkRelation.source_id == sid,
                LinkRelation.target_type == tt,
                LinkRelation.target_id == tid,
            )
        )
        if result.scalar_one_or_none():
            continue
        relation = LinkRelation(
            source_type=st, source_id=sid, target_type=tt, target_id=tid
        )
        db.add(relation)
        created.append(relation)
    if created:
        await db.flush()
        for relation in created:
            await db.refresh(relation)
    return created


async def delete_relation(
    db: AsyncSession,
    source_type: str,
    source_id: uuid.UUID,
    target_type: str,
    target_id: uuid.UUID,
) -> bool:
    """删除双向关联：同时删除 (source→target) 与 (target→source)。返回是否删除成功。"""
    pairs = [
        (source_type, source_id, target_type, target_id),
        (target_type, target_id, source_type, source_id),
    ]
    deleted = False
    for st, sid, tt, tid in pairs:
        result = await db.execute(
            select(LinkRelation).where(
                LinkRelation.source_type == st,
                LinkRelation.source_id == sid,
                LinkRelation.target_type == tt,
                LinkRelation.target_id == tid,
            )
        )
        relation = result.scalar_one_or_none()
        if relation:
            await db.delete(relation)
            deleted = True
    if deleted:
        await db.flush()
    return deleted


async def list_relations(
    db: AsyncSession,
    source_type: str,
    source_id: uuid.UUID,
) -> tuple[list[LinkRelation], int]:
    """列出以某实体为源的关联关系。"""
    query = select(LinkRelation).where(
        LinkRelation.source_type == source_type,
        LinkRelation.source_id == source_id,
    )
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(LinkRelation.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_linked_entities(
    db: AsyncSession,
    source_type: str,
    source_id: uuid.UUID,
) -> list[dict]:
    """获取与某实体关联的全部实体（双向，自动去重）。"""
    result = await db.execute(
        select(LinkRelation).where(
            or_(
                and_(
                    LinkRelation.source_type == source_type,
                    LinkRelation.source_id == source_id,
                ),
                and_(
                    LinkRelation.target_type == source_type,
                    LinkRelation.target_id == source_id,
                ),
            )
        )
    )
    relations = list(result.scalars().all())

    entities: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for relation in relations:
        if relation.source_type == source_type and relation.source_id == source_id:
            other = (relation.target_type, str(relation.target_id))
        else:
            other = (relation.source_type, str(relation.source_id))
        if other in seen:
            continue
        seen.add(other)
        entities.append({"type": other[0], "id": other[1]})
    return entities
