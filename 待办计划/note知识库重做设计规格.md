# note 知识库重做 —— 设计规格

> 状态：**待实施**
> 创建日期：2026-09-08
> 版本：v2.0.0
> 关联基定：《开发基准文档》2.1 技术栈、3.1 用户与权限模块、4 安全基准、7 数据库设计公约
> 决策记录：方向与能力边界经用户确认（2026-09-08）；基定 Tiptap 能力清单扩展已获用户授权

---

## 一、背景与目标

现有「笔记知识库」（note 模块）能力薄弱且不直观：正文是纯文本框、图谱只画父子关系、标签字段存在但无 UI、可见性字段响应缺失。用户要求以 Notion 与 Obsidian 为参考改进甚至重做 note 模块。

**目标**：把 note 从「纯文本树 + 假图谱」重做为「Tiptap 富文本 + 双向链接 + 反向链接 + 真知识图谱」的知识工作台。

**成功证据**（可观测）：
1. 笔记正文可用富文本编辑，支持斜杠菜单、Callout、任务列表、代码块高亮
2. `[[...]]` 双链可插入、可跳转，编辑器内高亮显示
3. 反向链接面板显示引用当前笔记的其他笔记
4. 图谱的边来自双链（而非父子关系），支持局部图谱（N 跳）与全局图谱
5. 标签可在 UI 维护、可过滤、可搜索
6. 全文搜索替代 ILIKE，支持正文/标题/分类/标签
7. 编辑内容服务端自动保存草稿，换浏览器/清缓存不丢
8. `NoteResponse` 返回 `visibility` / `restricted_users` / `restricted_tags`，编辑他人共享笔记不再丢失可见性

---

## 二、范围

### 2.1 做

| 类别 | 能力 |
|---|---|
| 编辑器 | Tiptap 富文本（复用并扩展 `ContentEditor`）、斜杠菜单 `/`、Callout、任务列表、代码块语言高亮、表格、图片、内联代码 |
| 知识关系 | 双链 `[[...]]`、反向链接面板、笔记内嵌 `![[note]]` |
| 图谱 | 真知识图谱（边=双链）、局部图谱（N 跳）、全局图谱 |
| 组织 | 标签 UI 与维护、分类过滤 |
| 搜索 | 全文搜索（PG `pg_trgm`） |
| 可靠性 | 服务端自动保存草稿、可见性字段修复 |
| 结构 | `ContentEditor` 提升为全局组件 |

### 2.2 不做（明确排除）

- **不合并 `content` 模块** —— 内容 ≠ 知识，二者定位独立（用户确认）
- Notion 式数据库多视图（Table / Board / Calendar / Timeline / Gallery）
- Relation / Rollup 关联聚合
- Canvas 无限画布
- 版本历史 / 回收站
- AI agents
- 笔记导出（Word/PDF）—— 基定文档导出能力未覆盖 note，另议
- 笔记审计日志补齐 —— 现状缺口，独立排期（见附录 B）

### 2.3 边界

- `content` 表、`content` API、`ContentManagement` 页面**不改动数据与路由**，仅将 `ContentEditor` 组件位置提升为全局共享，并通过 `extensions` props 保持 content 调用方行为不变
- 权限与可见性三态（`public`/`private`/`restricted`）沿用现有模型，不新增权限概念
- 遵循《API路由尾部斜杠规范.md》
- 图标一律 `@ant-design/icons`，禁 Emoji；颜色与尺寸一律引用 `styles/token.css` design token；适配深浅色模式

---

## 三、现状诊断（证据在案）

