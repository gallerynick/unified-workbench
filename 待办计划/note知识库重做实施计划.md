# note 知识库重做 —— 实施计划

> 关联规格：`待办计划/note知识库重做设计规格.md`
> 状态：**待执行** ｜ 创建日期：2026-09-08 ｜ 版本：v2.0.0

---

## 1. 计划头部

**Goal**：把 note 模块从「纯文本树 + 父子假图谱」重做为「Tiptap 富文本 + 双向链接 + 反向链接 + 真知识图谱 + 标签 + 全文搜索 + 服务端草稿」的知识工作台，content 模块保持独立不动。

**Architecture**：三栏前端工作台（导航 / 编辑器 / 上下文面板）；后端 note 表加 `body`(JSONB) + `plain_text`(Text) + `restricted_tags`(JSONB)，新增 `note_link`（双链边，图谱与反向链接的唯一数据源）与 `note_draft`（服务端草稿）；编辑器 `ContentEditor` 从 `pages/content/` 提升为全局组件并以 `extensions` props 注入扩展，content 调用方行为不变。

**Tech Stack**：FastAPI + SQLAlchemy 2.0（async）+ Alembic + PostgreSQL 15（`pg_trgm`）；React 18 + TypeScript 5 + AntD 5 + Tiptap 3.31.3 + react-force-graph-2d 1.29.1。

**Baseline / Authority Refs**：
- `项目基定/开发基准文档.md` 2.1 技术栈（Tiptap 清单本轮已扩展，经用户授权）、3.1 权限、4 安全、7 数据库公约
- `项目基定/API路由尾部斜杠规范.md`
- `项目基定/UI设计规范.md`（禁 Emoji 图标、深浅色双适配、design token）
- `项目基定/项目开发日志格式.md`（收尾日志）
- `待办计划/共用组件抽取与推广计划.md`（共用组件模式先例）
- `项目架构/数据库设计概览.md`、`项目架构/数据库演进与迁移.md`、`项目架构/前端架构概览.md`、`项目架构/权限模型设计.md`

**Compatibility Boundary**：
- `content` 表、`content` API、`ContentManagement/ContentForm` 的**数据与路由不变**；仅 import 路径变化 + `extensions` 传原集合，行为须零回归
- 权限三态 `public`/`private`/`restricted` 模型不变，仅补齐 `restricted_tags`
- note 现有 `parent_id` 层级、置顶、分类、拖拽移动、循环引用检测全部保留
- `content` 列不立即删除，保留一个版本周期（048 迁移处理，不在本计划）
- API 统一响应 `{ "code": 0, "msg": "", "data": {} }` + 尾斜杠

**TDD Route**：
- Mode: off
- Decision: skipped
- Strict authority: not applicable（用户未提出 TDD 要求）
- Test posture: post-change regression + 手动冒烟；后端复用现有 pytest 基建补 `test_notes.py`
- Reason: 用户未要求严格 TDD；项目后端已有 15 个 pytest 用例可作回归基线，前端无 test 脚本，故以前端 tsc + build + 手动冒烟为主
- Verification: 见各任务 `Verification` 与第 5 节质量门

**Verification（总门）**：
~~~
cd 项目文件/backend && ruff check . && ruff format --check . && mypy app --ignore-missing-imports
cd 项目文件/backend && pytest app/tests -q
cd 项目文件/frontend && npx tsc -b && npm run build
bash 项目文件/start.sh   # 部署冒烟（唯一允许的启动方式）
~~~

---

## 2. 规划自检（紧凑输出）

**BaselineUsageDraft**
- Required baseline refs: 开发基准文档 2.1/3.1/4/7、API 尾斜杠规范、UI 设计规范、日志格式
- Cited in plan refs: 上述全部 + 数据库设计概览/演进迁移/前端架构/权限模型 + 共用组件计划
- Missing refs: 无
- Decision: continue

**Requirement Ready Check**
- Requirement source refs: 用户 2026-09-08 三轮确认（方向 = note 内重做不合并 content；能力 = 一档全 + 二档全 + 三档不做；基定扩展授权）
- Goals / scope / acceptance refs: 规格 1/2/11 节
- Open blocker questions: 无
- Decision: ready

**Change Necessity**
- User-visible need: note 无富文本、图谱为父子假关系、标签无 UI、可见性字段丢失、搜索仅 ILIKE、草稿存 localStorage
- No-change option: 不足以达成任一目标；文档/配置无法改变数据模型与编辑器能力
- Why code change necessary: 需新增表（`note_link`/`note_draft`）、迁移、Tiptap 自定义节点、新 API 端点
- Minimum change boundary: note 三件套（models/services/api/schemas）+ 2 新表 + 1 迁移 + notes 页面重写 + ContentEditor 全局化
- Decision: code-change

**Existence Check**
- Proposed new surface: `note_link` 表、`note_draft` 表、`wikilink`/`note-embed`/`callout` Tiptap 节点、`SlashMenu`
- Existing owner / reuse candidate: 图谱渲染复用 `GraphView.tsx` + `react-force-graph-2d`；编辑器复用 `ContentEditor.tsx`（`reuse-existing`）；可见性设置复用 `VisibilitySetting`
- Why existing surface insufficient: 双链边需索引化查询（JSON 扫描为 O(n)）；草稿需服务端持久化（localStorage 跨环境丢失）
- Creation proof: 规格 5.2/5.3 节
- Entropy / retirement impact: 4 个新面均落在 note 模块 owner 内；退役触发条件明确（双链下线 → 删 `note_link`；草稿下线 → 删 `note_draft`）
- Decision: add-with-proof（编辑器与图谱走 reuse-existing）

**Architecture Integrity Lens**
- invariant: 双链边以 `note_link` 为唯一事实源，禁止从 `body` JSON 扫描得出图谱
- canonical owner: `services/note_link.py` 拥有双链解析与查询；`services/note.py` 只调用它
- responsibility overlap: 无（content 不触碰）
- higher-level simplification: 已确认不合并 content（用户决策）
- retirement / falsifier: 若 `note_link` 长期为空，说明双链未被使用，应回访价值
- verdict: clean

**Plan Pressure Test**
- Owner / contract / retirement: 新表均有 owner 与退役条件；`content` 列退役在 048（不在本计划）
- Architecture integrity: 见上
- Verification scope: 后端 pytest + 前端 tsc/build + 迁移双场景 + 冒烟
- Task executability: 任务按依赖排序，P0 可独立上线
- Pressure result: proceed

**Plan-Time Complexity Check**
- Target files: `services/note.py`(230 行，将重写约 180 行)、`NoteManagement.tsx`(317 行，整体替换)
- Existing size / shape signals: note 服务层职责单一（CRUD + 移动 + 可见性），无过度耦合；NoteManagement 把树构建/过滤/渲染/弹窗全塞一个文件
- Owner fit: 服务层保持单文件；前端按职责拆 5 个文件（Workspace/Sidebar/Editor/RightPanel/MetaPanel）
- Add-in-place risk: 若在 NoteManagement 内继续堆叠，单文件将破 700 行 → 必须拆
- Better file boundary: 三栏各自独立文件，`NoteModal` 删除（表单能力并入 `NoteEditor` 与 `NoteMetaPanel`）
- Recommendation: add owner file + split task

