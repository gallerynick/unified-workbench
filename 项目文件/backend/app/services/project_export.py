"""项目导出服务 — 将单个项目的完整信息导出为 Word / Excel

支持格式：
  - Word（python-docx）：分章节展示项目基本信息 + 人员 / 提案 / 待办 / 交流 / 修改 / 事件
  - Excel（openpyxl）：多工作表（项目信息 / 项目人员 / 项目提案 / 待办任务 /
    交流记录 / 修改记录 / 项目事件）

权限：导出者需为项目成员（复用 require_project_member 校验）。
"""

from __future__ import annotations

import io
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.project_change import ProjectChange
from app.models.project_event import ProjectEvent
from app.models.project_meeting import ProjectMeeting
from app.models.project_member import ProjectMember
from app.models.project_proposal import ProjectProposal
from app.models.project_todo import ProjectTodo
from app.models.user import User
from app.services.project_common import require_project_member

# ── 状态 / 类型中文映射 ────────────────────────────────────────────
PROJECT_STATUS_MAP = {
    "draft": "草稿",
    "ongoing": "进行中",
    "done": "已完成",
    "archived": "已归档",
}
VISIBILITY_MAP = {
    "public": "公开",
    "private": "私有",
    "restricted": "指定用户可见",
}
PROPOSAL_STATUS_MAP = {
    "pending": "待审核",
    "approved": "待实现",
    "in_progress": "实现中",
    "completed": "已完成",
    "rejected": "已废弃",
}
PROPOSAL_TYPE_MAP = {
    "feature": "功能需求",
    "bug": "Bug修复",
    "improvement": "优化改进",
    "removal": "功能移除",
    "other": "其他",
}
TODO_STATUS_MAP = {
    "pending": "待处理",
    "in_progress": "进行中",
    "completed": "已完成",
}
CHANGE_STATUS_MAP = {
    "pending": "待确认",
    "applied": "已实施",
    "rejected": "已拒绝",
}
EVENT_TYPE_MAP = {
    "handover": "项目移交",
    "archive": "归档",
    "close": "关闭",
    "reopen": "重启",
    "owner_change": "负责人变更",
    "other": "其他",
}


def _fmt(v, default: str = "-") -> str:
    """统一格式化：None / 空串 → default；datetime → 本地时间字符串。"""
    if v is None:
        return default
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d %H:%M")
    if isinstance(v, str) and not v.strip():
        return default
    return str(v)


def _user_name_map(users: list[User]) -> dict[str, str]:
    """构建 user_id → 昵称/用户名 映射。"""
    return {
        str(u.id): (u.nickname or u.username) for u in users
    }


async def _load_users(db: AsyncSession, ids: set[uuid.UUID]) -> dict[str, str]:
    """加载一批用户并返回 id → 名称 映射。"""
    if not ids:
        return {}
    result = await db.execute(select(User).where(User.id.in_(ids)))
    return _user_name_map(list(result.scalars().all()))


# ── 数据收集 ────────────────────────────────────────────────────────
async def _collect_export_data(
    db: AsyncSession, project: Project
) -> dict:
    """收集项目全部分区数据与用户映射，供各格式生成器使用。"""
    project_id = project.id

    members = list(
        (
            await db.execute(
                select(ProjectMember)
                .where(ProjectMember.project_id == project_id)
                .order_by(ProjectMember.is_owner.desc(), ProjectMember.joined_at)
            )
        )
        .scalars()
        .all()
    )
    proposals = list(
        (
            await db.execute(
                select(ProjectProposal)
                .where(ProjectProposal.project_id == project_id)
                .order_by(ProjectProposal.created_at)
            )
        )
        .scalars()
        .all()
    )
    todos = list(
        (
            await db.execute(
                select(ProjectTodo)
                .where(ProjectTodo.project_id == project_id)
                .order_by(ProjectTodo.created_at)
            )
        )
        .scalars()
        .all()
    )
    meetings = list(
        (
            await db.execute(
                select(ProjectMeeting)
                .where(ProjectMeeting.project_id == project_id)
                .order_by(ProjectMeeting.started_at)
            )
        )
        .scalars()
        .all()
    )
    changes = list(
        (
            await db.execute(
                select(ProjectChange)
                .where(ProjectChange.project_id == project_id)
                .order_by(ProjectChange.date)
            )
        )
        .scalars()
        .all()
    )
    events = list(
        (
            await db.execute(
                select(ProjectEvent)
                .where(ProjectEvent.project_id == project_id)
                .order_by(ProjectEvent.created_at)
            )
        )
        .scalars()
        .all()
    )

    # 收集需要展示名称的用户 id
    user_ids: set[uuid.UUID] = set()
    for m in members:
        user_ids.add(m.user_id)
    for pr in proposals:
        user_ids.add(pr.creator_id)
        if pr.assignee_id:
            user_ids.add(pr.assignee_id)
    for t in todos:
        user_ids.add(t.creator_id)
        if t.assignee_id:
            user_ids.add(t.assignee_id)
    for e in events:
        user_ids.add(e.operator_id)
    if project.owner_id:
        user_ids.add(project.owner_id)

    names = await _load_users(db, user_ids)

    return {
        "project": project,
        "names": names,
        "members": members,
        "proposals": proposals,
        "todos": todos,
        "meetings": meetings,
        "changes": changes,
        "events": events,
    }


