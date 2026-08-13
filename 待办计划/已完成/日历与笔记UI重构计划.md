# calendar-notes-ui-redesign - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** 日历页面升级为支持月/周/日三种视图切换的专业日历（使用 FullCalendar 库），新建事件时可设置结束时间、全天、地点和颜色；笔记知识库从平面表格列表改为 Notion 式的左侧树形目录 + 右侧内容预览布局，支持任意深度嵌套和拖拽移动。

**Why this approach:** 日历选择 FullCalendar 是因为开箱即用的多视图功能远超手工实现，省去自研周/日视图逻辑；笔记选择后端加 parent_id 的真正层级树，因为 category 字符串分组只有两层且无法表达知识库的真实结构，层级树才能满足任意深度嵌套需求。

**What it will NOT do:** 不实现事件拖拽调整时间（留后续）、不实现笔记富文本编辑器（保持现有 textarea）、不修改其他页面、不引入 FullCalendar 付费插件。

**Effort:** Medium
**Risk:** Medium — FullCalendar 依赖增加约 200KB+ 前端包体积，笔记数据库迁移需处理现有数据（parent_id 默认 null = 根节点，安全）
**Decisions to sanity-check:** FullCalendar 主题适配是否与现有明暗主题一致；笔记树构建在前端完成（一次性加载所有笔记）是否满足 20 人团队的性能需求

Your next move: 批准后执行 `$start-work`，或先运行高精度 Momus 审查。Full execution detail follows below.

---

> TL;DR (machine): Medium effort, Medium risk — FullCalendar 多视图日历 + parent_id 层级树笔记知识库，6 个 todo 分 4 个 wave

## Scope
### Must have
1. **日历多视图**：引入 FullCalendar 库，支持月/周/日三种视图切换，替换现有自定义 CSS Grid 月视图
2. **日历字段利用**：前端表单支持 end_time、all_day、location、color 字段（后端已有但前端未使用）
3. **笔记树形化后端**：Note 模型添加 parent_id 字段 + Alembic 数据库迁移 + API 支持 move 操作
4. **笔记树形化前端**：NoteManagement 重构为左侧 Ant Design Tree + 右侧内容预览的 Notion 式布局，支持任意深度嵌套

### Must NOT have (guardrails, anti-slop, scope boundaries)
- 不修改其他页面（仅 calendar/ 和 notes/ 目录）
- 不重构后端认证/权限系统
- 不改变现有 API 统一响应格式 `{ code, msg, data }`
- 不删除现有 category/tags 字段（保持向后兼容）
- 不引入 FullCalendar Premium 付费插件
- 不实现拖拽调整事件时间（本次仅多视图切换 + 字段完善，拖拽留后续）
- 不实现笔记富文本编辑器（本次仅树形结构布局，内容编辑保持现有 textarea）

## Verification strategy
> Agent-executed verification where possible (build + deploy + curl API checks). Browser UI verification via Playwright screenshots or manual spot-check after deployment.
- Test decision: tests-after（UI 重构 + DB 迁移，主要靠构建+部署+API验证+浏览器截图）
- Evidence: .omo/evidence/task-<N>-calendar-notes-ui-redesign.<ext>
- 验证方式：前端 `npm run build` 成功 + Docker 全量部署 + `curl /api/v1/health` 返回 healthy + curl API 端点验证 + 浏览器截图验证 UI

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means under-split.

- **Wave 1**（并行，无依赖）：Todo 1（后端 Note 模型+迁移）+ Todo 2（前端安装 FullCalendar）
- **Wave 2**（并行，依赖 Wave 1）：Todo 3（后端 schema/API/service 树形支持）+ Todo 4（前端 CalendarPage FullCalendar 重构）
- **Wave 3**（依赖 Wave 2）：Todo 5（前端 NoteManagement 树形重构）
- **Wave 4**（依赖 Wave 3）：Todo 6（构建部署验证 + 日志）

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1. 后端 Note 模型+迁移 | — | 3, 5 | 2 |
| 2. 前端安装 FullCalendar | — | 4 | 1 |
| 3. 后端 schema/API/service 树形 | 1 | 5 | 4 |
| 4. 前端 CalendarPage FullCalendar | 2 | 6 | 3 |
| 5. 前端 NoteManagement 树形重构 | 3 | 6 | — |
| 6. 构建部署验证+日志 | 4, 5 | — | — |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