---

## 3. 文件地图

**新增（后端）**
~~~
项目文件/backend/app/models/note_link.py
项目文件/backend/app/models/note_draft.py
项目文件/backend/app/services/note_link.py
项目文件/backend/app/services/note_text.py        # body <-> plain_text 提取
项目文件/backend/app/services/note_draft.py
项目文件/backend/app/schemas/note_link.py
项目文件/backend/alembic/versions/047_rework_note_for_knowledge_base.py
项目文件/backend/app/tests/test_notes.py
~~~

**新增（前端）**
~~~
项目文件/frontend/src/components/ContentEditor/ContentEditor.tsx        # 由 pages/content 迁移
项目文件/frontend/src/components/ContentEditor/ContentEditor.module.css
项目文件/frontend/src/components/ContentEditor/extensions/WikiLink.ts
项目文件/frontend/src/components/ContentEditor/extensions/NoteEmbed.tsx
项目文件/frontend/src/components/ContentEditor/extensions/Callout.ts
项目文件/frontend/src/components/ContentEditor/extensions/SlashMenu.tsx
项目文件/frontend/src/components/ContentEditor/noteExtensions.ts        # notes 扩展集装配
项目文件/frontend/src/pages/notes/NoteWorkspace.tsx
项目文件/frontend/src/pages/notes/NoteWorkspace.module.css
项目文件/frontend/src/pages/notes/NoteSidebar.tsx
项目文件/frontend/src/pages/notes/NoteEditor.tsx
项目文件/frontend/src/pages/notes/NoteRightPanel.tsx
项目文件/frontend/src/pages/notes/BacklinksPanel.tsx
项目文件/frontend/src/pages/notes/NoteMetaPanel.tsx
项目文件/frontend/src/hooks/useNoteDraft.ts
~~~

**修改**
~~~
项目文件/backend/app/models/note.py
项目文件/backend/app/models/__init__.py
项目文件/backend/app/services/note.py
项目文件/backend/app/api/notes.py
项目文件/backend/app/schemas/note.py
项目文件/backend/app/tests/conftest.py              # 视需要补 note 模型导入
项目文件/frontend/src/pages/content/ContentForm.tsx      # import 路径
项目文件/frontend/src/pages/content/ContentManagement.tsx # import 路径
项目文件/frontend/src/pages/notes/GraphView.tsx          # 数据源切换
项目文件/frontend/src/pages/notes/notesToGraphData.ts
项目文件/frontend/src/api/notes.ts
项目文件/frontend/src/types/note.ts
项目文件/frontend/package.json + package-lock.json
~~~

**删除**
~~~
项目文件/frontend/src/pages/content/ContentEditor.tsx          # 迁至 components
项目文件/frontend/src/pages/content/ContentEditor.module.css
项目文件/frontend/src/pages/notes/NoteManagement.tsx
项目文件/frontend/src/pages/notes/NoteModal.tsx
项目文件/frontend/src/pages/notes/NoteManagement.module.css
~~~

---

## 4. 任务分解

> 约定：每任务完成即独立可验证；P0 可单独提交上线。API 前缀 `/api/v1`。

### P0 —— 前置修复（可独立上线）

#### T0.1 NoteResponse 补可见性字段

**Files**: `backend/app/schemas/note.py` ｜ `frontend/src/types/note.ts`
**Why**: 修复「编辑他人共享笔记时可见性回退 private」的数据丢失风险
**Change Necessity**: `NoteResponse` 未暴露字段导致前端读不到真值；无文档方案可修
**Verification**: `pytest app/tests/test_content.py -q` 通过（回归）；手动验证 restricted 笔记授权后编辑可见性不回退

**Step 1** —— 修改 `schemas/note.py` 的 `NoteResponse`：
~~~python
class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    content: str | None
    body: dict | None = None
    plain_text: str | None = None
    category: str | None
    tags: list[str] | None
    is_pinned: bool
    parent_id: uuid.UUID | None
    owner_id: uuid.UUID
    visibility: str
    restricted_users: list | None
    restricted_tags: list | None
    created_at: datetime
    updated_at: datetime
~~~
**Step 2** —— `types/note.ts` 的 `Note` 接口补 `body`?: `Record<string, unknown> | null`、`plain_text`?: `string | null`，并把 `visibility`/`restricted_users` 改为必填（后端已保证）。
**Step 3** —— 运行 `cd 项目文件/backend && pytest app/tests -q`，确认零回归。

#### T0.2 建立 `test_notes.py` 回归基线

**Files**: `backend/app/tests/test_notes.py`
**Why**: note 模块此前无测试，重做前需建立回归基线
**Verification**: `pytest app/tests/test_notes.py -q` 全绿

**Step 1** —— 按 `test_content.py` 的模式写 8 个用例：创建、详情、更新、删除、列表分页、置顶排序、移动到子节点（应报循环错误）、可见性三态（private/public/restricted 的读权限）。全部走 `/api/v1/notes/` + `member_token`。
**Step 2** —— 若 `conftest.py` 的模型导入未覆盖 note，在其中补 `from app.models.note import Note  # noqa: F401`。
**Step 3** —— 运行 `pytest app/tests/test_notes.py -q`。

---

### P1 —— 后端（模型 / 迁移 / 服务 / API）

#### T1.1 note 模型加字段

**Files**: `backend/app/models/note.py`
**Why**: Tiptap JSON 需要 `body`；全文搜索需要 `plain_text`；补齐三态可见性需 `restricted_tags`
**Verification**: `pytest app/tests -q` 通过

**Step 1** —— 在 `Note` 中 `content` 之后加入：
~~~python
    body: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    plain_text: Mapped[str | None] = mapped_column(Text, nullable=True)
~~~
并在 `restricted_users` 之后加入：
~~~python
    restricted_tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)
~~~
**Step 2** —— 在 `create_note` / `update_note` 中透传三个新字段（读自 schema）。
**Step 3** —— 运行 `pytest app/tests -q`。

#### T1.2 新增 `note_link` 与 `note_draft` 模型

**Files**: `backend/app/models/note_link.py`（新增）、`backend/app/models/note_draft.py`（新增）、`backend/app/models/__init__.py`
**Why**: 双链边索引化查询；草稿服务端持久化
**Verification**: `pytest app/tests -q` 通过；`Base.metadata.create_all` 能建出两表

