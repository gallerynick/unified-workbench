"""审计日志 API 路由"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, UserRole
from app.schemas.audit import AuditLogListResponse, AuditLogResponse
from app.schemas.common import UnifiedResponse
from app.services.audit import list_audit_logs

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[AuditLogListResponse])
async def list_audit_logs_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: str | None = Query(None),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """查询审计日志。管理员看全部，普通成员仅看自己相关。"""
    is_admin = current_user.role == UserRole.ADMIN
    logs, total = await list_audit_logs(
        db=db,
        user_id=current_user.id,
        is_admin=is_admin,
        action=action,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size,
    )
    return UnifiedResponse(
        data=AuditLogListResponse(
            items=[AuditLogResponse.model_validate(log) for log in logs],
            total=total,
        )
    )