- [ ] 1. 后端 Note 模型添加 parent_id + Alembic 数据库迁移
  What to do / Must NOT do: 在 `backend/app/models/note.py` 的 Note 类中添加 `parent_id: Mapped[uuid.UUID | None]` 字段，使用 self-referential ForeignKey 指向 `note.id`，nullable=True（根节点为 null），`ondelete="SET NULL"`（删除父节点时子节点变为根节点）。添加 relationship `children`（`foreign_keys=[parent_id]`）。创建新的 Alembic 迁移文件添加 parent_id 列。Must NOT: 不删除现有 category/tags 字段，不改变其他字段。
  Parallelization: Wave 1 | Blocked by: — | Blocks: 3, 5
  References (executor has NO interview context):
    - `项目文件/backend/app/models/note.py` (34行) — 现有 Note 模型，需添加 parent_id 字段
    - `项目文件/backend/alembic/versions/010_create_module_tables.py` (186行) — 现有迁移参考格式
    - `项目文件/backend/app/core/database.py` — Base 定义
    - Self-referential FK pattern: `ForeignKey("note.id", ondelete="SET NULL", use_alter=True, name="fk_note_parent")`
    - Relationship: `children: Mapped[list["Note"]] = relationship("Note", foreign_keys=[parent_id], back_populates="parent")` + `parent: Mapped["Note | None"] = relationship("Note", foreign_keys=[parent_id], back_populates="children", remote_side="Note.id")`
  Acceptance criteria (agent-executable):
    - `cd 项目文件/backend && alembic upgrade head` 成功
    - `psql -U workbench -d unified_workbench -c "\d note"` 显示 parent_id 列存在且可为 NULL
  QA scenarios: happy = alembic upgrade head 成功 + 列存在；failure = 降级测试 `alembic downgrade -1` 成功移除列。Evidence .omo/evidence/task-1-calendar-notes-ui-redesign.txt
  Commit: Y | feat(notes): Note模型添加parent_id支持树形层级

- [ ] 2. 前端安装 FullCalendar 依赖
  What to do / Must NOT do: 在 `项目文件/frontend/` 安装 FullCalendar React 包及插件：`@fullcalendar/core`、`@fullcalendar/react`、`@fullcalendar/daygrid`（月视图）、`@fullcalendar/timegrid`（周/日视图）、`@fullcalendar/interaction`（点击交互）。不安装 Premium 付费插件。运行 `npm install` 更新 package.json 和 package-lock.json。
  Parallelization: Wave 1 | Blocked by: — | Blocks: 4
  References:
    - `项目文件/frontend/package.json` — 需添加依赖
    - FullCalendar React 文档: https://fullcalendar.io/docs/react
    - 已确认现有技术栈: React 18 + TypeScript 5 + Ant Design 5 + Vite 6
  Acceptance criteria:
    - `cd 项目文件/frontend && npm ls @fullcalendar/core @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction` 全部显示版本号
    - `cd 项目文件/frontend && npx vite build` 成功（验证 FullCalendar CSS 能被 Vite 6 正确打包，不依赖 tsc）
  QA scenarios: happy = 依赖安装成功 + vite build 通过（FullCalendar CSS 兼容性验证）；failure = 如果 vite build 报 CSS 导入错误，检查 FullCalendar 版本是否为 v6+。Evidence .omo/evidence/task-2-calendar-notes-ui-redesign.txt
  Commit: Y | chore(calendar): 引入FullCalendar依赖