| # | 问题 | 证据 |
|---|---|---|
| 1 | 两个重叠内容系统 | `models/content.py`（Tiptap JSON body）与 `models/note.py`（plain Text）并存 |
| 2 | 笔记无富文本 | `Note.content` 为 `Text`；`NoteModal.tsx` 用 `Input.TextArea`；而 `pages/content/ContentEditor.tsx` 已有完整 Tiptap 实现未被 note 使用 |
| 3 | 图谱非知识图谱 | `notesToGraphData.ts` 仅将 `parent_id` 父子关系转为边，无内容双链 |
| 4 | 标签字段存在但无 UI | `Note.tags` JSONB 列、schema 字段均在，`NoteModal.tsx` 无标签输入 |
| 5 | 可见性字段响应缺失 | `schemas/note.py` 的 `NoteResponse` 无 `visibility` / `restricted_users`，但 `types/note.ts` 声明且 `NoteModal.tsx` 编辑时读取 → 编辑他人共享笔记时可见性回退 `private`，存在数据丢失风险 |
| 6 | 可见性三态不齐 | note 缺 `restricted_tags`（`content.py` 有） |
| 7 | 搜索仅 ILIKE | `services/note.py` 用 `title.ilike` | `content.ilike` |
| 8 | 草稿存 localStorage | `ContentManagement.tsx` 草稿写 `localStorage['content_drafts']`，换环境即丢；notes 无草稿概念 |
| 9 | 硬删除、无历史 | `delete_note` 直接删除，子笔记变根笔记 |
| 10 | 编辑器能力不足 | `ContentEditor.tsx` 仅启用 StarterKit + Underline + TextStyle + Color + FontSize；无高亮、任务列表、Callout、提及、表格、内嵌、代码高亮、斜杠菜单 |

---

## 四、参考工具分析摘要

> 完整特性清单与官方锚点见 2026-09-08 会话记录。搜索工具本轮仅返回 URL、未返回正文，特性描述基于既有知识 + 以下官方锚点。

**Notion** —— 核心原语「块 + 数据库」
- 块编辑器（`/` 斜杠插入、可拖动嵌套折叠）
- 数据库 + 多视图（Table / Board / Timeline / Calendar / Gallery），属性即列
- Relation + Rollup；页面即数据库条目
- 双向引用、Wiki 模式（owner/验证/过期）、模板 + 按钮、Linked Blocks、`@` 提及
- Notion 3.0 Agents（2025-09）
- 锚点：Notion 官方新功能页 <https://www.notion.com/nl/releases/page/5>；Notion 3.0 发布 <https://www.notion.com/it/releases/2025-09-18>；Notion 视图开发指南 <https://developers.notion.com/guides/data-apis/working-with-views>

**Obsidian** —— 核心原语「文件 + 链接」
- 本地优先（纯 Markdown 文件、vault = 文件夹、数据主权归用户）
- 双链 `[[...]]`（别名 / 标题跳转 / 块引用）
- 反向链接面板（含未链接提及检测）—— 图谱数据源
- 图谱视图（局部 1-2 跳 + 全局，筛选/着色/搜索）
- Markdown 增强（任务列表、Callout、嵌入、标签、YAML frontmatter、KaTeX、Mermaid）
- Canvas 无限画布、属性视图、结构化搜索、1000+ 社区插件
- 关键差异：原生无 Notion 式 database，表格视图依赖 Dataview 插件
- 锚点：<https://github.com/peterkaminski-ai/pkai-obsidian-reference/blob/main/What%20Is%20Obsidian.md>

**取舍结论**：Notion 取「模板/斜杠菜单/Callout/任务列表/表格」等结构化编辑体验；Obsidian 取「双链 + 反向链接 + 图谱」知识关系能力。**架构不照搬**——Notion 的 server-first 云锁定与 Obsidian 的 local-first 单机模型均不符合本项目「内网自建、20 人协作、数据位置可指定、权限三态」的定位，统一落到 PostgreSQL + Tiptap + 现有权限模型。

---

## 五、数据模型设计

### 5.1 `note` 表改造

| 字段 | 现状 | 目标 | 说明 |
|---|---|---|---|
| `id` | UUID PK | 不变 | |
| `title` | String(200) | 不变 | |
| `content` | `Text` | **弃用** | 迁移一个版本周期后由下一个迁移删除 |
| `body` | — | **新增 `JSONB`** | Tiptap JSON，编辑器单一数据源 |
| `plain_text` | — | **新增 `Text`** | 服务端从 `body` 提取纯文本，供全文搜索 |
| `category` | String(100) | 不变 | |
| `tags` | JSONB | 不变 | 补 UI 维护入口 |
| `is_pinned` | bool | 不变 | |
| `parent_id` | UUID FK self | 不变 | 保留层级 |
| `owner_id` | UUID FK user | 不变 | |
| `visibility` | String(20) | 不变 | |
| `restricted_users` | JSONB | 不变 | |
| `restricted_tags` | — | **新增 JSONB** | 补齐三态，与 `content.py` 对齐 |
| `created_at` / `updated_at` | DateTime | 不变 | |