**Step 1** —— 新建 `note_link.py`：
~~~python
"""笔记双链边模型（图谱与反向链接的唯一数据源）。"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.note import Note


class NoteLink(Base):
    __tablename__ = "note_link"
    __table_args__ = (UniqueConstraint("source_id", "target_id", name="uq_note_link_src_tgt"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("note.id", ondelete="CASCADE"), index=True, nullable=False
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("note.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    source: Mapped["Note"] = relationship("Note", foreign_keys=[source_id])
    target: Mapped["Note"] = relationship("Note", foreign_keys=[target_id])
~~~
**Step 2** —— 新建 `note_draft.py`：
~~~python
"""笔记服务端草稿模型。"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.note import Note
    from app.models.user import User


class NoteDraft(Base):
    __tablename__ = "note_draft"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"), nullable=False)
    # NULL = 尚未关联 note 的新笔记草稿
    note_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("note.id", ondelete="CASCADE"), nullable=True
    )
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    body: Mapped[dict] = mapped_column(JSONB, nullable=False)
    saved_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    owner: Mapped["User"] = relationship("User")
    note: Mapped["Note | None"] = relationship("Note")
~~~
**Step 3** —— 在 `models/__init__.py` 导出 `NoteLink`、`NoteDraft`（对齐现有导出风格）。
**Step 4** —— 运行 `pytest app/tests -q`，确认建表无冲突。

#### T1.3 Alembic 047 迁移

**Files**: `backend/alembic/versions/047_rework_note_for_knowledge_base.py`（新增）
**Why**: 结构演进 + 存量数据回填 + 全文搜索索引
**Compatibility**: `content` 列不删；回填幂等
**Verification**: `alembic upgrade 046:047` 在空库与现有数据两种场景成功；`alembic downgrade 047:046` 可回退

**Step 1** —— 新建迁移文件，`revision = "047"`、`down_revision = "046"`（已核实当前唯一 head 为 046）：
~~~python
"""rework_note_for_knowledge_base

Revision ID: 047
Revises: 046
"""

import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "047"
down_revision: Union[str, None] = "046"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _wrap_tiptap(text: str) -> dict:
    """把纯文本包成单一 paragraph 的 Tiptap JSON（保留换行）。"""
    paras = [{"type": "text", "text": chunk} for chunk in (text or "").split("\n\n")]
    if not paras or paras[0].get("text") == "":
        paras = []
    return {
        "type": "doc",
        "content": [{"type": "paragraph", "content": [p]} for p in paras],
    }


