"""表单 API 路由"""

from __future__ import annotations

import uuid
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_user_optional
from app.models.form import Form
from app.models.user import User, UserRole
from app.schemas.common import UnifiedResponse
from app.schemas.form import (
    FormCreate,
    FormListResponse,
    FormMyResponse,
    FormStatsResponse,
    FormSubmit,
    FormUpdate,
)
from app.schemas.form import (
    FormResponse as FormResponseSchema,
)
from app.services.form import (
    can_access_form,
    create_form,
    delete_form,
    get_form,
    get_form_stats,
    get_my_response,
    list_form_responses,
    list_forms,
    submit_form_response,
    update_form,
    validate_fields,
)
from app.services.form_export import export_form

router = APIRouter()


def _client_ip(req: Request) -> str | None:
    """取客户端 IP。

    经 nginx 反代时取 X-Real-IP（由 $remote_addr 写入，客户端无法伪造）；
    直连 uvicorn 时退回 request.client.host。
    """
    real = req.headers.get("x-real-ip")
    if real:
        return real.strip()
    return req.client.host if req.client else None


def _assert_owner_or_admin(form: Form, current_user: User, detail: str) -> None:
    """表单管理类操作的统一鉴权：仅创建者与管理员。"""
    if form.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail=detail)


@router.get("/", response_model=UnifiedResponse[FormListResponse])
async def list_forms_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UnifiedResponse[FormListResponse]:
    forms, total = await list_forms(db, current_user.id, page, page_size)
    return UnifiedResponse(
        data=FormListResponse(
            items=[FormResponseSchema.model_validate(f) for f in forms], total=total
        )
    )