`status` 列**不加入** `note` 表——草稿状态由独立 `note_draft` 表表达，不污染主表。

### 5.2 `note_link` 表（新增）—— 图谱真实数据源

~~~
id          UUID PK
source_id   UUID FK note.id ON DELETE CASCADE  NOT NULL
target_id   UUID FK note.id ON DELETE CASCADE  NOT NULL
created_at  DateTime server_default now()
UNIQUE(source_id, target_id)
INDEX(target_id)     -- 反向链接查询
INDEX(source_id)
~~~

保存 note 时在事务内「先删后插」重建出边。20 人规模下 note 数量几百至几千，该表规模恒定较小。

**为什么单独建表而非从 JSON 扫描**：反向链接与图谱是高频读操作，JSON 扫描为 O(n)，表查询为索引 O(1)；且双链边的显式存储让图谱查询、度数计算、孤立笔记检测都不必解析文档结构。

### 5.3 `note_draft` 表（新增）—— 服务端草稿

~~~
id         UUID PK
owner_id   UUID FK user.id  NOT NULL
note_id    UUID FK note.id  NULL        -- NULL = 未发布的新笔记草稿
title      String(200)    NULL
body       JSONB          NOT NULL
saved_at   DateTime server_default now()
UNIQUE(owner_id, note_id)
+ 部分唯一索引 UNIQUE(owner_id) WHERE note_id IS NULL   -- 每用户最多 1 个新笔记草稿
~~~

### 5.4 索引与搜索

`plain_text` 建 GIN 索引（`pg_trgm` 扩展）：

~~~sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX ix_note_plain_text_trgm ON note USING gin (plain_text gin_trgm_ops);
~~~

**机制选择说明**：用户初选 PG `tsvector`。评估后改用 `pg_trgm`，理由——`tsvector('simple')` 对中文按空白/标点切词，连续中文常被当作单一 token，中文全文检索效果差；`zhparser` 需安装扩展，内网不确定可用；`pg_trgm` 基于字符三元组，中文友好、无需分词器、可直接加速现有 `ILIKE` 语义。数据量在数百至数千篇时性能充足。若后续确需 tsvector 排序权重，可在此基础上叠加，不冲突。

---

## 六、API 设计

统一响应 `{ "code": 0, "msg": "", "data": {} }`，遵循尾斜杠规范。

| 方法 | 路由 | 说明 | 状态 |
|---|---|---|---|
| GET | `/notes/` | 列表：分页 + `search` + `category` + `tag` + `parent_id` | 扩展（新增 `tag` 过滤） |
| GET | `/notes/all` | 侧栏全量 | 不变 |
| POST | `/notes/` | 创建 | 改（写 `body`/`plain_text`/`note_link`） |
| GET | `/notes/{id}` | 详情 | 改（返回 `body`） |
| PUT | `/notes/{id}` | 更新 | 改（写 `body`、重建 `note_link`） |
| DELETE | `/notes/{id}` | 删除 | 不变（级联删除 `note_link`） |
| PUT | `/notes/{id}/move` | 移动 + 循环引用检测 | 不变 |
| GET | `/notes/{id}/backlinks` | 反向链接（标题/摘要/更新时间） | **新增** |
| GET | `/notes/{id}/graph?depth=1` | 局部图谱，N 跳邻居 | **新增** |
| GET | `/notes/graph` | 全局图谱 | **新增** |
| GET | `/notes/tags` | 标签聚合，供标签选择器 | **新增** |
| GET | `/notes/draft` | 取草稿，`note_id` 可省 | **新增** |
| PUT | `/notes/draft` | 存草稿，`note_id` 可省 | **新增** |
| DELETE | `/notes/draft` | 丢草稿，`note_id` 可省 | **新增** |

搜索合并进 `/notes/` 的 `search` 参数，不另开 search 端点。