- [ ] 3. 后端 Note schema/API/service 树形支持
  What to do / Must NOT do:
    - `schemas/note.py`: NoteCreate 和 NoteUpdate 添加 `parent_id: uuid.UUID | None = None`；NoteResponse 添加 `parent_id: uuid.UUID | None`；新增 `NoteMove(BaseModel): parent_id: uuid.UUID | None`
    - `services/note.py`: 
      - `create_note` 函数在 `Note(...)` 构造中增加 `parent_id=request.parent_id`，并校验 parent_id 存在且属于当前用户（如传入不存在的 parent_id 返回 400）
      - `list_notes` 增加可选 `parent_id` 过滤参数
      - 新增 `list_all_notes(db, owner_id)` 函数：不分页返回当前用户所有笔记（供前端构建完整树），包含 parent_id 字段
      - 新增 `move_note(db, note_id, owner_id, parent_id)` 函数：修改 parent_id，检查循环引用（新 parent 不能是自己或自己的子孙）
    - `api/notes.py`: 
      - `list_notes_endpoint` 签名增加 `parent_id: uuid.UUID | None = Query(None)` 并传递给 `list_notes()`
      - 新增 `GET /notes/all` 端点：不分页返回当前用户所有笔记（调用 `list_all_notes`），用于前端树构建
      - 新增 `PUT /notes/{note_id}/move` 端点：接收 NoteMove body，调用 move_note
    - Must NOT: 不改变现有 CRUD 端点路径，不删除 category/tags 相关逻辑，不改变现有分页端点的分页行为
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 5
  References:
    - `项目文件/backend/app/schemas/note.py` (43行) — 现有 schema，需扩展
    - `项目文件/backend/app/api/notes.py` (80行) — 现有 API 路由，list_notes_endpoint 签名在第19行左右
    - `项目文件/backend/app/services/note.py` (65行) — 现有 service 层，create_note 在第33行左右
    - `项目文件/backend/app/api/router.py` — 路由注册（notes 已在 prefix="/notes"）
    - 循环引用检查：递归查询目标 parent 的所有祖先 id，如果包含 note_id 则拒绝
  Acceptance criteria:
    - `curl -X PUT http://localhost/api/v1/notes/{id}/move -H "Authorization: Bearer {token}" -d '{"parent_id":"{uuid}"}'` 返回 code:0
    - `curl http://localhost/api/v1/notes/all` 返回当前用户所有笔记（不分页），items 包含 parent_id 字段
    - `curl http://localhost/api/v1/notes/?page=1&page_size=100` 返回的 items 包含 parent_id 字段
    - 循环引用检查：把节点移动到自己的子节点下时返回 400 错误
    - 创建笔记时传入 parent_id，数据库中 parent_id 正确写入
  QA scenarios: happy = move 端点成功 + /notes/all 返回全量 + create 传入 parent_id 正确；failure = 循环引用被拒绝(400) + parent_id 不存在被拒绝(400)。Evidence .omo/evidence/task-3-calendar-notes-ui-redesign.txt
  Commit: Y | feat(notes): API支持树形move操作、全量查询和parent_id

- [ ] 4. 前端 CalendarPage FullCalendar 重构
  What to do / Must NOT do: 完全重写 `CalendarPage.tsx`，使用 FullCalendar 替换自定义 CSS Grid：
    - 引入 `@fullcalendar/react` 的 `<FullCalendar>` 组件
    - **CSS 导入（必需）**: `import '@fullcalendar/common/main.css'`（v6: `import '@fullcalendar/core/index.css'`）、`import '@fullcalendar/daygrid/index.css'`、`import '@fullcalendar/timegrid/index.css'`
    - 插件: `dayGridMonth`（月视图）、`timeGridWeek`（周视图）、`timeGridDay`（日视图）
    - **locale 配置**: `locale: 'zh-cn'`（必须配置，否则日历显示英文），导入 `@fullcalendar/core/locales/zh-cn`
    - headerToolbar 配置: `left: 'prev,next today'`, `center: 'title'`, `right: 'dayGridMonth,timeGridWeek,timeGridDay'`
    - **事件数据获取**: 使用 `events` 回调函数动态获取，不是静态数组赋值。模式: `events={async (info, successCallback, failureCallback) => { const res = await listCalendarEvents({ start_date: info.startStr.split('T')[0], end_date: info.endStr.split('T')[0], page_size: 100 }); successCallback(res.data.items.map(e => ({ id: e.id, title: e.title, start: e.start_time, end: e.end_time, allDay: e.all_day, backgroundColor: e.color || '#1677ff' }))); }}` — 这样切换视图时自动获取新日期范围的数据
    - 事件点击: 打开编辑 Modal
    - 日期点击/选择: 打开新建 Modal
    - 新建/编辑表单: 添加 end_time、all_day（Switch）、location（Input）、color（Ant Design ColorPicker 或 `<input type="color">`）输入字段
    - 适配明暗主题: 通过 CSS 变量覆盖 FullCalendar 默认样式（`--fc-border-color`, `--fc-page-bg-color` 等）
    - **清理废弃 CSS**: 删除 `CalendarPage.module.css` 中不再使用的 CSS Grid 规则（day/emptyDay/today/selected/dayNumber/dayEvents/eventDot/moreEvents/weekdays/weekday/days），保留 container/header 相关样式
    - Must NOT: 不实现拖拽调整（dragResize/dragDrop 留后续），不删除现有 API 调用函数
  Parallelization: Wave 2 | Blocked by: 2 | Blocks: 6
  References:
    - `项目文件/frontend/src/pages/calendar/CalendarPage.tsx` (203行) — 现有实现，需完全重写
    - `项目文件/frontend/src/pages/calendar/CalendarPage.module.css` (192行) — 需清理废弃 CSS Grid 规则，保留 container/header
    - `项目文件/frontend/src/api/calendar.ts` (34行) — 现有 API 函数，保持不变
    - `项目文件/frontend/src/types/calendar.ts` (43行) — 现有类型，CalendarEvent 已有 end_time/all_day/location/color
    - FullCalendar React 文档: https://fullcalendar.io/docs/react
    - FullCalendar 事件回调: https://fullcalendar.io/docs/events-function
    - FullCalendar locale: https://fullcalendar.io/docs/locale
    - FullCalendar 主题 CSS 变量: https://fullcalendar.io/docs/css-customization
  Acceptance criteria:
    - `npm run build` 成功
    - 页面显示 FullCalendar 日历组件，有月/周/日三个视图切换按钮，语言为中文（zh-cn）
    - 事件正确显示在日历上（通过 events 回调从 API 动态加载）
    - 切换视图时自动获取新日期范围的事件数据
    - 点击日期可新建事件，点击事件可编辑
    - 新建/编辑表单包含 end_time、all_day、location、color 字段
    - 事件颜色在 FullCalendar 中正确渲染（backgroundColor 映射）
    - 明暗主题切换后 FullCalendar 样式正确
  QA scenarios: happy = 浏览器截图显示三种视图 + 事件渲染正确 + 中文界面；failure = 构建失败时检查 TypeScript 类型匹配和 CSS 导入路径。Evidence .omo/evidence/task-4-calendar-notes-ui-redesign.png
  Commit: Y | feat(calendar): 使用FullCalendar重构日历，支持月/周/日多视图