def _project_basic_rows(data: dict) -> list[tuple[str, str]]:
    """项目基本信息键值对列表。"""
    p: Project = data["project"]
    rows = [
        ("项目名称", _fmt(p.title)),
        ("项目编号", _fmt(p.number)),
        ("项目状态", PROJECT_STATUS_MAP.get(p.status or "", _fmt(p.status))),
        ("项目负责人", data["names"].get(str(p.owner_id), _fmt(str(p.owner_id)))),
        ("可见性", VISIBILITY_MAP.get(p.visibility or "", _fmt(p.visibility))),
        ("所属团队/部门", _fmt(p.department)),
        ("项目语言", _fmt(p.language)),
        ("是否开源", "是" if p.is_open_source else "否"),
        ("仓库地址", _fmt(p.repo_url)),
        ("项目优先级", _fmt(p.priority)),
        ("项目类型", _fmt(p.project_type)),
        ("项目目标", _fmt(p.goals)),
        ("项目需求", _fmt(p.requirements)),
        ("附加需求", _fmt(p.additional_req)),
        ("模块划分", _fmt(p.modules)),
        ("关联项目", _fmt(p.related_projects)),
        ("开发流程", _fmt(p.dev_process)),
        ("创建时间", _fmt(p.created_at)),
        ("更新时间", _fmt(p.updated_at)),
    ]
    return rows