**Schema 修复**（可独立于重做单独提交）：`NoteResponse` 补 `body` / `visibility` / `restricted_users` / `restricted_tags`。

---

## 七、前端架构设计

### 7.1 三栏知识工作台

~~~
┌──────────────┬────────────────────────────────┬──────────────┐
│  左：导航      │  中：编辑器                      │  右：上下文     │
│              │                                │              │
│  搜索          │  # 标题（行内编辑）              │  反向链接       │
│  ──           │  ──                          │  ──          │
│  分类 / 标签   │  [Tiptap 编辑器]                │  图谱         │
│  置顶过滤      │   · 斜杠菜单 /                  │  ──          │
│  ──           │   · 双链 [[...]]               │  信息         │
│  笔记列表      │   · Callout / 任务列表          │  可见性        │
│  树形 ⇄ 平铺   │   · 代码块高亮                  │  标签 / 分类   │
│  ──           │   · 笔记内嵌 ![[...]]           │              │
│  + 新建       │  ──                          │              │
│              │  自动保存状态 · 字数             │              │
└──────────────┴────────────────────────────────┴──────────────┘
~~~

- 右侧面板可折叠，Tab 切换 `反向链接 / 图谱 / 信息`
- 保留现有 `parent_id` 层级：左栏列表支持「树形 ⇄ 平铺」切换，树形沿用现有 `buildTree` 与拖拽移动能力
- 现有 `GraphView.tsx` 的 `react-force-graph-2d` 实现（已适配深浅色 token、hover 高亮邻居、分类着色）**直接复用**，仅更换数据源与挂载位置

### 7.2 `ContentEditor` 提升为全局组件

- 现位置：`frontend/src/pages/content/ContentEditor.tsx`
- 目标位置：`frontend/src/components/ContentEditor/ContentEditor.tsx`
- 新增 `extensions` props，由调用方注入扩展：
  - `content` 调用方传空（或传原集合），行为与现状完全一致
  - `notes` 调用方传 wikilink / note-embed / callout / taskList / taskItem / table / image / placeholder / lowlight
- 属 `reuse-existing` 决策，符合项目已有「共用组件」模式（见《共用组件抽取与推广计划》B1/B2/B3）

### 7.3 文件清单

**新增**
- `frontend/src/components/ContentEditor/ContentEditor.tsx`（由 pages/content 迁移）
- `frontend/src/components/ContentEditor/ContentEditor.module.css`
- `frontend/src/components/ContentEditor/extensions/WikiLink.tsx`
- `frontend/src/components/ContentEditor/extensions/NoteEmbed.tsx`
- `frontend/src/components/ContentEditor/extensions/Callout.tsx`
- `frontend/src/components/ContentEditor/extensions/SlashMenu.tsx`
- `frontend/src/pages/notes/NoteWorkspace.tsx`（替代 `NoteManagement.tsx`）
- `frontend/src/pages/notes/NoteSidebar.tsx`
- `frontend/src/pages/notes/NoteEditor.tsx`
- `frontend/src/pages/notes/NoteRightPanel.tsx`
- `frontend/src/pages/notes/BacklinksPanel.tsx`
- `frontend/src/pages/notes/NoteMetaPanel.tsx`
- `backend/app/models/note_link.py`
- `backend/app/models/note_draft.py`
- `backend/app/services/note_link.py`
- `backend/app/services/note_search.py`
- `backend/app/schemas/note_link.py`
- `backend/alembic/versions/047_rework_note_for_knowledge_base.py`

**修改**
- `backend/app/models/note.py`
- `backend/app/services/note.py`
- `backend/app/api/notes.py`
- `backend/app/schemas/note.py`
- `backend/app/models/__init__.py`
- `frontend/src/pages/notes/GraphView.tsx`（数据源切换）
- `frontend/src/pages/notes/notesToGraphData.ts`
- `frontend/src/pages/content/ContentForm.tsx`、`ContentManagement.tsx`（改 import 路径）
- `frontend/src/api/notes.ts`
- `frontend/src/types/note.ts`
- `frontend/src/router.tsx`（如路由标题变化）
- `frontend/package.json` + `package-lock.json`