def upgrade() -> None:
    op.add_column("note", sa.Column("body", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("note", sa.Column("plain_text", sa.Text(), nullable=True))
    op.add_column("note", sa.Column("restricted_tags", postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, content FROM note WHERE body IS NULL")).fetchall()
    for rid, content in rows:
        if not content:
            continue
        bind.execute(
            sa.text("UPDATE note SET body = CAST(:b AS jsonb), plain_text = :t WHERE id = :i"),
            {"b": json.dumps(_wrap_tiptap(content), ensure_ascii=False), "t": content, "i": str(rid)},
        )

    op.create_table(
        "note_link",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("source_id", sa.Uuid(), sa.ForeignKey("note.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_id", sa.Uuid(), sa.ForeignKey("note.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("source_id", "target_id", name="uq_note_link_src_tgt"),
    )
    op.create_index("ix_note_link_source_id", "note_link", ["source_id"])
    op.create_index("ix_note_link_target_id", "note_link", ["target_id"])

    op.create_table(
        "note_draft",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("owner_id", sa.Uuid(), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("note_id", sa.Uuid(), sa.ForeignKey("note.id", ondelete="CASCADE"), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("body", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("saved_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("owner_id", "note_id", name="uq_note_draft_owner_note"),
    )
    op.create_index("ix_note_draft_owner_note", "note_draft", ["owner_id", "note_id"])
    op.execute("CREATE UNIQUE INDEX uq_note_draft_new ON note_draft (owner_id) WHERE note_id IS NULL")

    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_index("ix_note_plain_text_trgm", "note", ["plain_text"], postgresql_using="gin", postgresql_ops={"plain_text": "gin_trgm_ops"})


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_note_plain_text_trgm")
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
    op.execute("DROP INDEX IF EXISTS uq_note_draft_new")
    op.drop_index("ix_note_draft_owner_note", table_name="note_draft")
    op.drop_table("note_draft")
    op.drop_index("ix_note_link_target_id", table_name="note_link")
    op.drop_index("ix_note_link_source_id", table_name="note_link")
    op.drop_table("note_link")
    op.drop_column("note", "restricted_tags")
    op.drop_column("note", "plain_text")
    op.drop_column("note", "body")
~~~
> 注意：JSONB 写入 SQLite 测试库不可用；本迁移仅在 PostgreSQL 执行，测试走 `Base.metadata.create_all`。回填用 `json.dumps` + `CAST(:b AS jsonb)`，不依赖 SQLAlchemy 类型绑定。

**Step 2** —— 运行 `cd 项目文件/backend && alembic upgrade head`（连真实 Postgres），确认成功。
**Step 3** —— 运行 `alembic downgrade -1 && alembic upgrade head`，确认幂等可回退。

#### T1.4 `note_text.py` —— body 纯文本提取

**Files**: `backend/app/services/note_text.py`（新增）
**Why**: `plain_text` 需在保存时由 `body` 同步生成，供搜索与摘要
**Verification**: 单元验证（在 T1.9 的测试中覆盖）

**Step 1** —— 新建：
~~~python
"""Tiptap body <-> 纯文本 互转。"""

from __future__ import annotations


def extract_plain_text(body: dict | None) -> str | None:
    """从 Tiptap JSON 提取纯文本，段落间以 \n\n 分隔。"""
    if not body or not isinstance(body, dict):
        return None
    buf: list[str] = []

    def walk(node: dict) -> None:
        ntype = node.get("type")
        if ntype == "text":
            buf.append(node.get("text") or "")
            return
        for child in node.get("content") or []:
            if isinstance(child, dict):
                walk(child)
        if ntype in {"paragraph", "heading", "blockquote", "bulletList", "orderedList", "taskList", "taskItem", "codeBlock"}:
            buf.append("\n\n")

    walk(body)
    text = "".join(buf).strip()
    return text or None
~~~

#### T1.5 `note_link.py` —— 双链服务

**Files**: `backend/app/services/note_link.py`（新增）
**Why**: 双链边重建、反向链接查询、图谱构建的统一 owner
**Verification**: `pytest app/tests/test_notes.py -q` 中双链相关用例通过

**Step 1** —— 新建：
~~~python
"""笔记双链服务：出边重建、反向链接、图谱。"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note import Note
from app.models.note_link import NoteLink


def extract_link_targets(body: dict | None) -> list[str]:
    """从 Tiptap JSON 提取 wikilink 节点的 target_id（去重、保序）。"""
    out: list[str] = []

    def walk(node: dict) -> None:
        if node.get("type") == "wikilink":
            t = (node.get("attrs") or {}).get("target_id")
            if t and t not in out:
                out.append(t)
        for child in node.get("content") or []:
            if isinstance(child, dict):
                walk(child)

    if isinstance(body, dict):
        walk(body)
    return out


def _is_uuid(v: str) -> bool:
    try:
        uuid.UUID(v)
        return True
    except (ValueError, TypeError):
        return False


async def rebuild_outgoing_links(db: AsyncSession, note_id: uuid.UUID, body: dict | None) -> None:
    """全量重建某 note 的出边（先删后插）。目标不存在或 id 非法时静默跳过。"""
    await db.execute(delete(NoteLink).where(NoteLink.source_id == note_id))
    raw = extract_link_targets(body)
    if not raw:
        await db.flush()
        return
    candidates = [uuid.UUID(t) for t in raw if _is_uuid(t)]
    valid = (
        await db.execute(select(Note.id).where(Note.id.in_(candidates)))
    ).scalars().all()
    for tid in valid:
        db.add(NoteLink(source_id=note_id, target_id=tid))
    await db.flush()
~~~

**Step 2** —— 追加两个查询函数：
~~~python
@dataclass
class BacklinkItem:
    note_id: str
    title: str
    excerpt: str | None
    updated_at: str


async def get_backlinks(db: AsyncSession, note_id: uuid.UUID, user_id: uuid.UUID) -> list[dict]:
    """返回引用 note_id 的笔记（已做可见性过滤）。"""
    q = (
        select(NoteLink.source_id)
        .where(NoteLink.target_id == note_id)
    )
    src_ids = [r[0] for r in (await db.execute(q)).all()]
    if not src_ids:
        return []
    notes = (await db.execute(select(Note).where(Note.id.in_(src_ids)))).scalars().all()
    from app.services.note import _visibility_get_check  # 复用可见性判定
    out = []
    for n in notes:
        if not _visibility_get_check(n, user_id):
            continue
        out.append({
            "note_id": str(n.id),
            "title": n.title,
            "excerpt": (n.plain_text or n.content or "")[:120] or None,
            "updated_at": n.updated_at.isoformat(),
        })
    out.sort(key=lambda x: x["updated_at"], reverse=True)
    return out


async def get_graph(db: AsyncSession, user_id: uuid.UUID, root_id: uuid.UUID | None = None, depth: int = 1) -> dict:
    """构建图谱。root_id 为空时返回全局图谱；否则返回 N 跳局部图谱。"""
    from app.services.visibility import build_visibility_filter
    base = select(Note).where(build_visibility_filter(Note, user_id))
    if root_id is None:
        notes = list((await db.execute(base)).scalars().all())
    else:
        visited: set[uuid.UUID] = {root_id}
        frontier: list[uuid.UUID] = [root_id]
        for _ in range(max(1, min(depth, 2))):
            nxt: list[uuid.UUID] = []
            rows = await db.execute(select(NoteLink).where(NoteLink.source_id.in_(frontier) | NoteLink.target_id.in_(frontier)))
            for lk in rows.scalars().all():
                for cand in (lk.source_id, lk.target_id):
                    if cand not in visited:
                        visited.add(cand)
                        nxt.append(cand)
            frontier = nxt
        notes = list((await db.execute(base.where(Note.id.in_(list(visited))))).scalars().all())
    ids = {n.id: n for n in notes}
    links = (await db.execute(select(NoteLink).where(NoteLink.source_id.in_(list(ids)), NoteLink.target_id.in_(list(ids))))).scalars().all()
    return {
        "nodes": [{"id": str(n.id), "title": n.title, "category": n.category, "is_pinned": n.is_pinned} for n in notes],
        "links": [{"source": str(l.source_id), "target": str(l.target_id)} for l in links],
    }
~~~

#### T1.6 note 服务改造（body 写入 + 链接重建）

**Files**: `backend/app/services/note.py`
**Why**: 创建/更新时同步写 `body`/`plain_text` 并重建 `note_link`
**Verification**: `pytest app/tests/test_notes.py -q` 通过

**Step 1** —— `create_note`：构造 `Note` 时加 `body=request.body`、`plain_text=extract_plain_text(request.body or None) ` or `(request.content or None)`、`restricted_tags=request.restricted_tags`；`flush` 后调用 `await rebuild_outgoing_links(db, note.id, note.body)`。
**Step 2** —— `update_note`：对 `body` 变化时重算 `plain_text`，并调用 `rebuild_outgoing_links`。
**Step 3** —— `delete_note`：不变（`note_link` 靠 `ondelete="CASCADE"` 级联；SQLite 测试需 `PRAGMA foreign_keys=ON`，在 `conftest.py` 的 `engine` fixture 中加 `await conn.exec_driver_sql("PRAGMA foreign_keys=ON")`）。
**Step 4** —— 列表查询增加 `tag` 过滤：`if tag: query = query.where(Note.tags.contains([tag]))`（JSONB 包含）。
**Step 5** —— 运行 `pytest app/tests -q`。

#### T1.7 搜索（pg_trgm）

**Files**: `backend/app/services/note.py`
**Why**: 替代 title-only ILIKE，覆盖正文/分类/标签
**Compatibility**: 使用 `ILIKE` 语义，Postgres 上由 GIN 索引加速，SQLite 测试同样可用
**Verification**: `pytest app/tests/test_notes.py -q` 中搜索用例通过

**Step 1** —— 修改 `list_notes` 的 search 分支：
~~~python
    if search:
        like = f"%{search}%"
        cond = Note.title.ilike(like) | Note.plain_text.ilike(like) | Note.category.ilike(like)
        if Note.tags.property is not None:
            cond = cond | Note.tags.contains([search])
        query = query.where(cond)
~~~
> 说明：`ILIKE` + `ix_note_plain_text_trgm`(gin_trgm_ops) 在 PostgreSQL 上会自动走三元组索引；无需显式 `%` 特殊写法。SQLite 下退化为顺序扫描，仅用于测试。

#### T1.8 草稿服务

**Files**: `backend/app/services/note_draft.py`（新增）
**Why**: 服务端自动保存草稿，替代 localStorage
**Verification**: `pytest app/tests/test_notes.py -q` 中草稿用例通过

**Step 1** —— 新建，提供三个函数（均校验 `owner_id == current_user.id`，草稿归属本人，不做可见性判定）：
~~~python
"""笔记草稿服务。"""

from __future__ import annotations

import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note_draft import NoteDraft


async def get_draft(db: AsyncSession, owner_id: uuid.UUID, note_id: uuid.UUID | None) -> NoteDraft | None:
    q = select(NoteDraft).where(NoteDraft.owner_id == owner_id)
    if note_id is not None:
        q = q.where(NoteDraft.note_id == note_id)
    else:
        q = q.where(NoteDraft.note_id.is_(None))
    q = q.order_by(NoteDraft.saved_at.desc())
    return (await db.execute(q.limit(1))).scalar_one_or_none()


async def upsert_draft(db: AsyncSession, owner_id: uuid.UUID, note_id: uuid.UUID | None, title: str | None, body: dict) -> NoteDraft:
    existing = await get_draft(db, owner_id, note_id)
    if existing:
        existing.title = title
        existing.body = body
    else:
        existing = NoteDraft(owner_id=owner_id, note_id=note_id, title=title, body=body)
        db.add(existing)
    await db.flush()
    return existing


async def delete_draft(db: AsyncSession, owner_id: uuid.UUID, note_id: uuid.UUID | None) -> bool:
    d = await get_draft(db, owner_id, note_id)
    if not d:
        return False
    await db.delete(d)
    await db.flush()
    return True
~~~

#### T1.9 Schema + API 扩展

**Files**: `backend/app/schemas/note.py`、`backend/app/api/notes.py`、`backend/app/schemas/note_link.py`
**Why**: 暴露 backlinks / graph / tags / draft 能力
**Verification**: `pytest app/tests/test_notes.py -q` 全绿；`/api/v1/docs` 可见新端点

**Step 1** —— `NoteCreate` / `NoteUpdate` 加 `body: dict | None = None`、`restricted_tags: list | None = None`。
**Step 2** —— 新建 `schemas/note_link.py`：`BacklinkItem`（`note_id: str`、`title: str`、`excerpt: str | None`、`updated_at: str`）、`GraphData`（`nodes: list[dict]`、`links: list[dict]`）、`TagCount`（`tag: str`、`count: int`）、`DraftResponse`。
**Step 3** —— `api/notes.py` 新增端点（全部尾斜杠风格对齐现有文件）：
~~~python
@router.get("/{note_id}/backlinks", response_model=UnifiedResponse[list[BacklinkItem]])
@router.get("/{note_id}/graph", response_model=UnifiedResponse[GraphData])     # depth: int = Query(1, ge=1, le=2)
@router.get("/graph", response_model=UnifiedResponse[GraphData])
@router.get("/tags", response_model=UnifiedResponse[list[TagCount]])
@router.get("/draft", response_model=UnifiedResponse[DraftResponse])           # note_id 可选
@router.put("/draft", response_model=UnifiedResponse[DraftResponse])
@router.delete("/draft", response_model=UnifiedResponse[None])
~~~
> 路由顺序：`"/tags"`、`"/draft"`、`"/graph"` 必须声明在 `"/{note_id}"` **之前**，否则 `note_id` 会吞掉字面量。
**Step 4** —— `/tags` 实现：查可见笔记，展开 `tags` 数组计数，按 count 降序返回。
**Step 5** —— 运行 `pytest app/tests -q`。

#### T1.10 后端测试扩展

**Files**: `backend/app/tests/test_notes.py`
**Verification**: `pytest app/tests/test_notes.py -q` 全绿（目标 ≥ 16 用例）

**Step 1** —— 在 T0.2 的 8 个用例上追加：
- body 写入与 `plain_text` 同步
- 双链：A 正文含 wikilink 指向 B → `GET /notes/{B}/backlinks` 含 A
- 删除 B 后 A 的 backlinks 不含 B（级联）
- 局部图谱：A→B→C，`GET /notes/{A}/graph?depth=2` 含 A/B/C 三节点两连边
- 全局图谱 `/notes/graph`
- 标签聚合 `/notes/tags`
- 草稿：PUT → GET 一致；DELETE 后 GET 为空
- 草稿归属隔离：`member_token` 读不到 admin 的草稿
- 搜索命中正文（创建含中文正文的笔记，search 中文命中）

---

### P2 —— 编辑器组件（全局化 + 新扩展）

#### T2.1 新增 npm 依赖

**Files**: `frontend/package.json`、`package-lock.json`
**Verification**: `npm install` 成功；`npm ls @tiptap/extension-task-list` 有版本

**Step 1** —— 运行：
~~~
cd 项目文件/frontend
npm install @tiptap/extension-task-list@^3.31.3 @tiptap/extension-task-item@^3.31.3 @tiptap/extension-table@^3.31.3 @tiptap/extension-row@^3.31.3 @tiptap/extension-cell@^3.31.3 @tiptap/extension-header-row@^3.31.3 @tiptap/extension-image@^3.31.3 @tiptap/extension-placeholder@^3.31.3 @tiptap/extension-highlight@^3.31.3 @tiptap/extension-link@^3.31.3 lowlight highlight.js
~~~
**Step 2** —— 确认全部安装到 3.31.x，与现有 Tiptap 版本一致。

#### T2.2 ContentEditor 全局化

**Files**: 迁至 `frontend/src/components/ContentEditor/ContentEditor.tsx` 与 `.module.css`
**Why**: notes 需复用；content 保持原行为
**Compatibility**: 新增 `extensions`? props，默认空数组；content 调用方不改传参即行为不变
**Verification**: `npx tsc -b` 零错误；content 页面新增/编辑冒烟正常

**Step 1** —— 移动文件：
~~~
mkdir -p 项目文件/frontend/src/components/ContentEditor/extensions
git mv 项目文件/frontend/src/pages/content/ContentEditor.tsx 项目文件/frontend/src/components/ContentEditor/ContentEditor.tsx
git mv 项目文件/frontend/src/pages/content/ContentEditor.module.css 项目文件/frontend/src/components/ContentEditor/ContentEditor.module.css
~~~
**Step 2** —— Props 接口扩展：
~~~typescript
interface ContentEditorProps {
  value?: Record<string, unknown> | null;
  onChange?: (value: Record<string, unknown>) => void;
  placeholder?: string;
  minHeight?: number;
  editable?: boolean;
  /** 调用方注入的额外扩展；默认空，行为与迁移前完全一致 */
  extensions?: import('@tiptap/core').Extension[];
}
~~~
**Step 3** —— `useEditor` 的 `extensions` 数组改为 `[...base, ...(extensions ?? [])]`，其中 `base` 保持原 5 项（StarterKit/Underline/TextStyle/Color/FontSize）。
**Step 4** —— 修正 `ContentForm.tsx` 与 `ContentManagement.tsx`（如引用）的 import 路径为 `@/components/ContentEditor/ContentEditor`。
**Step 5** —— `npx tsc -b`。

#### T2.3 WikiLink 扩展

**Files**: `components/ContentEditor/extensions/WikiLink.ts`
**Verification**: `npx tsc -b` 零错误

**Step 1** —— 新建（Tiptap 3 自定义节点）：
~~~typescript
import { mergeAttributes, nodeAttribute } from '@tiptap/core';
import { ReactNodeViewRenderer, Node } from '@tiptap/react';
import WikiLinkView from './WikiLinkView';

export type WikiLinkOptions = { HTMLAttributes: Record<string, unknown> };
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikilink: {
      insertWikiLink: (attrs: { target_id: string; target_title: string; display?: string }) => ReturnType;
      deleteWikiLink: () => ReturnType;
    };
  }
}

export const WikiLink = Node.create<WikiLinkOptions>({
  name: 'wikilink',
  group: 'inline',
  inline: true,
  selectable: true,
  atom: true,
  addOptions() { return { HTMLAttributes: { class: 'note-wikilink' } }; },
  addAttributes() {
    return {
      target_id: nodeAttribute({ default: null }),
      target_title: nodeAttribute({ default: '' }),
      display: nodeAttribute({ default: null }),
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-wikilink]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as { target_id: string; target_title: string; display?: string | null };
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-wikilink': 'true', 'data-target-id': attrs.target_id }), attrs.display ?? attrs.target_title];
  },
  addNodeView() { return ReactNodeViewRenderer(WikiLinkView); },
  addCommands() {
    return {
      insertWikiLink: (attrs) => ({ commands }) => commands.insertContent({ type: this.name, attrs }),
      deleteWikiLink: () => ({ commands }) => commands.deleteSelection(),
    };
  },
});
~~~
**Step 2** —— 同目录新建 `WikiLinkView.tsx`：渲染为带高亮底色 + 图标的可点击行内元素，点击调 `props.node.attrs.target_id` 的跳转回调（通过 `ReactNodeViewProps` 的 `editor` 或自定义 `onNavigate` 上下文注入）。

#### T2.4 NoteEmbed 扩展

**Files**: `components/ContentEditor/extensions/NoteEmbed.tsx`
**Verification**: `npx tsc -b` 零错误

**Step 1** —— 自定义节点 `note-embed`，`attrs: { target_id }`，block 节点。NodeView 渲染卡片：标题 + 摘要 + 展开按钮；展开时 `useEffect` 拉取目标笔记详情，以 `editable=false` 的 ContentEditor 只读渲染其 `body`。
**Step 2** —— **强制嵌套深度 1 层**：NodeView 内渲染目标 `body` 时不传入 `note-embed` 扩展（即传入的基础扩展集里剔除 NoteEmbed），避免递归。
**Step 3** —— 目标不可见（接口 403）时渲染「无权限访问」占位卡片。

#### T2.5 Callout 扩展

**Files**: `components/ContentEditor/extensions/Callout.ts`
**Verification**: `npx tsc -b` 零错误

**Step 1** —— 自定义 block 节点 `callout`，`attrs: { variant: 'info'|'warning'|'danger'|'success' }`，content 为 `block+`。渲染为左侧色条 + 背景卡片，variant 颜色全部取自 design token（如 `var(--color-info)`），不使用硬编码 hex。

#### T2.6 SlashMenu

**Files**: `components/ContentEditor/extensions/SlashMenu.tsx`
**Verification**: `npx tsc -b` 零错误；手动输入 `/` 弹出菜单

**Step 1** —— 基于 antd `Popover` + `List` 实现斜杠菜单：监听编辑器 `/` 触发，弹出分组命令列表（段落/标题1-3/引用/代码块/待办列表/无序列表/分割线/Callout/表格/图片/内部链接/笔记内嵌），选中后执行对应 Tiptap `commands`。
**Step 2** —— 命令项图标一律 `@ant-design/icons`。
**Step 3** —— 输入 `[[` 时触发标题联想下拉（数据源 `listAllNotes`），选中调 `insertWikiLink`。

#### T2.7 notes 扩展集装配

**Files**: `components/ContentEditor/noteExtensions.ts`
**Verification**: `npx tsc -b` 零错误

**Step 1** —— 导出 `noteExtensions(onNavigate)` 函数，返回完整扩展数组：
~~~typescript
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-row';
import TableCell from '@tiptap/extension-cell';
import TableHeaderRow from '@tiptap/extension-header-row';
import { WikiLink } from './extensions/WikiLink';
import { NoteEmbed } from './extensions/NoteEmbed';
import { Callout } from './extensions/Callout';

export function noteExtensions(onNavigate: (noteId: string) => void): any[] {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
    Underline, TextStyle, Color,
    Highlight, Link, Image, Placeholder.configure({ placeholder: '输入 / 展开命令，输入 [[ 插入内部链接' }),
    TaskList, TaskItem.configure({ HTMLAttributes: { class: 'not-prose' } }),
    Table.configure({ resizable: false }), TableRow, TableCell, TableHeaderRow,
    WikiLink, NoteEmbed.configure({ onNavigate }), Callout,
  ];
}
~~~
> `FontSize` 从 ContentEditor 的 base 集保留（base 仍含 5 项），此处不重复。

#### T2.8 content 回归验证

**Files**: 无代码改动
**Verification**: `pytest app/tests/test_content.py -q` 通过；content 页面新增/编辑/列表手动冒烟通过

**Step 1** —— 运行 `cd 项目文件/backend && pytest app/tests/test_content.py -q`。
**Step 2** —— `npm run build` 后启动，验证内容管理新增、编辑、保存、列表正常，确认编辑器迁移未破坏 content。

---

### P3 —— 前端工作台

#### T3.1 types / api 层

**Files**: `frontend/src/types/note.ts`、`frontend/src/api/notes.ts`
**Verification**: `npx tsc -b` 零错误

**Step 1** —— `types/note.ts` 新增 `BacklinkItem`、`GraphData`（`nodes: {id,title,category,is_pinned}[]`、`links: {source,target}[]`）、`TagCount`、`NoteDraft`；`Note` 补 `body`/`plain_text`/`restricted_tags`。
**Step 2** —— `api/notes.ts` 新增：`listNotes(search?, category?, tag?, parentId?, page?, pageSize?)`、`getBacklinks(id)`、`getGraph(id, depth)`、`getGlobalGraph()`、`listNoteTags()`、`getDraft(noteId?)`、`saveDraft(noteId, title, body)`、`deleteDraft(noteId?)`。全部走统一 `request` 封装。

#### T3.2 NoteWorkspace 三栏布局

**Files**: `pages/notes/NoteWorkspace.tsx`、`NoteWorkspace.module.css`
**Verification**: `npx tsc -b`；页面渲染三栏

**Step 1** —— 布局：左侧 `NoteSidebar`（固定 280px，可折叠至 60px）｜中间 `NoteEditor`（弹性）｜右侧 `NoteRightPanel`（320px，可折叠）。使用 flex，右侧面板折叠状态存组件 state。
**Step 2** —— 顶部工具条：标题、新建按钮、搜索（联动 Sidebar）、右侧面板切换、视图切换（工作台 / 全局图谱）。
**Step 3** —— 路由与导航保持 `/notes` 不变；`MainLayout.tsx` 的菜单项不改。
**Step 4** —— CSS 全部使用 `var(--token)` 引用，不写 hex。

#### T3.3 NoteSidebar

**Files**: `pages/notes/NoteSidebar.tsx`
**Verification**: `npx tsc -b`；手动验证过滤与拖拽

**Step 1** —— 搜索框（debounce 300ms，调 `listNotes({search})`）、分类下拉、标签多选（数据源 `listNoteTags()`）、置顶过滤开关、树形/平铺切换。
**Step 2** —— 树形视图沿用原 `buildTree` 逻辑与拖拽移动（调 `moveNote`）；平铺视图按 `updated_at` 倒序。
**Step 3** —— 列表项显示：文件/文件夹图标（有子笔记则为文件夹）、置顶图钉、标题、分类 Tag。操作按钮（编辑/置顶/删除）沿用现有 Tooltip + Button 模式。
**Step 4** —— 选中项高亮用 `var(--color-primary-bg)` 之类 token；禁 Emoji。

#### T3.4 NoteEditor + 草稿

**Files**: `pages/notes/NoteEditor.tsx`、`hooks/useNoteDraft.ts`
**Verification**: `npx tsc -b`；手动验证自动保存与恢复

**Step 1** —— `useNoteDraft(noteId, initial)` hook：`onChange` 后 debounce 1.5s 调 `saveDraft`；返回 `{ saveState: 'saving'|'saved'|'draft', draft, restore, discard }`。
**Step 2** —— `NoteEditor` 顶部：标题输入（大号无边框）、保存状态指示（图标 + 文字）、字数统计、置顶开关。
**Step 3** —— 正文：`<ContentEditor value={body} extensions={noteExtensions(onNavigate)} minHeight={480} />`。
**Step 4** —— 打开笔记时先 `getDraft(id)`：有草稿则顶部 Alert「检测到未保存草稿」+ 恢复 / 丢弃按钮；点「保存」调 `updateNote(id, {body, title,...})` 后 `deleteDraft(id)`。
**Step 5** —— 点击 wikilink 跳转：`onNavigate(id)` 切换当前笔记（Workspace 持有 `currentId` state）。
**Step 6** —— 新建笔记：先 `createNote({title:'未命名笔记', visibility:'private'})` 得到 id，再进入编辑；取消则删除。

#### T3.5 BacklinksPanel

**Files**: `pages/notes/BacklinksPanel.tsx`
**Verification**: `npx tsc -b`；手动验证面板数据

**Step 1** —— 调 `getBacklinks(currentId)`，列表展示：标题（点击跳转）+ 摘要（灰字截断）+ 更新时间。空态用 `Empty` + 说明文字「还没有笔记引用这篇」。
**Step 2** —— 当前笔记变化时自动刷新。

#### T3.6 NoteMetaPanel

**Files**: `pages/notes/NoteMetaPanel.tsx`
**Verification**: `npx tsc -b`

**Step 1** —— 展示并维护：分类（Input）、标签（Select tags 模式，数据源 `listNoteTags()` 合并现有）、可见性（复用 `VisibilitySetting`，含 restricted 用户/标签选择）。
**Step 2** —— 展示只读元信息：创建时间、更新时间、所有者、父笔记（可跳转）。
**Step 3** —— 保存调 `updateNote`，即时生效并提示。

#### T3.7 GraphView 数据源切换

**Files**: `pages/notes/GraphView.tsx`、`notesToGraphData.ts`
**Verification**: `npx tsc -b`；手动验证图谱边来自双链

**Step 1** —— `GraphView` props 从 `notes: Note[]` 改为 `graph: GraphData`（`nodes` + `links`）；渲染逻辑、力导向参数、深浅色 token 解析、hover 高亮邻居、分类着色、节点点击全部**保留不动**。
**Step 2** —— 删除 `notesToGraphData.ts`（父子转边的逻辑作废）。
**Step 3** —— 局部图谱：进入笔记后调 `getGraph(id, 1)`；全局图谱：调 `getGlobalGraph()`。图谱节点无边时可切换显示孤立节点。

#### T3.8 旧文件删除与收尾

**Files**: 删除 `NoteManagement.tsx`、`NoteModal.tsx`、`NoteManagement.module.css`
**Verification**: `grep -rn "NoteManagement|NoteModal" 项目文件/frontend/src` 无残留引用

**Step 1** —— 检查路由与导航文件，确认入口已指向 `NoteWorkspace`。
**Step 2** —— `git rm` 三个旧文件。
**Step 3** —— `npx tsc -b && npm run build`。

---

### P4 —— 验证与收尾

#### T4.1 后端质量门
~~~
cd 项目文件/backend
ruff check . --fix
ruff format .
mypy app --ignore-missing-imports
pytest app/tests -q
~~~
**Verification**: 全部零错误、测试全绿。

#### T4.2 前端质量门
~~~
cd 项目文件/frontend
npx tsc -b
npm run lint
npm run build
~~~
**Verification**: 零错误。

#### T4.3 迁移双场景验证
**Verification**: 空库 + 现有数据两种场景 `alembic upgrade head` 均成功；回填幂等（重复执行不覆盖已有 `body`）；downgrade 可回退

**Step 1** —— 备份当前数据库（项目已有备份模块）。
**Step 2** —— 空库执行 `alembic upgrade head`。
**Step 3** —— 现有数据执行 `alembic upgrade head`，抽查 5 条旧笔记的 `body` 与 `plain_text` 正确。

#### T4.4 部署冒烟
~~~
bash 项目文件/start.sh
~~~
**Verification**: 逐项验证规格第 11 节 11 条验收标准；`content` 模块无回归；深浅色模式切换正常

#### T4.5 开发日志
**Files**: `项目开发日志/日志编号_YYYYMMDD_NNN_note知识库重做.md`
**Verification**: 按《项目开发日志格式.md》模板完整填写，列出全部新增/修改/删除文件

**Step 1** —— 按模板写日志：开发版本 v2.0.0、关联基定（2.1/3.1/4/7 + API 尾斜杠 + UI 规范）、开发目标、涉及文件（新增/修改/删除三段完整清单）、开发内容详述、遇到的问题与解决、测试情况、一致性确认、下一步计划（048 迁移删 `content` 列、note 审计日志补齐、README badge 已修）。
**Step 2** —— 提交本次全部改动（一个 commit）。

---

## 5. 执行顺序与依赖

~~~
P0 (T0.1, T0.2)                        可独立提交上线
  └─> P1 (T1.1 → T1.2 → T1.3 → T1.4 → T1.5 → T1.6 → T1.7 → T1.8 → T1.9 → T1.10)
        └─> P2 (T2.1 → T2.2 → T2.3~T2.6 可并行 → T2.7 → T2.8)
              └─> P3 (T3.1 → T3.2 → T3.3/T3.4/T3.5/T3.6 可并行 → T3.7 → T3.8)
                    └─> P4 (T4.1/T4.2 可并行 → T4.3 → T4.4 → T4.5)
~~~

并行建议：T2.3/T2.4/T2.5/T2.6 互不依赖可同时推进；T3.3/T3.4/T3.5/T3.6 在 T3.1/T3.2 后可并行。

---

## 6. 风险与缓解

| 风险 | 缓解 |
|---|---|
| SQLite 测试不支持 JSONB 原生操作 | 现有 `content.py` 已用 JSONB 且测试通过，沿用同一写法；搜索用 `ILIKE` 语义保证 SQLite 可用 |
| 级联删除在 SQLite 默认关闭外键 | `conftest.py` 的 `engine` fixture 加 `PRAGMA foreign_keys=ON` |
| Tiptap 自定义节点与 StarterKit 冲突 | 三个自定义节点名（`wikilink`/`note-embed`/`callout`）均不与现有节点重名 |
| `note-embed` 无限递归 | NodeView 渲染目标 body 时剔除 `NoteEmbed` 扩展，硬限深度 1 层 |
| `ContentEditor` 迁移破坏 content | 新增 `extensions` 默认空数组；T2.8 专门做 content 回归；验收标准第 10 条覆盖 |
| 回填失败损坏数据 | 幂等（已有 `body` 不覆盖）；T4.3 先备份再迁移 |
| API 路由字面量被 `/{note_id}` 吞掉 | `/tags`、`/draft`、`/graph` 声明在 `/{note_id}` 之前（T1.9 Step 3 已注明） |
| pg_trgm 中文搜索精度 | 20 人规模数据量小；若后续需要排序权重再叠加 tsvector |

---

## 7. 不在本计划（明确移交）

1. **048 迁移删除 `content` 列** —— 需在本次上线稳定后单独执行，属下一个版本周期
2. **note 审计日志补齐** —— 现状缺口，独立排期（规格附录 B）
3. **ContentEditor 深色模式 token 复核** —— 迁移时顺手核对，不作为独立任务

---

## 8. 自审结论

- **规格覆盖**：规格 2.1 表格 7 项能力均对应到任务（编辑器 → T2.x；双链/反向链接/内嵌 → T2.3/T2.4/T1.5；图谱 → T1.5/T3.7；标签 → T3.6；搜索 → T1.7；草稿 → T1.8/T3.4；可见性修复 → T0.1）
- **占位符扫描**：无 TBD/TODO/占位注释；T1.5 的 `rebuild_outgoing_links` 与 T1.3 的回填写入均为完整实现（含非法 UUID 过滤、目标存在性校验、`json.dumps` + `CAST(... AS jsonb)`）
- **类型一致性**：`body` 全程 `dict` / `Record<string, unknown>`；`note_link` 的 id 为 UUID；API 响应统一 `UnifiedResponse[T]`
- **兼容性**：content 不合并、`content` 列保留、权限三态不变、层级/置顶/拖拽保留，均已在 Compatibility Boundary 与各任务 Verification 中体现
- **变更必要性**：第 2 节 Change Necessity 已记录，最小边界为 note 三件套 + 2 表 + 1 迁移 + notes 重写 + 编辑器全局化
- **存在性检查**：4 个新面均 add-with-proof，编辑器与图谱走 reuse-existing
- **架构完整性**：双链边以 `note_link` 为唯一事实源，无 caller-side fallback
- **复杂度治理**：NoteManagement（317 行）拆为 5 文件，避免单文件破 700 行；note 服务层保持单文件不膨胀
- **验证**：每任务均有确切命令；总门含后端 lint/type/test + 前端 tsc/lint/build + 迁移双场景 + 冒烟

---

## 9. Execution Readiness View

- **Intent Lock**：note 模块内重做为知识工作台；content 保持独立不合并（用户 2026-09-08 三轮确认）
- **Scope Fence**：一档核心基础 + 二档五项增强全做；Notion 数据库多视图 / Relation-Rollup / Canvas / 版本历史 / AI 明确不做（规格 2.2）
- **Baseline Lock**：《开发基准文档》2.1 Tiptap 清单已扩展（用户授权，已提交）；UI 禁 Emoji、design token、尾斜杠、统一响应四约束贯穿
- **Approved Behavior**：三栏工作台；双链 `[[...]]` 可插可跳；反向链接面板；图谱边=双链；标签 UI；全文搜索；服务端草稿；可见性不回退
- **Owner / Contract Constraints**：`services/note_link.py` 独占双链解析与查询；`note_link` 表是图谱唯一事实源，禁止从 `body` JSON 扫描得出边；`ContentEditor` 全局组件以 `extensions` props 隔离调用方差异
- **Compatibility Boundary**：content 数据与路由不变；note 的 `parent_id`/置顶/分类/拖拽/循环检测保留；`content` 列保留至 048 迁移；权限三态不新增概念
- **Retirement Boundary**：`note_link` 退役触发 = 双链功能整体下线；`note_draft` 退役触发 = 草稿功能下线；`content` 列退役在 048（本计划不做）
- **Task Batches**：P0（2 任务，可独立上线）→ P1（10 任务，严格串行）→ P2（8 任务，T2.3~T2.6 可并行）→ P3（8 任务，T3.3~T3.6 可并行）→ P4（5 任务）
- **Test Obligations**：`pytest app/tests -q` 全绿（含新增 `test_notes.py` ≥16 用例 + `test_content.py` 零回归）；`npx tsc -b` 零错误；`npm run build` 通过；迁移空库/存量双场景；部署冒烟逐项过规格 11 条验收
- **Review Gates**：P0 完成即可单独提交评审；P1 完成后后端可评审；P2 完成后编辑器组件可评审；P3 完成后前端整体评审；P4 为交付门
- **Drift / Rewind Rules**：任何任务若发现需改动 `content` 表/路由即停手回到设计评审；若 Tiptap 自定义节点与 StarterKit 冲突，先降级为纯 attr 标记方案再上报，不自行扩展基定；`content` 列删除一律移交 048
- **Evidence Required Before Completion**：第 4 节 P4 五任务全部 Verification 通过 + 开发日志按模板提交 + 单一 commit
- **Advisory Boundary**：本节为执行引导视图，不构成完成授权；完成判定以 P4 验证证据 + 用户确认为准

---

## 10. Execution Route

```
Execution Route:
- Decision: subagent-driven
- Evidence:
  - T2.3/T2.4/T2.5/T2.6（四个 Tiptap 扩展）互不依赖、owner 边界清晰，适合并行
  - T3.3/T3.4/T3.5/T3.6（四个前端面板）互不依赖，适合并行
  - 每个任务有独立 Verification 命令，可两阶段评审
  - 本会话 subagent 可用
- Fallback: 若 subagent 不可用或某批次上下文耦合超预期，退回 inline 串行执行
- User confirmation required: no
```

**REQUIRED SUB-SKILL**：subagent-driven 路线执行时需加载 `aegis:subagent-driven-development`（每任务一个 fresh subagent + 两阶段评审）。inline 退回时加载 `aegis:executing-plans`。

---

## 11. 启动方式（不可违反）

- 所有服务启动/重建/重启一律使用 `项目文件/start.sh`（macOS）或 `项目文件/start.bat`（Windows）
- **不得手动运行 `docker compose` 命令**
- 版本号不主动更新；`.unified-workbench` 的 `min_version` 仅在用户明确指示时同步
