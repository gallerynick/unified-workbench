"""表单服务"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.form import Form, FormResponse as FormResponseModel
from app.schemas.form import FormCreate, FormSubmit
from app.services.visibility import check_visibility as visibility_filter


async def list_forms(db: AsyncSession, owner_id: uuid.UUID, page: int = 1, page_size: int = 20) -> tuple[list[Form], int]:
    response_count_subquery = (
        select(func.count(FormResponseModel.id))
        .where(FormResponseModel.form_id == Form.id)
        .correlate(Form)
        .scalar_subquery()
        .label("response_count")
    )
    query = select(Form, response_count_subquery).where(visibility_filter(Form, owner_id))
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Form.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    forms: list[Form] = []
    for form, count in result.all():
        form.response_count = count  # type: ignore[attr-defined]
        forms.append(form)
    return forms, total


async def get_form(db: AsyncSession, form_id: uuid.UUID) -> Form | None:
    result = await db.execute(select(Form).where(Form.id == form_id))
    return result.scalar_one_or_none()


async def create_form(db: AsyncSession, owner_id: uuid.UUID, request: FormCreate) -> Form:
    form = Form(
        title=request.title,
        description=request.description,
        fields=[f.model_dump() for f in request.fields],
        owner_id=owner_id,
        visibility=request.visibility,
        allow_anonymous=request.allow_anonymous,
        restricted_users=request.restricted_users,
        restricted_tags=request.restricted_tags,
    )
    db.add(form)
    await db.flush()
    await db.refresh(form)
    return form


async def delete_form(db: AsyncSession, form_id: uuid.UUID, owner_id: uuid.UUID) -> bool:
    form = await db.execute(select(Form).where(Form.id == form_id, Form.owner_id == owner_id))
    f = form.scalar_one_or_none()
    if not f:
        return False
    await db.delete(f)
    await db.flush()
    return True


async def submit_form_response(db: AsyncSession, form_id: uuid.UUID, user_id: uuid.UUID | None, request: FormSubmit) -> FormResponseModel:
    # 一人一次提交检查
    if user_id is not None:
        existing = await db.execute(
            select(FormResponseModel).where(
                FormResponseModel.form_id == form_id,
                FormResponseModel.respondent_id == user_id,
            )
        )
        if existing.scalar_one_or_none():
            from fastapi import HTTPException

            raise HTTPException(status_code=400, detail="您已经提交过该表单，每人仅限提交一次")

    response = FormResponseModel(form_id=form_id, respondent_id=user_id, data=request.data)
    db.add(response)
    await db.flush()
    await db.refresh(response)
    return response


async def list_form_responses(db: AsyncSession, form_id: uuid.UUID, page: int = 1, page_size: int = 20) -> tuple[list[FormResponseModel], int]:
    query = select(FormResponseModel).where(FormResponseModel.form_id == form_id)
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(FormResponseModel.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total