**删除**
- `frontend/src/pages/content/ContentEditor.tsx`（迁至 components）
- `frontend/src/pages/content/ContentEditor.module.css`
- `frontend/src/pages/notes/NoteManagement.tsx`
- `frontend/src/pages/notes/NoteModal.tsx`
- `frontend/src/pages/notes/NoteManagement.module.css`（内容迁移后重建）

---

## 八、关键机制设计

### 8.1 双链 `[[...]]`

- Tiptap 自定义节点：`{ type: 'wikilink', attrs: { target_id, target_title, display } }`
- 触发：输入 `[[` 或斜杠菜单选「内部链接」→ 标题联想（调 `/notes/all` 或列表接口）→ 选中插入节点
- 渲染：可点击高亮链接，点击切换笔记；`display` 支持自定义显示文本
- 保存时后端遍历 `body` 提取全部 `wikilink` 节点 `target_id`，事务内重建 `note_link` 出边
- 目标笔记被删除时：`note_link` 级联删除；`body` 中残留节点在渲染时降级为纯文本标题（不报错、不跳转）

### 8.2 反向链接

- `SELECT source_id FROM note_link WHERE target_id = ?`，索引命中
- 返回标题、`plain_text` 摘要（截断）、`updated_at`、是否双链回指

### 8.3 图谱

- 数据源 `note_link`（双向）
- 局部图谱：以当前笔记为根，沿边取 N 跳（默认 1，最大 2）
- 全局图谱：全部可见笔记 + 全部边；无边笔记默认隐藏，可切换显示为孤立节点
- 渲染沿用 `react-force-graph-2d`：点击节点打开笔记、hover 高亮邻居、按分类着色、搜索聚焦

### 8.4 笔记内嵌 `![[note]]`

- Tiptap 自定义节点：`{ type: 'note-embed', attrs: { target_id } }`
- 渲染为只读卡片（标题 + 摘要），展开态懒加载目标 `body` 以 `editable=false` 渲染
- **嵌套深度限制 1 层**：展开态内不再渲染内嵌节点，防无限递归
- 权限：目标笔记不可见时渲染为「无权限访问」占位卡片

### 8.5 搜索

- 端点：`GET /notes/?search=...`，匹配 `plain_text` / `title` / `category` / `tags`
- 实现：`pg_trgm` 的 `%...%` 语义 + GIN 索引，中文友好
- 前端搜索为即时（debounce 300ms），结果在左栏列表与正文命中位置高亮

### 8.6 草稿

- 编辑器 `onChange` debounce 1.5s → `PUT /notes/draft`
- 打开笔记先 `GET /notes/draft`；有草稿则顶部提示「恢复 / 丢弃」
- 保存按钮 → `PUT /notes/{id}` 正式更新 + `DELETE /notes/draft`
- 顶部常驻状态指示：保存中 / 已保存 / 有未保存草稿
- 新笔记：点击「新建」后在用户输入标题或正文前，以 `note_id` 为 NULL 的草稿暂存（每用户最多 1 个，见 5.3 部分唯一索引）；一旦输入内容即创建 note 行并把草稿关联过去，避免产生空白幽灵笔记

### 8.7 可见性修复

`NoteResponse` 补 `visibility` / `restricted_users` / `restricted_tags`，前端编辑时正确回填可见性下拉与指定用户/标签。修复「编辑他人共享笔记时可见性回退 private」的数据丢失风险。

---

## 九、迁移方案

### 9.1 Alembic 047 —— `rework_note_for_knowledge_base`

~~~
note:
  ADD COLUMN body JSONB
  ADD COLUMN plain_text TEXT
  ADD COLUMN restricted_tags JSONB
  回填：content → body（包为单一 paragraph 的 Tiptap JSON）+ plain_text
  （不 DROP content，保留一个版本周期）
note_link:
  CREATE TABLE + UNIQUE(source_id, target_id) + INDEX(target_id) + INDEX(source_id)
  回填：从现有 body/content 中无双链，空表
note_draft:
  CREATE TABLE + UNIQUE(owner_id, note_id) + 部分唯一索引 WHERE note_id IS NULL