@router.post("/", response_model=UnifiedResponse[FormResponseSchema])
async def create_form_endpoint(
    request: FormCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UnifiedResponse[FormResponseSchema]:
    """创建表单。字段结构创建后不可修改，故创建时严格校验字段定义。"""
    try:
        validate_fields(request.fields)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    form = await create_form(db, current_user.id, request)
    return UnifiedResponse(data=FormResponseSchema.model_validate(form))


@router.get("/{form_id}", response_model=UnifiedResponse[FormResponseSchema])
async def get_form_endpoint(
    form_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UnifiedResponse[FormResponseSchema]:
    form = await get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="表单不存在")
    _assert_owner_or_admin(form, current_user, "无权查看此表单")
    return UnifiedResponse(data=FormResponseSchema.model_validate(form))


@router.patch("/{form_id}", response_model=UnifiedResponse[FormResponseSchema])
async def update_form_endpoint(
    form_id: uuid.UUID,
    request: FormUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UnifiedResponse[FormResponseSchema]:
    """更新表单元信息（标题/描述/可见性/开关等）。字段结构不可修改。"""
    form = await get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="表单不存在")
    _assert_owner_or_admin(form, current_user, "无权编辑此表单")
    try:
        updated = await update_form(db, form, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return UnifiedResponse(data=FormResponseSchema.model_validate(updated))


@router.get("/{form_id}/public", response_model=UnifiedResponse[dict[str, object]])
async def get_form_public(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> UnifiedResponse[dict[str, object]]:
    """供填写页获取表单定义。

    可见性判定与提交共用 can_access_form：公开表单任何人可填；
    受限表单仅创建者、被授权用户、拥有被授权标签的用户可填；私有仅创建者。
    不可访问与不存在统一返回 404，避免暴露资源存在性。
    """
    try:
        parsed_id = uuid.UUID(form_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="表单不存在")
    form = await get_form(db, parsed_id)
    if form is None or not form.is_active:
        raise HTTPException(status_code=404, detail="表单不存在")
    # 先判可见性：未授权一律 404，不向未登录访问者泄露受限/私有表单的存在性
    if not can_access_form(current_user, form):
        raise HTTPException(status_code=404, detail="表单不存在")
    # 再判登录：对可见但未开启「允许未登录填写」的表单返回 401，由前端就地提示拦截
    if current_user is None and not form.allow_visitor:
        raise HTTPException(status_code=401, detail="需要登录后填写该表单")
    return UnifiedResponse(
        data={
            "id": str(form.id),
            "title": form.title,
            "description": form.description,
            "fields": form.fields,
            "allow_visitor": form.allow_visitor,
        }
    )


@router.delete("/{form_id}", response_model=UnifiedResponse[None])
async def delete_form_endpoint(
    form_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UnifiedResponse[None]:
    if not await delete_form(db, form_id, current_user.id):
        raise HTTPException(status_code=404, detail="表单不存在")
    return UnifiedResponse(msg="表单已删除")


@router.post("/{form_id}/submit", response_model=UnifiedResponse[None])
async def submit_form_endpoint(
    form_id: uuid.UUID,
    request: FormSubmit,
    req: Request,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> UnifiedResponse[None]:
    """提交表单回复。

    登录身份受可见性与「一人一次」约束；未登录访客提交（表单开启 allow_visitor）
    额外受 IP 维度频控，避免无身份可查导致被刷。
    """
    await submit_form_response(
        db,
        form_id,
        current_user.id if current_user else None,
        request,
        current_user,
        _client_ip(req),
    )
    try:
        from app.core.websocket import manager

        form = await get_form(db, form_id)
        if form is not None:
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


@router.get("/{form_id}/responses", response_model=UnifiedResponse[dict[str, object]])
async def list_form_responses_endpoint(
    form_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UnifiedResponse[dict[str, object]]:
    """回复明细（创建者与管理员）。未登录访客的提交者显示「访客」。"""
    form = await get_form(db, form_id)
    if form is None:
        raise HTTPException(status_code=404, detail="表单不存在")
    _assert_owner_or_admin(form, current_user, "无权查看此表单的回复")
    responses, names, total = await list_form_responses(db, form_id, page, page_size)
    items: list[dict[str, object]] = []
    for item in responses:
        respondent_id = str(item.respondent_id) if item.respondent_id else None
        # 未记录身份（未登录访客提交）显示「访客」；记录过但用户已删除显示「已删除用户」
        respondent_name = (
            "访客"
            if item.respondent_id is None
            else names.get(str(item.respondent_id), "已删除用户")
        )
        items.append(
            {
                "id": str(item.id),
                "data": item.data,
                "respondent_id": respondent_id,
                "respondent_name": respondent_name,
                "created_at": item.created_at.isoformat(),
            }
        )
    return UnifiedResponse(data={"items": items, "total": total})


@router.get("/{form_id}/stats", response_model=UnifiedResponse[FormStatsResponse])
async def get_form_stats_endpoint(
    form_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UnifiedResponse[FormStatsResponse]:
    """表单统计聚合结果。零回复时返回全 0 骨架，前端照常渲染图表。"""
    form = await get_form(db, form_id)
    if form is None:
        raise HTTPException(status_code=404, detail="表单不存在")
    _assert_owner_or_admin(form, current_user, "无权查看此表单的统计")
    return UnifiedResponse(data=await get_form_stats(db, form))


@router.get("/{form_id}/my-response", response_model=UnifiedResponse[FormMyResponse])
async def get_my_response_endpoint(
    form_id: uuid.UUID,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> UnifiedResponse[FormMyResponse]:
    """填写者查看自己已提交的内容。未登录或未提交均返回 404。"""
    if current_user is None:
        raise HTTPException(status_code=404, detail="未找到你的提交记录")
    form = await get_form(db, form_id)
    if form is None or not can_access_form(current_user, form):
        raise HTTPException(status_code=404, detail="表单不存在")
    response = await get_my_response(db, form_id, current_user.id)
    if response is None:
        raise HTTPException(status_code=404, detail="未找到你的提交记录")
    return UnifiedResponse(data=FormMyResponse.model_validate(response))


@router.get("/{form_id}/export", response_model=None)
async def export_form_endpoint(
    form_id: uuid.UUID,
    format: str = Query("xlsx", pattern="^(xlsx|csv)$", description="导出格式：xlsx / csv"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """导出表单结果为 Excel / CSV 文件（创建者与管理员可导出）。"""
    buf, filename, content_type = await export_form(db, form_id, current_user, format)
    # RFC 5987：中文文件名使用 filename* 编码，ASCII fallback 使用 filename
    ascii_name = filename.encode("ascii", "ignore").decode("ascii") or "form-export.xlsx"
    quoted_name = '"' + ascii_name + '"'
    disposition = f"attachment; filename={quoted_name}; filename*=UTF-8''{quote(filename)}"
    return Response(
        content=buf.getvalue(),
        media_type=content_type,
        headers={"Content-Disposition": disposition},
    )

