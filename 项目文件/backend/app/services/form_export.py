"""表单导出服务 — 将单个表单的回复明细与统计汇总导出为 Excel / CSV

支持格式：
  - Excel（openpyxl）：两个工作表（回复明细 / 统计汇总）
  - CSV（标准库）：回复明细单表，带 UTF-8 BOM，Excel 直接打开中文不乱码

权限：仅表单创建者与管理员可导出（与统计查看权限一致）。
实现范式对齐 app/services/project_export.py（BytesIO + RFC 5987 文件名由 API 层处理）。
"""

from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.form import Form
from app.models.form import FormResponse as FormResponseModel
from app.models.user import User, UserRole
from app.schemas.form import FormStatsField, FormStatsResponse
from app.services.form import get_form, get_form_stats

# 字段类型中文映射
FIELD_TYPE_MAP = {
    "text": "文本",
    "textarea": "段落",
    "number": "数字",
    "select": "下拉",
    "radio": "单选",
    "checkbox": "多选",
}

XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
CSV_CONTENT_TYPE = "text/csv; charset=utf-8"


def _fmt(v: object, default: str = "-") -> str:
    """统一格式化：None / 空值 → default；datetime → 本地时间；list → 逗号拼接。"""
    if v is None:
        return default
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d %H:%M")
    if isinstance(v, bool):
        return "是" if v else "否"
    if isinstance(v, str) and not v.strip():
        return default
    if isinstance(v, list):
        return ", ".join(str(item) for item in v) if v else default
    return str(v)


def _field_label(field: dict[str, object]) -> str:
    """字段展示名：优先 label，回退 key。"""
    return str(field.get("label") or field.get("key") or "未命名字段")


def _assert_owner_or_admin(form: Form, current_user: User) -> None:
    """导出权限与统计查看一致：仅创建者与管理员。"""
    if form.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="无权导出此表单")


def _respondent_name(
    response: FormResponseModel, names: dict[str, str]
) -> str:
    """提交者展示名：未登录填写显示「访客」，身份已删除显示「已删除用户」。"""
    if response.respondent_id is None:
        return "访客"
    return names.get(str(response.respondent_id), "已删除用户")


def _stat_detail(stat: FormStatsField) -> str:
    """统计明细列的可读文本。"""
    if stat.option_counts:
        return "、".join(f"{i['option']}: {i['count']}" for i in stat.option_counts)
    if stat.number_stats:
        s = stat.number_stats
        return (
            f"均值 {s['mean']} / 中位 {s['median']} / "
            f"最小 {s['min']} / 最大 {s['max']}"
        )
    return "文本类字段仅统计填写率"


async def _load_responses(
    db: AsyncSession, form: Form
) -> tuple[list[FormResponseModel], dict[str, str]]:
    """按提交时间倒序加载全部回复，并附带 respondent_id → 名称 映射。"""
    result = await db.execute(
        select(FormResponseModel)
        .where(FormResponseModel.form_id == form.id)
        .order_by(FormResponseModel.created_at.desc())
    )
    responses = list(result.scalars().all())
    ids = [item.respondent_id for item in responses if item.respondent_id is not None]
    names: dict[str, str] = {}
    if ids:
        users = list(
            (await db.execute(select(User).where(User.id.in_(ids)))).scalars().all()
        )
        names = {str(u.id): (u.nickname or u.username) for u in users}
    return responses, names