- [ ] 5. 前端 NoteManagement 树形重构
  What to do / Must NOT do: 完全重写 `NoteManagement.tsx` 为 Notion 式树形布局：
    - 左侧: Ant Design `<Tree>` 组件展示笔记树形结构，支持展开/折叠，右键菜单（新建子笔记、删除、重命名）
    - 右侧: 选中笔记后显示内容预览区（标题 + content + 标签 + 更新时间 + 编辑/删除按钮）
    - 数据: 调用 `GET /notes/all`（Todo 3 新增的不分页端点）一次加载所有笔记，前端用 parent_id 构建树结构
    - 树构建函数: `buildTree(notes: Note[]): TreeNode[]` — 按 parent_id 分组，根节点为 parent_id=null
    - 新建笔记时可选父节点（在 Tree 选中节点下新建子笔记，create 请求传入 parent_id）
    - 移动节点: 拖拽 Tree 节点调用 `moveNote(id, newParentId)` API（Ant Design Tree 支持 draggable）
    - **拖拽失败回滚**: `onDrop` 失败时调用 `fetchAllNotes()` 重新构建树恢复正确状态，用 `message.error("移动失败: 不能移动到子节点下")` 提示
    - 顶部工具栏: 搜索框 + 新建根笔记按钮 + 分类筛选下拉框（保留现有 category 筛选能力）
    - `types/note.ts`: Note 接口添加 `parent_id: string | null`（null 表示根节点）；新增 `NoteMove { parent_id: string | null }` 接口和 `TreeNode` 类型（`{ key: string; title: string; children?: TreeNode[]; note: Note }`）
    - `api/notes.ts`: 新增 `moveNote(id, parentId)` 函数（PUT /notes/{id}/move，body: { parent_id }）和 `listAllNotes()` 函数（GET /notes/all）
    - `NoteManagement.module.css`: 新增左右分栏布局样式（左侧树 width:280px，右侧 flex:1）
    - 空状态: 没有任何笔记时显示引导提示"点击右上角新建笔记开始"
    - Must NOT: 不实现富文本编辑器（保持 textarea），不删除现有 is_pinned/category/tags 功能
  Parallelization: Wave 3 | Blocked by: 3 | Blocks: 6
  References:
    - `项目文件/frontend/src/pages/notes/NoteManagement.tsx` (89行) — 现有实现，需完全重写
    - `项目文件/frontend/src/pages/notes/NoteManagement.module.css` (11行) — 现有样式，需大幅扩展
    - `项目文件/frontend/src/types/note.ts` (32行) — 需添加 parent_id、NoteMove 和 TreeNode
    - `项目文件/frontend/src/api/notes.ts` (29行) — 需添加 moveNote 和 listAllNotes 函数
    - Ant Design Tree 文档: https://ant.design/components/tree-cn
    - Ant Design Tree draggable: https://ant.design/components/tree-cn#components-tree-demo-draggable
    - `项目文件/frontend/src/config/routeTitles.ts` — 确认标题"笔记知识库"不变
  Acceptance criteria:
    - `npm run build` 成功
    - 页面显示左侧树形结构 + 右侧内容预览的左右分栏布局
    - 树节点可展开/折叠
    - 点击树节点右侧显示该笔记内容
    - 可新建根笔记和子笔记（create 请求传入 parent_id）
    - 可拖拽移动节点（调用 move API）
    - 拖拽到非法位置（自己子节点）时显示错误提示并回滚树状态
    - 空状态正确显示引导提示
  QA scenarios: happy = 浏览器截图显示树形布局 + 拖拽移动成功；failure = 拖拽到非法位置被后端拒绝 + 树状态回滚 + 错误提示。Evidence .omo/evidence/task-5-calendar-notes-ui-redesign.png
  Commit: Y | feat(notes): 笔记知识库重构为Notion式树形布局