# ── Word 导出 ───────────────────────────────────────────────────────
def _build_docx(data: dict) -> io.BytesIO:
    """构建 Word 文档（python-docx），返回 BytesIO。"""
    from docx import Document
    from docx.shared import Pt

    doc = Document()
    # 默认中文字体
    style = doc.styles["Normal"]
    style.font.name = "微软雅黑"
    style.font.size = Pt(10.5)
    try:
        from docx.oxml.ns import qn

        style.element.rPr.rFonts.set(qn("w:eastAsia"), "微软雅黑")
    except Exception:
        pass

    p: Project = data["project"]
    doc.add_heading(_fmt(p.title), level=0)
    doc.add_paragraph(f"项目编号：{_fmt(p.number)}")

    # 1. 基本信息
    doc.add_heading("一、项目基本信息", level=1)
    table = doc.add_table(rows=0, cols=2)
    table.style = "Light Grid Accent 1"
    for k, v in _project_basic_rows(data):
        row = table.add_row()
        row.cells[0].text = k
        row.cells[1].text = v

    # 2. 项目人员
    doc.add_heading("二、项目人员", level=1)
    members = data["members"]
    if members:
        mtable = doc.add_table(rows=1, cols=5)
        mtable.style = "Light Grid Accent 1"
        hdr = mtable.rows[0].cells
        for i, h in enumerate(["姓名", "职务", "是否负责人", "状态", "加入时间"]):
            hdr[i].text = h
        for m in members:
            row = mtable.add_row().cells
            row[0].text = data["names"].get(str(m.user_id), str(m.user_id))
            row[1].text = _fmt(m.role_title)
            row[2].text = "是" if m.is_owner else "否"
            row[3].text = "在职" if m.is_active else "已离队"
            row[4].text = _fmt(m.joined_at)
    else:
        doc.add_paragraph("暂无项目人员")

    # 3. 项目提案
    doc.add_heading("三、项目提案", level=1)
    proposals = data["proposals"]
    if proposals:
        ptable = doc.add_table(rows=1, cols=7)
        ptable.style = "Light Grid Accent 1"
        hdr = ptable.rows[0].cells
        for i, h in enumerate(["编号", "标题", "类型", "优先级", "状态", "创建人", "执行人"]):
            hdr[i].text = h
        for pr in proposals:
            row = ptable.add_row().cells
            row[0].text = _fmt(pr.number)
            row[1].text = _fmt(pr.title)
            row[2].text = PROPOSAL_TYPE_MAP.get(pr.type or "", _fmt(pr.type))
            row[3].text = _fmt(pr.priority)
            row[4].text = PROPOSAL_STATUS_MAP.get(pr.status or "", _fmt(pr.status))
            row[5].text = data["names"].get(str(pr.creator_id), str(pr.creator_id))
            row[6].text = (
                data["names"].get(str(pr.assignee_id), str(pr.assignee_id))
                if pr.assignee_id
                else "-"
            )
        # 提案描述与拒绝理由（仅当存在时）
        for pr in proposals:
            if pr.description or pr.reject_reason:
                doc.add_paragraph(f"提案 {_fmt(pr.number)}：{_fmt(pr.title)}")
                if pr.description:
                    doc.add_paragraph(f"  描述：{_fmt(pr.description)}")
                if pr.reject_reason:
                    doc.add_paragraph(f"  拒绝理由：{_fmt(pr.reject_reason)}")
    else:
        doc.add_paragraph("暂无项目提案")

    # 4. 待办任务
    doc.add_heading("四、待办任务", level=1)
    todos = data["todos"]
    if todos:
        ttable = doc.add_table(rows=1, cols=6)
        ttable.style = "Light Grid Accent 1"
        hdr = ttable.rows[0].cells
        for i, h in enumerate(["编号", "标题", "优先级", "状态", "指派人", "截止日期"]):
            hdr[i].text = h
        for t in todos:
            row = ttable.add_row().cells
            row[0].text = _fmt(t.number)
            row[1].text = _fmt(t.title)
            row[2].text = _fmt(t.priority)
            row[3].text = TODO_STATUS_MAP.get(t.status or "", _fmt(t.status))
            row[4].text = (
                data["names"].get(str(t.assignee_id), str(t.assignee_id))
                if t.assignee_id
                else "-"
            )
            row[5].text = _fmt(t.due_date)
    else:
        doc.add_paragraph("暂无待办任务")

    # 5. 交流记录
    doc.add_heading("五、交流记录", level=1)
    meetings = data["meetings"]
    if meetings:
        metable = doc.add_table(rows=1, cols=5)
        metable.style = "Light Grid Accent 1"
        hdr = metable.rows[0].cells
        for i, h in enumerate(["编号", "类型", "时间", "发言人", "内容"]):
            hdr[i].text = h
        for mt in meetings:
            row = metable.add_row().cells
            row[0].text = _fmt(mt.number)
            row[1].text = _fmt(mt.type)
            row[2].text = _fmt(mt.started_at)
            row[3].text = _fmt(mt.speaker)
            row[4].text = _fmt(mt.content)
    else:
        doc.add_paragraph("暂无交流记录")

    # 6. 修改记录
    doc.add_heading("六、修改记录", level=1)
    changes = data["changes"]
    if changes:
        ctable = doc.add_table(rows=1, cols=6)
        ctable.style = "Light Grid Accent 1"
        hdr = ctable.rows[0].cells
        for i, h in enumerate(["编号", "标题", "日期", "大类", "小类", "状态"]):
            hdr[i].text = h
        for c in changes:
            row = ctable.add_row().cells
            row[0].text = _fmt(c.number)
            row[1].text = _fmt(c.title)
            row[2].text = _fmt(c.date)
            row[3].text = _fmt(c.category_major)
            row[4].text = _fmt(c.category_minor)
            row[5].text = CHANGE_STATUS_MAP.get(c.status or "", _fmt(c.status))
    else:
        doc.add_paragraph("暂无修改记录")

    # 7. 项目事件
    doc.add_heading("七、项目事件", level=1)
    events = data["events"]
    if events:
        etable = doc.add_table(rows=1, cols=5)
        etable.style = "Light Grid Accent 1"
        hdr = etable.rows[0].cells
        for i, h in enumerate(["编号", "类型", "标题", "操作人", "时间"]):
            hdr[i].text = h
        for e in events:
            row = etable.add_row().cells
            row[0].text = _fmt(e.number)
            row[1].text = EVENT_TYPE_MAP.get(e.event_type or "", _fmt(e.event_type))
            row[2].text = _fmt(e.title)
            row[3].text = data["names"].get(str(e.operator_id), str(e.operator_id))
            row[4].text = _fmt(e.created_at)
    else:
        doc.add_paragraph("暂无项目事件")

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf


