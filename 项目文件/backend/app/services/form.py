"""表单服务"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.visibility import Visibility
from app.models.form import Form
from app.models.form import FormResponse as FormResponseModel
from app.models.tag import Tag
from app.models.user import User, UserRole
from app.schemas.form import (
    FormCreate,
    FormField,
    FormStatsField,
    FormStatsResponse,
    FormSubmit,
    FormUpdate,
)
from app.services.visibility import check_visibility as visibility_filter

# 支持选项计数的字段类型
OPTION_TYPES = ("select", "radio", "checkbox")

# 字段数量上限，防止单表单过大导致统计与导出退化
MAX_FIELD_COUNT = 50

# 访客提交频控：登录身份由「一人一次」约束；未登录访客没有身份可查，只能按 IP 兜底防刷
VISITOR_SUBMIT_LIMIT = 10
VISITOR_SUBMIT_WINDOW = 600  # 10 分钟

# model_dump(exclude_unset=True) 的缺省哨兵，用于区分「未传」与「显式置空」
_UNSET: object = object()


async def _check_visitor_submit_rate_limit(form_id: uuid.UUID, ip: str | None) -> None:
    """访客提交频控：同一 IP 对同一表单的提交超过上限则拒绝。

    Redis 不可用时跳过，不阻塞提交（与登录频控的降级策略保持一致）。
    """
    if not ip:
        return
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(get_settings().REDIS_URL)
        key = f"form_submit:{form_id}:{ip}"
        count = await r.incr(key)
        if count == 1:
            await r.expire(key, VISITOR_SUBMIT_WINDOW)
        if count > VISITOR_SUBMIT_LIMIT:
            ttl = await r.ttl(key)
            await r.close()
            raise HTTPException(
                status_code=429,
                detail=f"提交过于频繁，请 {ttl} 秒后重试",
            )
        await r.close()
    except HTTPException:
        raise
    except Exception:
        pass


def validate_fields(fields: list[FormField]) -> None:
    """校验字段定义：非空、数量上限、标签非空、选项类字段至少 2 个选项。"""
    if not fields:
        raise ValueError("表单至少需要一个字段")
    if len(fields) > MAX_FIELD_COUNT:
        raise ValueError(f"字段数量不能超过 {MAX_FIELD_COUNT} 个")
    for field in fields:
        if not field.label.strip():
            raise ValueError("存在未命名的字段，请填写字段标签")
        if field.type in OPTION_TYPES:
            options = field.options or []
            if len(options) < 2:
                raise ValueError(f"字段「{field.label}」至少需要 2 个选项")


async def list_forms(
    db: AsyncSession, owner_id: uuid.UUID, page: int = 1, page_size: int = 20
) -> tuple[list[Form], int]:
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
    query = (
        query.order_by(Form.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    forms: list[Form] = []
    for form, count in result.all():
        form.response_count = count  # type: ignore[attr-defined]
        forms.append(form)
    return forms, total


async def get_form(db: AsyncSession, form_id: uuid.UUID) -> Form | None:
    result = await db.execute(select(Form).where(Form.id == form_id))
    return result.scalar_one_or_none()


async def normalize_restricted_tags(
    db: AsyncSession, values: list[str] | None
) -> list[str] | None:
    """将受限标签归一化为标签**名称**列表。

    基定约定 restricted_tags 存储标签名称（app/core/permissions.py 按名称匹配），
    而前端 VisibilitySetting 组件以标签 id 作为选项值。此处把 UUID 形态的值解析为
    对应标签名称，非 UUID 值（已是名称，或历史脏数据）原样保留。
    """
    if values is None:
        return None
    names: list[str] = []
    id_values: list[str] = []
    for raw in values:
        try:
            uuid.UUID(raw)
        except ValueError:
            names.append(raw)
        else:
            id_values.append(raw)
    if id_values:
        rows = (
            await db.execute(
                select(Tag.id, Tag.name).where(
                    Tag.id.in_([uuid.UUID(v) for v in id_values])
                )
            )
        ).all()
        id_to_name = {str(tag_id): tag_name for tag_id, tag_name in rows}
        for raw in id_values:
            names.append(id_to_name.get(raw, raw))
    return names


def _normalize_access_flags(form: Form) -> None:
    """收敛访问相关标记，避免留下与可见性矛盾的无效残留。

    - 非受限可见性不携带授权载体（restricted_users / restricted_tags）
    - 「允许未登录填写」只在公开可见性下生效；受限 / 私有表单一律清零，
      保证该标记不会绕过可见性放开访问
    """
    if form.visibility != Visibility.RESTRICTED:
        form.restricted_users = None
        form.restricted_tags = None
    if form.visibility != Visibility.PUBLIC:
        form.allow_visitor = False


async def create_form(db: AsyncSession, owner_id: uuid.UUID, request: FormCreate) -> Form:
    form = Form(
        title=request.title,
        description=request.description,
        fields=[f.model_dump() for f in request.fields],
        owner_id=owner_id,
        visibility=request.visibility,
        allow_visitor=request.allow_visitor,
        restricted_users=request.restricted_users,
        restricted_tags=await normalize_restricted_tags(db, request.restricted_tags),
    )
    _normalize_access_flags(form)
    db.add(form)
    await db.flush()
    await db.refresh(form)
    return form


async def update_form(db: AsyncSession, form: Form, request: FormUpdate) -> Form:
    """更新表单元信息；字段结构不受此接口影响。"""
    data = request.model_dump(exclude_unset=True)
    if "fields" in data:
        raise ValueError("表单字段结构创建后不可修改")
    incoming_tags = data.pop("restricted_tags", _UNSET)
    for key, value in data.items():
        setattr(form, key, value)
    if incoming_tags is not _UNSET:
        form.restricted_tags = await normalize_restricted_tags(db, incoming_tags)
    _normalize_access_flags(form)
    await db.flush()
    await db.refresh(form)
    return form


async def delete_form(db: AsyncSession, form_id: uuid.UUID, owner_id: uuid.UUID) -> bool:
    # Admin 可删除任意表单
    role_result = await db.execute(select(User.role).where(User.id == owner_id))
    user_role = role_result.scalar_one_or_none()
    if user_role == UserRole.ADMIN:
        form = await db.execute(select(Form).where(Form.id == form_id))
    else:
        form = await db.execute(select(Form).where(Form.id == form_id, Form.owner_id == owner_id))
    f = form.scalar_one_or_none()
    if not f:
        return False
    # 先删回复：form_response.form_id 外键未配 ondelete=CASCADE，
    # 旧库约束无法靠 create_all 修改，直接删表会触发外键冲突
    await db.execute(delete(FormResponseModel).where(FormResponseModel.form_id == form_id))
    await db.delete(f)
    await db.flush()
    return True


def can_access_form(user: User | None, form: Form) -> bool:
    """判断用户是否可填写/访问该表单（public 与 submit 共用同一套口径）。

    - public：任何用户（含未登录）可访问
    - restricted：创建者、restricted_users 中的用户、拥有 restricted_tags 中任一标签的用户
    - private 及未知状态：仅创建者（兼容历史私有表单，不开放填写）

    注意：这里只判定「可见性」，不判定是否已登录。是否要求登录由调用方根据
    form.allow_visitor 决定——未登录访问未开启「允许未登录填写」的表单返回 401，
    由前端就地提示拦截；未登录访问受限表单仍返回 404，避免暴露资源存在性。
    """
    if form.visibility == Visibility.PUBLIC:
        return True
    if user is None:
        return False
    if user.id == form.owner_id:
        return True
    if form.visibility == Visibility.RESTRICTED:
        restricted_users = {str(item) for item in (form.restricted_users or [])}
        if str(user.id) in restricted_users:
            return True
        restricted_tags = set(form.restricted_tags or [])
        if restricted_tags and user.tags:
            owned_tags = {tag.name for tag in user.tags}
            if owned_tags & restricted_tags:
                return True
    return False


async def submit_form_response(
    db: AsyncSession,
    form_id: uuid.UUID,
    user_id: uuid.UUID | None,
    request: FormSubmit,
    current_user: User | None = None,
    ip: str | None = None,
) -> FormResponseModel:
    form = await get_form(db, form_id)
    if form is None or not form.is_active:
        raise HTTPException(status_code=400, detail="表单不存在或已关闭")
    # 先判可见性：未授权一律 404，不向未登录访问者泄露受限/私有表单的存在性
    if not can_access_form(current_user, form):
        raise HTTPException(status_code=404, detail="表单不存在")
    # 再判登录：对可见但未开启「允许未登录填写」的表单返回 401，由前端就地提示拦截
    if current_user is None and not form.allow_visitor:
        raise HTTPException(status_code=401, detail="需要登录后填写该表单")
    if current_user is None:
        await _check_visitor_submit_rate_limit(form_id, ip)
    # 一人一次提交检查
    if user_id is not None:
        existing = await db.execute(
            select(FormResponseModel).where(
                FormResponseModel.form_id == form_id,
                FormResponseModel.respondent_id == user_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=400, detail="您已经提交过该表单，每人仅限提交一次"
            )

    response = FormResponseModel(form_id=form_id, respondent_id=user_id, data=request.data)
    db.add(response)
    await db.flush()
    await db.refresh(response)
    return response


async def get_my_response(
    db: AsyncSession, form_id: uuid.UUID, user_id: uuid.UUID
) -> FormResponseModel | None:
    """返回当前用户对该表单的回复，用于填写页的「我的填写」只读回显。"""
    result = await db.execute(
        select(FormResponseModel).where(
            FormResponseModel.form_id == form_id,
            FormResponseModel.respondent_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def list_form_responses(
    db: AsyncSession, form_id: uuid.UUID, page: int = 1, page_size: int = 20
) -> tuple[list[FormResponseModel], dict[str, str], int]:
    """分页返回回复明细，附带 respondent_id → 昵称/用户名 映射。"""
    query = select(FormResponseModel).where(FormResponseModel.form_id == form_id)
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = (
        query.order_by(FormResponseModel.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    responses = list(result.scalars().all())
    ids = [r.respondent_id for r in responses if r.respondent_id is not None]
    names: dict[str, str] = {}
    if ids:
        users = list(
            (await db.execute(select(User).where(User.id.in_(ids)))).scalars().all()
        )
        names = {str(u.id): (u.nickname or u.username) for u in users}
    return responses, names, total


def _number_summary(nums: list[float]) -> dict[str, float]:
    """数值字段的描述统计。空数据返回全 0，保证零回复时前端可照常渲染。"""
    if not nums:
        return {
            "count": 0.0,
            "mean": 0.0,
            "median": 0.0,
            "min": 0.0,
            "max": 0.0,
            "stdev": 0.0,
        }
    ordered = sorted(nums)
    size = len(ordered)
    mean = sum(ordered) / size
    if size % 2 == 0:
        median = (ordered[size // 2 - 1] + ordered[size // 2]) / 2
    else:
        median = ordered[size // 2]
    stdev = (sum((x - mean) ** 2 for x in ordered) / size) ** 0.5 if size > 1 else 0.0
    return {
        "count": float(size),
        "mean": round(mean, 2),
        "median": round(median, 2),
        "min": ordered[0],
        "max": ordered[size - 1],
        "stdev": round(stdev, 2),
    }


def _number_bins(nums: list[float], bucket_count: int = 5) -> list[dict[str, str | int]]:
    """数值字段分箱分布，用于柱状图展示。"""
    if not nums:
        return []
    low = min(nums)
    high = max(nums)
    if low == high:
        return [{"label": str(round(low, 2)), "count": len(nums)}]
    step = (high - low) / bucket_count
    labels: list[str] = []
    counts: list[int] = []
    for i in range(bucket_count):
        start = low + i * step
        end = low + (i + 1) * step
        labels.append(f"{round(start, 2)} ~ {round(end, 2)}")
        counts.append(0)
    for value in nums:
        idx = min(int((value - low) / step), bucket_count - 1)
        counts[idx] += 1
    return [{"label": labels[i], "count": counts[i]} for i in range(bucket_count)]


async def get_form_stats(db: AsyncSession, form: Form) -> FormStatsResponse:
    """聚合表单统计结果。零回复时返回全 0 骨架，前端据此照常渲染图表。"""
    result = await db.execute(
        select(FormResponseModel)
        .where(FormResponseModel.form_id == form.id)
        .order_by(FormResponseModel.created_at.asc())
    )
    responses = list(result.scalars().all())
    total = len(responses)
    visitor_count = sum(1 for item in responses if item.respondent_id is None)

    field_stats: list[FormStatsField] = []
    for raw in form.fields or []:
        key = str(raw.get("key", ""))
        field_type = str(raw.get("type", "text"))
        label = str(raw.get("label") or key)
        required = bool(raw.get("required"))
        values: list[Any] = [item.data.get(key) for item in responses]
        answered = [v for v in values if v not in (None, "", [])]
        answered_count = len(answered)
        answer_rate = round(answered_count / total, 4) if total > 0 else 0.0

        stat = FormStatsField(
            key=key,
            type=field_type,
            label=label,
            required=required,
            answered_count=answered_count,
            answer_rate=answer_rate,
        )

        if field_type in OPTION_TYPES:
            declared = raw.get("options") or []
            counts: dict[str, int] = {str(option): 0 for option in declared}
            for value in answered:
                options = value if isinstance(value, list) else [value]
                for option in options:
                    name = str(option)
                    counts[name] = counts.get(name, 0) + 1
            stat.option_counts = [
                {"option": option, "count": count} for option, count in counts.items()
            ]
        elif field_type == "number":
            numbers: list[float] = []
            for value in answered:
                try:
                    numbers.append(float(value))
                except (TypeError, ValueError):
                    continue
            stat.number_stats = _number_summary(numbers)
            stat.bins = _number_bins(numbers)

        field_stats.append(stat)

    return FormStatsResponse(
        form_id=form.id,
        title=form.title,
        description=form.description,
        total_responses=total,
        visitor_count=visitor_count,
        first_response_at=responses[0].created_at if responses else None,
        last_response_at=responses[-1].created_at if responses else None,
        field_stats=field_stats,
    )