- [ ] 6. 构建部署验证 + 开发日志
  What to do / Must NOT do: 全量构建 + Docker 部署 + 健康检查 + API 验证 + 浏览器截图验证两个页面 + 写开发日志 + Git 提交
  Parallelization: Wave 4 | Blocked by: 4, 5 | Blocks: —
  References:
    - `项目文件/frontend/` — `npm run build` 构建前端
    - `项目文件/docker-compose.yml` — Docker 部署配置
    - `项目基定/项目开发日志格式.md` — 日志格式模板
    - 日志编号: 009（上一个为 008）
  Acceptance criteria:
    - `cd 项目文件/frontend && npm run build` 成功（无新增错误）
    - `cd 项目文件 && docker compose -p unified-workbench up -d --build` 成功
    - `curl http://localhost/api/v1/health` 返回 `{"status":"healthy"}`
    - `curl http://localhost/api/v1/notes/all -H "Authorization: Bearer {token}"` 返回笔记列表含 parent_id
    - `curl http://localhost/api/v1/calendar/?start_date=2026-06-01&end_date=2026-06-30 -H "Authorization: Bearer {token}"` 返回日历事件
    - 浏览器访问 /calendar 显示 FullCalendar 多视图日历（截图）
    - 浏览器访问 /notes 显示树形结构笔记知识库（截图）
    - 开发日志已写入 `项目开发日志/日志编号_20260622009_日历笔记UI重设计.md`
  QA scenarios: happy = 全部构建部署成功 + API 返回正确 + 两个页面功能正常；failure = 构建失败时检查 TypeScript 类型错误。Evidence .omo/evidence/task-6-calendar-notes-ui-redesign.txt
  Commit: Y | chore: 构建部署验证日历和笔记UI重设计

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit — 检查所有 todo 是否按计划完成，无遗漏
- [ ] F2. Code quality review — 检查代码质量（TypeScript 类型安全、无 any、组件拆分合理）
- [ ] F3. Real browser QA — 浏览器访问 /calendar 和 /notes，截图验证 FullCalendar 多视图和树形布局功能
- [ ] F4. Scope fidelity — 确认未超出 scope（未修改其他页面、未引入付费插件）

## Commit strategy
- 每个 todo 独立提交，使用 conventional commits 格式
- 提交顺序: Todo 1 → Todo 2 → Todo 3 → Todo 4 → Todo 5 → Todo 6
- 最后一个提交包含开发日志

## Success criteria
1. 日历页面支持月/周/日三种视图切换（FullCalendar）
2. 日历新建/编辑表单包含 end_time、all_day、location、color 字段
3. 笔记知识库显示为左侧树形结构 + 右侧内容预览的 Notion 式布局
4. 笔记支持任意深度嵌套（parent_id 层级树）
5. 笔记支持拖拽移动节点
6. 前端构建成功 + Docker 部署成功 + 后端健康
