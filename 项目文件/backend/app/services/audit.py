"""审计日志业务逻辑"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


async def log_audit(
    db: AsyncSession,
    user_id: uuid.UUID,
    action: str,
    target_type: str,
    target_id: str,
    detail: dict | None = None,
    ip: str | None = None,
) -> AuditLog:
    """记录审计日志"""
    audit = AuditLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        detail=detail,
        ip=ip,
    )
    db.add(audit)
    await db.flush()
    return audit


async def list_audit_logs(
    db: AsyncSession,
    user_id: uuid.UUID | None = None,
    is_admin: bool = False,
    action: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[AuditLog], int]:
    """查询审计日志。管理员看全部，普通成员仅看自己相关。"""
    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))

    if not is_admin:
        query = query.where(AuditLog.user_id == user_id)
        count_query = count_query.where(AuditLog.user_id == user_id)

    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)

    if start_date:
        from datetime import datetime
        start_dt = datetime.fromisoformat(start_date)
        query = query.where(AuditLog.created_at >= start_dt)
        count_query = count_query.where(AuditLog.created_at >= start_dt)

    if end_date:
        from datetime import datetime
        end_dt = datetime.fromisoformat(end_date)
        query = query.where(AuditLog.created_at <= end_dt)
        count_query = count_query.where(AuditLog.created_at <= end_dt)

    query = query.order_by(AuditLog.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    count_result = await db.execute(count_query)

    return list(result.scalars().all()), count_result.scalar() or 0
