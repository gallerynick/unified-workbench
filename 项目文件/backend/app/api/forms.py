"""表单 API 路由"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_user_optional
from app.models.user import User, UserRole
from app.schemas.common import UnifiedResponse
from app.schemas.form import FormCreate, FormListResponse, FormSubmit
from app.schemas.form import FormResponse as FormResponseSchema
from app.services.form import (
    create_form,
    delete_form,
    get_form,
    list_form_responses,
    list_forms,
    submit_form_response,
)

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[FormListResponse])
async def list_forms_endpoint(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    forms, total = await list_forms(db, current_user.id, page, page_size)
    return UnifiedResponse(data=FormListResponse(items=[FormResponseSchema.model_validate(f) for f in forms], total=total))


@router.post("/", response_model=UnifiedResponse[FormResponseSchema])
async def create_form_endpoint(request: FormCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    form = await create_form(db, current_user.id, request)
    return UnifiedResponse(data=FormResponseSchema.model_validate(form))


@router.get("/{form_id}", response_model=UnifiedResponse[FormResponseSchema])
async def get_form_endpoint(form_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    form = await get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="表单不存在")
    if form.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="无权查看此表单")
    return UnifiedResponse(data=FormResponseSchema.model_validate(form))


@router.get("/{form_id}/public", response_model=UnifiedResponse[dict])
async def get_form_public(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    form = await get_form(db, uuid.UUID(form_id))
    if not form:
        raise HTTPException(status_code=404, detail="表单不存在")
    if not form.is_active or form.visibility != "public":
        raise HTTPException(status_code=404, detail="表单不存在")
    if current_user and form.visibility == "restricted" and form.restricted_users:
        if str(current_user.id) not in (form.restricted_users or []):
            raise HTTPException(status_code=404, detail="表单不存在")
    return {
        "code": 0,
        "msg": "",
        "data": {
            "id": str(form.id),
            "title": form.title,
            "description": form.description,
            "fields": form.fields,
            "allow_anonymous": form.allow_anonymous,
        },
    }


@router.delete("/{form_id}", response_model=UnifiedResponse[None])
async def delete_form_endpoint(form_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not await delete_form(db, form_id, current_user.id):
        raise HTTPException(status_code=404, detail="表单不存在")
    return UnifiedResponse(msg="表单已删除")


@router.post("/{form_id}/submit", response_model=UnifiedResponse[None])
async def submit_form_endpoint(form_id: uuid.UUID, request: FormSubmit, current_user: User | None = Depends(get_current_user_optional), db: AsyncSession = Depends(get_db)):
    form = await get_form(db, form_id)
    if not form or not form.is_active:
        raise HTTPException(status_code=400, detail="表单不存在或已关闭")
    if current_user is None and not form.allow_anonymous:
        raise HTTPException(status_code=403, detail="该表单不允许匿名提交")
    await submit_form_response(db, form_id, current_user.id if current_user else None, request)
    try:
        from app.core.websocket import manager

        await manager.send_to_user(
            form.owner_id,
            {
                "type": "notification",
                "title": "新表单提交",
                "content": f"您的表单「{form.title}」收到一条新的提交",
            },
        )
    except Exception:
        pass  # 通知失败不应阻塞提交
    return UnifiedResponse(msg="提交成功")


@router.get("/{form_id}/responses")
async def list_form_responses_endpoint(form_id: uuid.UUID, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    form = await get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="表单不存在")
    if form.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="无权查看此表单的回复")
    responses, total = await list_form_responses(db, form_id, page, page_size)
    return UnifiedResponse(data={"items": [{"id": str(r.id), "data": r.data, "created_at": r.created_at.isoformat()} for r in responses], "total": total})