def _build_xlsx(
    form: Form,
    responses: list[FormResponseModel],
    names: dict[str, str],
    stats: FormStatsResponse,
) -> io.BytesIO:
    """构建 Excel 工作簿（openpyxl），返回 BytesIO。"""
    from openpyxl import Workbook  # type: ignore[import-untyped]
    from openpyxl.styles import Alignment, Font  # type: ignore[import-untyped]
    from openpyxl.utils import get_column_letter  # type: ignore[import-untyped]

    wb = Workbook()

    def _write_sheet(
        ws: Workbook, title: str, headers: list[str], rows: list[list[object]]
    ) -> None:
        """写入一个工作表：标题行 + 数据行 + 列宽自适应 + 冻结前两行。"""
        ws.append([title])
        ws["A1"].font = Font(bold=True, size=14)
        ws.append(headers)
        for h in range(1, len(headers) + 1):
            cell = ws.cell(row=2, column=h)
            cell.font = Font(bold=True)
            cell.alignment = Alignment(horizontal="center")
        for row in rows:
            ws.append(row)
        for col_idx in range(1, len(headers) + 1):
            letter = get_column_letter(col_idx)
            max_len = len(headers[col_idx - 1])
            for row_idx in range(2, ws.max_row + 1):
                val = ws.cell(row=row_idx, column=col_idx).value
                if val is not None:
                    max_len = max(max_len, len(str(val)))
            ws.column_dimensions[letter].width = min(max(max_len + 4, 10), 50)
        ws.freeze_panes = "A3"

    fields: list[dict[str, object]] = form.fields or []
    title = _fmt(form.title)

    # Sheet 1: 回复明细
    ws1 = wb.active
    ws1.title = "回复明细"
    detail_headers = ["序号", "提交时间", "提交者"] + [_field_label(f) for f in fields]
    detail_rows: list[list[object]] = []
    if not responses:
        empty_row: list[object] = []
        empty_row.append("暂无回复")
        empty_row.extend([""] * (len(detail_headers) - 1))
        detail_rows.append(empty_row)
    for idx, response in enumerate(responses, start=1):
        row: list[object] = [
            idx,
            _fmt(response.created_at),
            _respondent_name(response, names),
        ]
        for field in fields:
            row.append(_fmt(response.data.get(field.get("key"))))
        detail_rows.append(row)
    detail_title = f"表单：{title}（共 {stats.total_responses} 条回复）"
    _write_sheet(ws1, detail_title, detail_headers, detail_rows)

    # Sheet 2: 统计汇总
    ws2 = wb.create_sheet("统计汇总")
    summary_headers = ["字段", "类型", "是否必填", "已填写数", "填写率", "统计明细"]
    summary_rows: list[list[object]] = []
    for stat in stats.field_stats:
        summary_rows.append(
            [
                stat.label,
                FIELD_TYPE_MAP.get(stat.type, _fmt(stat.type)),
                "是" if stat.required else "否",
                stat.answered_count,
                f"{stat.answer_rate * 100:.1f}%",
                _stat_detail(stat),
            ]
        )
    summary_title = f"表单：{title}（统计汇总）"
    _write_sheet(ws2, summary_title, summary_headers, summary_rows)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def _build_csv(
    form: Form,
    responses: list[FormResponseModel],
    names: dict[str, str],
) -> io.BytesIO:
    """构建回复明细 CSV（UTF-8 BOM，便于 Excel 直接打开）。"""
    out = io.StringIO(newline="")
    writer = csv.writer(out)
    fields: list[dict[str, object]] = form.fields or []
    headers = ["序号", "提交时间", "提交者"] + [_field_label(f) for f in fields]
    writer.writerow(headers)
    if not responses:
        writer.writerow(["暂无回复"] + [""] * (len(headers) - 1))
    for idx, response in enumerate(responses, start=1):
        row: list[object] = [
            idx,
            _fmt(response.created_at),
            _respondent_name(response, names),
        ]
        for field in fields:
            row.append(_fmt(response.data.get(field.get("key"))))
        writer.writerow(row)
    return io.BytesIO(out.getvalue().encode("utf-8"))


async def export_form(
    db: AsyncSession,
    form_id: uuid.UUID,
    current_user: User,
    fmt: str = "xlsx",
) -> tuple[io.BytesIO, str, str]:
    """导出表单结果。

    参数：
        fmt: 'xlsx' 或 'csv'
    返回：
        (bytes 流, 文件名, content_type)
    """
    form = await get_form(db, form_id)
    if form is None:
        raise HTTPException(status_code=404, detail="表单不存在")
    _assert_owner_or_admin(form, current_user)

    responses, names = await _load_responses(db, form)
    base = f"{_fmt(form.title)}_{str(form.id)[:8]}"

    if fmt == "csv":
        return _build_csv(form, responses, names), f"{base}.csv", CSV_CONTENT_TYPE

    stats = await get_form_stats(db, form)
    buf = _build_xlsx(form, responses, names, stats)
    return buf, f"{base}.xlsx", XLSX_CONTENT_TYPE