# ── Excel 导出 ──────────────────────────────────────────────────────
def _build_xlsx(data: dict) -> io.BytesIO:
    """构建 Excel 工作簿（openpyxl），返回 BytesIO。"""
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font
    from openpyxl.utils import get_column_letter

    wb = Workbook()

    def _write_sheet(ws, title: str, headers: list[str], rows: list[list]):
        """写入一个工作表：标题行 + 数据行 + 列宽自适应。"""
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

    p: Project = data["project"]

    # Sheet 1: 项目信息
    ws1 = wb.active
    ws1.title = "项目信息"
    basic_rows = [[k, v] for k, v in _project_basic_rows(data)]
    _write_sheet(ws1, f"项目：{_fmt(p.title)}", ["字段", "值"], basic_rows)

    # Sheet 2: 项目人员
    ws2 = wb.create_sheet("项目人员")
    member_rows = [
        [
            data["names"].get(str(m.user_id), str(m.user_id)),
            _fmt(m.role_title),
            "是" if m.is_owner else "否",
            "在职" if m.is_active else "已离队",
            _fmt(m.joined_at),
            _fmt(m.left_at),
        ]
        for m in data["members"]
    ]
    _write_sheet(
        ws2, "项目人员", ["姓名", "职务", "是否负责人", "状态", "加入时间", "离开时间"], member_rows
    )

    # Sheet 3: 项目提案
    ws3 = wb.create_sheet("项目提案")
    proposal_rows = [
        [
            _fmt(pr.number),
            _fmt(pr.title),
            PROPOSAL_TYPE_MAP.get(pr.type or "", _fmt(pr.type)),
            _fmt(pr.priority),
            PROPOSAL_STATUS_MAP.get(pr.status or "", _fmt(pr.status)),
            data["names"].get(str(pr.creator_id), str(pr.creator_id)),
            (
                data["names"].get(str(pr.assignee_id), str(pr.assignee_id))
                if pr.assignee_id
                else "-"
            ),
            _fmt(pr.description),
            _fmt(pr.reject_reason),
        ]
        for pr in data["proposals"]
    ]
    _write_sheet(
        ws3,
        "项目提案",
        ["编号", "标题", "类型", "优先级", "状态", "创建人", "执行人", "描述", "拒绝理由"],
        proposal_rows,
    )

    # Sheet 4: 待办任务
    ws4 = wb.create_sheet("待办任务")
    todo_rows = [
        [
            _fmt(t.number),
            _fmt(t.title),
            _fmt(t.priority),
            TODO_STATUS_MAP.get(t.status or "", _fmt(t.status)),
            (
                data["names"].get(str(t.assignee_id), str(t.assignee_id))
                if t.assignee_id
                else "-"
            ),
            _fmt(t.due_date),
            _fmt(t.description),
        ]
        for t in data["todos"]
    ]
    _write_sheet(
        ws4, "待办任务", ["编号", "标题", "优先级", "状态", "指派人", "截止日期", "描述"], todo_rows
    )

    # Sheet 5: 交流记录
    ws5 = wb.create_sheet("交流记录")
    meeting_rows = [
        [
            _fmt(mt.number),
            _fmt(mt.type),
            _fmt(mt.started_at),
            _fmt(mt.speaker),
            _fmt(mt.content),
        ]
        for mt in data["meetings"]
    ]
    _write_sheet(ws5, "交流记录", ["编号", "类型", "时间", "发言人", "内容"], meeting_rows)

    # Sheet 6: 修改记录
    ws6 = wb.create_sheet("修改记录")
    change_rows = [
        [
            _fmt(c.number),
            _fmt(c.title),
            _fmt(c.date),
            _fmt(c.category_major),
            _fmt(c.category_minor),
            _fmt(c.category_detail),
            CHANGE_STATUS_MAP.get(c.status or "", _fmt(c.status)),
            _fmt(c.content),
        ]
        for c in data["changes"]
    ]
    _write_sheet(
        ws6,
        "修改记录",
        ["编号", "标题", "日期", "大类", "小类", "详细分类", "状态", "内容"],
        change_rows,
    )

    # Sheet 7: 项目事件
    ws7 = wb.create_sheet("项目事件")
    event_rows = [
        [
            _fmt(e.number),
            EVENT_TYPE_MAP.get(e.event_type or "", _fmt(e.event_type)),
            _fmt(e.title),
            data["names"].get(str(e.operator_id), str(e.operator_id)),
            _fmt(e.created_at),
        ]
        for e in data["events"]
    ]
    _write_sheet(ws7, "项目事件", ["编号", "类型", "标题", "操作人", "时间"], event_rows)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


# ── 对外入口 ────────────────────────────────────────────────────────
async def export_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    current_user: User,
    fmt: str = "docx",
) -> tuple[io.BytesIO, str, str]:
    """导出项目。

    参数：
        fmt: 'docx' 或 'xlsx'
    返回：
        (bytes 流, 文件名, content_type)
    """
    project = await require_project_member(db, project_id, current_user)
    data = await _collect_export_data(db, project)
    base = f"{project.title or '项目'}_{project.number or str(project.id)[:8]}"
    if fmt == "xlsx":
        buf = _build_xlsx(data)
        return (
            buf,
            f"{base}.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    buf = _build_docx(data)
    return (
        buf,
        f"{base}.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