搜索：
  CREATE EXTENSION IF NOT EXISTS pg_trgm
  CREATE INDEX ix_note_plain_text_trgm ON note USING gin (plain_text gin_trgm_ops)
~~~

### 9.2 兼容性

- `content` 列保留期间，后端读取优先 `body`、缺失时回退 `content` 包成 paragraph
- 前端完全切换后，由 048 迁移删除 `content` 列（**不在本次范围**）
- 回填脚本必须幂等：已有 `body` 的行不覆盖

---

## 十、依赖变更

`frontend/package.json` 新增（与 Tiptap 3.31.3 对齐）：

~~~
@tiptap/extension-task-list
@tiptap/extension-task-item
@tiptap/extension-table
@tiptap/extension-image
@tiptap/extension-placeholder
lowlight
highlight.js
~~~

**基定同步**：`项目基定/开发基准文档.md` 2.1 技术栈表「富文本编辑器」行已更新为本次实际启用集合（经用户授权）。`README.md` 版本徽章已更新为 2.0.0，模块表已区分「内容管理（通用内容条目）」与「知识库（知识笔记）」的边界。

---

## 十一、验收标准

1. `npx tsc -b` 零错误，`npm run build` 通过
2. 后端 `ruff` / `black` / `mypy` 通过
3. Alembic 047 迁移在空库与现有数据两种场景下均成功，回填幂等
4. 双链：插入 → 保存 → 跳转 → 反向链接面板出现该引用 → 图谱出现对应边
5. 笔记内嵌：嵌入 → 展开查看目标内容 → 目标笔记删除后显示占位 → 嵌套深度 1 层不递归
6. 全文搜索中文标题/正文/分类/标签均命中，PG 执行计划走 GIN 索引
7. 草稿：编辑 → 关闭页面 → 重开提示恢复 → 恢复后内容一致；保存后草稿清除
8. 可见性：创建 restricted 笔记并授权 → 被授权用户编辑 → 可见性不回退
9. 深浅色模式全组件正常；无 Emoji 图标；无硬编码 hex 色值（内容调色板除外）
10. `content` 模块行为无回归（编辑器迁移后 content 新增/编辑/列表正常）
11. 部署后冒烟通过（`项目文件/start.sh`）

---

## 十二、非目标与边界

见 2.2 节。特别强调：
- 本次**不改动** `content` 的数据模型、API 路由与页面行为
- 本次**不补齐** note 审计日志缺口（现状问题，建议独立排期）
- 本次**不新增**权限模型、不引入云同步或本地文件存储

---

## 十三、风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| `ContentEditor` 提升破坏 `content` 模块 | content 功能回归 | 通过 `extensions` props 隔离差异，content 传原集合；验收标准第 10 条专门覆盖 |
| Tiptap 自定义节点与 StarterKit 冲突 | 编辑器崩溃 | wikilink/note-embed/callout 均用独立 `NodeType`，不覆盖已有节点名 |
| 双链解析漏节点导致图谱缺失 | 图谱不准 | 保存时全量重建出边，不增量；测试覆盖多链/自引用/删除场景 |
| `note-embed` 无限递归 | 页面卡死 | 强制深度 1 层，展开态内不渲染内嵌节点 |
| pg_trgm 中文搜索性能 | 搜索慢 | 20 人规模数据量小；GIN 索引 + 数据量上限明确（<10 万条/年） |
| 迁移回填失败 | 数据损坏 | 回填幂等；迁移前自动备份（项目已有备份模块） |
| 三栏布局在窄屏挤压 | 可用性 | 右侧面板可折叠，预留移动端单子抽屉（不在本次范围） |

---

## 附录 A：与现有共用组件计划的关系

《共用组件抽取与推广计划》已确立「共用组件放 `components/`、调用方只传最小 props、支持 props 定制差异」的模式。本次 `ContentEditor` 提升为该模式的跨模块推广（content → notes），沿用同一约定。

## 附录 B：待独立排期的现状缺口

1. `note` 服务层 CRUD 未写审计日志，而基定安全约束要求审计日志只增不改不删
2. `README.md` 版本徽章已从 1.0.1 修正为 2.0.0（本次已完成）
