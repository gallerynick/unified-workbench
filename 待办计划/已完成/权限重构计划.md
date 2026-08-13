# permission-refactor - Work Plan

## TL;DR (For humans)

**What you'll get:** 全系统权限模型标准化——每个模块有明确的可见性规则（公有/私有/指定成员）和管理规则（创建者/指定成员/管理员），管理员不再一刀切，而是按模块差异化。同时新增成员目录页（公开，展示所有成员基本信息）。

**Why this approach:** 各模块业务属性不同（财务数据 privacy-heavy，拓扑图可团队共享，提醒纯个人），一刀切的 admin 全权管理模式已不适用。沿用现有 Visibility 枚举（public/private/restricted）+ restrictions(restricted_users JSONB) 最小改动落地全部差异化规则。

**What it will NOT do:** 不引入新权限枚举、不改变 API 路径、不删除已有功能、不影响 file_share 公开链接、不管理成员头像上传/个人编辑。

**Effort:** Large（~40 文件，10+ 模块改 visibility + 5 模块改 admin + 1 新成员目录页）
**Risk:** Medium — 大量模型/迁移改动，但逻辑均为既有的 visibility pattern
**Decisions to sanity-check:** 管理员管理范围按模块区分（非全局 all-powerful），成员可以在 limited_users 中获得管理权限，财务仅有 public/private（无 restricted），公告保持现状

Your next move: approve（批准后由 Sisyphus 执行）。Full execution detail follows below.

---

> TL;DR (machine): Large, ~40 files, 10+ modules add visibility + 5 adjust admin rules + 1 new member directory page

## Scope
### Must have
- Inventory/Contact/Task/Calendar/Note/Project/Topology: 加三态 visibility（public/private/restricted）+ restricted_users JSONB + admin only manages own+designated
- Content/Record/Vote/Form/Reminder: 已有 visibility 或纯私有，仅改 admin 管理规则
- Finance(Budget+Subscription): 加两态 visibility（public/private，无 restricted）
- Server: admin 全权 + maintainers 可管理
- StreamRoom: admin 可管理任意直播间 + takeover 仅创建者或管理员
- FileShare: admin 无附加权限（现有一致，不需改）
- Announcement: 保持现状
- Secret/Notes: 已有三态 visibility，admin 仅管理 own+designated
- 成员目录: 新页面，所有人可见成员列表 + 点击成员出现简介页（昵称/用户名/头像/角色/邮箱/简介）
- system.py: 全部端点 require_admin
- Project: 加 member_ids JSONB 字段
- 前端: 10+ 模块加 visibility 选择器（组件 VisibilitySetting 复用）
- 前端: StreamRoom 管理面板（admin 删除/踢人）

### Must NOT have (guardrails, anti-slop, scope boundaries)
- 不删已有 API 端点
- 不改变 API 路径
- 不修改 file_share 公开链接逻辑
- 不删除已有数据（visibility 默认值 private，不改变现有访问行为）
- 不引入新 Python/JS 依赖
- 不改用户管理/角色管理功能
- 不改 Sidebar 配置

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after（后端 py_compile + curl 冒烟，前端 tsc+build）
- Evidence: .omo/evidence/task-<N>-permission-refactor.<ext>

## Execution strategy
### Parallel execution waves
Wave 1（6 parallel）：Migration 024 + 模型 batch 1-3 + API system.py + StreamRoom + Project + 前端 member directory
Wave 2（3 parallel）：前端 Service 层 admin 检查 + 前端 visibility 选择器 + build
Wave 3（验证）：py_compile + alembic + tsc + build + deploy + curl

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| T1 migration 024 | — | T2-T3 | T4,T5,T6 |
| T2 模型 visibility 字段 | T1 | T7-T8 | T3 |
| T3 模型 project member_ids | — | T8 | T1,T2 |
| T4 system.py admin | — | — | T1,T5,T6 |
| T5 stream_room admin | — | T10 | T1,T4,T6 |
| T6 成员目录页 | — | — | T1,T4,T5 |
| T7 service 层 admin 检查 | T2 | T8 | — |
| T8 API 层 response | T7 | T9 | — |
| T9 前端 visibility 选择器 | T8 | T10 | — |
| T10 前端 StreamRoom 管理 | T5,T9 | — | — |

## Todos

- [ ] T1. DB 迁移 024
  What to do: 创建迁移文件 `024_add_visibility_to_ten_tables.py`，向以下表添加 visibility VARCHAR(20) DEFAULT 'private' NOT NULL + restricted_users JSONB DEFAULT '[]'::jsonb 字段：
  inventory, contacts, budget, subscription, tasks, notes, calendar_events, secrets, secret_categories, templates, reminders。再为 project_document 表添加 member_ids JSONB DEFAULT '[]'::jsonb。表名精确匹配 __tablename__ 实际值。
  Must NOT do: 不改已有模块表（content/file/folder/form/vote/topology）、不删字段、不添加 restricted_tags。
  Parallelization: Wave 1 | Blocked by: — | Blocks: T2,T3
  References: backend/alembic/versions/022_server_unified_refactor.py（迁移编号模式），backend/app/models/inventory.py（Inventory 表名 __tablename__），其余 9 个模型文件
  Acceptance criteria: `alembic upgrade head` 无错误，downgrade -1 成功回退
  QA: `alembic upgrade head; alembic downgrade -1; alembic upgrade head` — 全部 exit 0
  Commit: Y | feat(db): 10 模块加 visibility + project_document 加 member_ids

- [ ] T2. 10 个模型加 visibility 字段
  What to do: 为以下 10 个模型文件各添加：
  `visibility: Mapped[Visibility] = mapped_column(String(20), server_default="private")`
  `restricted_users: Mapped[list | None] = mapped_column(JSONB, default=list)`
  `from app.core.visibility import Visibility` 导入。
  文件列表：models/inventory.py, models/contact.py, models/budget.py, models/subscription.py, models/task.py, models/note.py, models/calendar_event.py, models/secret.py, models/secret_category.py, models/template.py, models/reminder.py。
  Must NOT do: 不加 restricted_tags、不改已有字段、不在 content/record/form/vote/topology/file_share 改 visibility。
  Parallelization: Wave 1 | Blocked by: T1 | Blocks: T7
  References: models/content.py:29-35（字段模式），models/file.py（已有 visibility 的模型参考）
  Acceptance criteria: `py_compile` 全部 10 文件通过
  QA: `python3 -m py_compile <each_file>` exit 0
  Commit: Y | feat(model): 10 模块加 visibility 字段

- [ ] T3. Project 模型加 member_ids
  What to do: project.py 加 `member_ids: Mapped[list | None] = mapped_column(JSONB, default=list)`，默认空列表。不需要加 restricted_users/visibility（已通过 T2 覆盖）。
  Must NOT do: 不新建独立 member 关联表、不改 project 已有字段。
  Parallelization: Wave 1 | Blocked by: — | Blocks: T10
  References: models/project.py
  Acceptance criteria: py_compile project.py 通过
  QA: `python3 -m py_compile app/models/project.py` exit 0
  Commit: Y | feat(model): Project 加 member_ids JSONB 字段

- [ ] T4. system.py 全部端点加 require_admin
  What to do: system.py 中 6 个端点添加 `require_admin` 依赖（check-update/repo GET+PUT/token GET+PUT/reset/test-notification）。import: `from app.core.deps import require_admin`。修改后所有端点均需 admin 角色。
  Must NOT do: 不改 sys_prefix 路径、不删端点、不改返回结构。
  Parallelization: Wave 1 | Blocked by: — | Blocks: —
  References: api/system.py, api/tags.py（admin 端点模式）
  Acceptance criteria: py_compile 通过；未认证请求 401，非 admin 请求 403
  QA: curl POST without token → 401；curl with member token → 403
  Commit: Y | fix(api): system.py require_admin 所有端点

- [ ] T5. StreamRoom admin 权限 + takeover 仅创建者/admin
  What to do: services/stream_room.py 中以下函数加 admin 检查或过滤：
  - list_rooms: 保持所有人可见（不更改）
  - get_room/get_room_status: 保持所有人可见
  - delete_room: 加 admin 检查（`if room.creator_id != user_id AND role != ADMIN → 403`）
  - takeover_room: 加 admin 检查（同上）
  - force_kick: 新加端点或加到 takeover（admin 可踢人，creator 可踢人）
  - kick_user: 已有（host 可踢观众）
  - sync_room_active_status: admin 可强制关闭不活跃房间
  api/stream_room.py 端点 register/start/stop 保持不变。
  注意：UserRole 枚举在 models/user.py — admin 判断 `UserRole.ADMIN`。
  Must NOT do: 不限制 list/get 的可见性、不改变推流逻辑。
  Parallelization: Wave 1 | Blocked by: — | Blocks: T10
  References: services/stream_room.py, models/user.py（UserRole 枚举）
  Acceptance criteria: member 不能删他人房间/takeover；admin 可以
  QA: curl 测试 — member token DELETE 他人房间 → 403；admin token → 200
  Commit: Y | fix(stream): admin 可管理任意直播间 + takeover 限制

- [ ] T6. 成员目录页（新功能）
  What to do: 新建 frontend 页面 `frontend/src/pages/members/MemberDirectory.tsx` + `.module.css`。
  - 获取所有成员列表（GET /api/v1/users，需用户列表端点已存在）
  - 卡片网格展示（头像/昵称/用户名/角色标签）+ 点击卡片 → modal 显示简介页
  - 简介 modal：头像（AntAvatar）/昵称/用户名/角色(colorful tag)/邮箱/简介
  - 路由： `/members`（AuthGuard 内，所有登录用户可访问）
  - 侧边栏：SidebarManagement DEFAULT_ITEMS 加 `{key:'/members', label:'成员目录', icon:'TeamOutlined', visible:true}` + MainLayout ICON_MAP 注册 TeamOutlined
  - routeTitles.ts 加 `'/members': '成员目录'`
  Must NOT do: 不做搜索/筛选/pagination 第一版（用 listUsers 全量），不做私信/联系功能，不用系统设置的用户管理页替代。
  Parallelization: Wave 1 | Blocked by: — | Blocks: —
  References: frontend/src/pages/servers/ServerManagement.tsx（卡片网格参考），frontend/src/types/user.ts（User 类型），frontend/src/api/users.ts（listUsers）
  Acceptance criteria: tsc -b + build 通过，/members 页面渲染列表
  QA: Playwright 打开 /members → 成员卡片渲染 → 点击用户 → Modal 显示简介
  Commit: Y | feat(page): 新增成员目录页 + 侧边栏注册

- [ ] T7. 10 模块 Service 层加 visibility 管理逻辑
  What to do: services/ 下的 10 个模块（inventory/contact/budget/subscription/task/note/calendar_event/secret/secret_category/template/reminder）更新：
  - list: 放弃纯 owner 过滤，改为调用 `services/visibility.py` 的 `check_visibility(model_cls, user_id)` 生成 OR 条件（如已有此法，确认已使用）
  - list: 对于 admin，按模块规则过滤（如 inventory admin see=public，则额外加 `visibility == PUBLIC` 条件；或 admin 不加额外过滤直接按 visibility 规则）
  - get: 放弃纯 `owner_id == user_id` 或 `404`，改为：
    * 若 owner → 允许
    * 若 visibility == PUBLIC → 允许
    * 若 visibility == RESTRICTED → 允许（只要 restricted_users 含 user_id）  
    * 否则 403 禁止
  - update/delete: 若 owner → 允许。对于 admin，按模块 rule 判断（如 inventory admin manage=own+designated，则 admin manage CONDITION: `if role == ADMIN AND (owner_id == user_id OR restricted_users 含 user_id)` 则允许，否则 403）
  - create: 不用改（owner 自动设 visibility 默认 private）
  
  规则速查表（Service 层实现依据）：
  | 模块 | visibility | Admin 可见 | Admin 管理 |
  |------|-----------|-----------|-----------|
  | inventory | public/private/restricted | public | own+designated |
  | contact | public/private/restricted | public | own+designated |
  | budget | public/private | public | public |
  | subscription | public/private | public | public |
  | task | public/private/restricted | public | own |
  | note | public/private/restricted | public | own+designated |
  | calendar_event | public/private/restricted | public | own+designated |
  | secret | public/private/restricted | public | own+designated |
  | secret_category | public/private/restricted | public | own+designated |
  | template | public/private/restricted | public | own+designated |
  | reminder | N/A（纯私有） | N/A | own |

  对于 Finance（budget + subscription）：admin see=public，admin manage=public（可管理所有 public 数据，private 完全不可见也不可管）。
  对于 Reminder：整个模块纯私有，creators 只 manage 自己的。Admin 无附加权限。
  
  管理员判断：`UserRole.ADMIN` 枚举值。
  Must NOT do: 不改 create 逻辑、不引入新过滤函数（复用 visibility.py）、不删除已有数据、不影响 public/公开路由。
  Parallelization: Wave 1 | Blocked by: T2 | Blocks: T8
  References: services/visibility.py（check_visibility 签名），services/inventory.py（已有服务参考），models/user.py（UserRole）
  Acceptance criteria: py_compile 全部 10 服务文件通过
  QA: `python3 -m py_compile <each service file>` exit 0
  Commit: Y | feat(service): 10 模块 service 层加 visibility 管理逻辑

- [ ] T8. Content/Record/Vote/Form 服务层 admin 规则调整
  What to do: services/content.py, services/record.py, services/vote.py, services/form.py 更新 delete 逻辑：
  - Content: 当前 delete 为 `owner_or_admin`（admin 可删所有人 content）。根据用户规格，应改为 `owner_or_designated`（admin 仅管理 own + designated）。修改 `services/content.py` delete 函数。
  - Record: 同 Content，改为 `owner_or_designated`。
  - Vote: 当前 delete 仅 owner。根据用户规格，admin manage=all，改为 `owner_or_admin`（与现有 content 同理，反向变更）。
  - Form: 同 Vote，改为 `owner_or_admin`。

  注意：user spec 中 Content admin manage=own+designated（admin 只能删自己的或自己被指定的 content），这意味着 admin 失去全权管理 content 的能力。Record 同理。但 Vote/Form 相反（admin 获得全权管理能力）。
  
  Must NOT do: 不改 list/get 逻辑（已有 visibility 过滤）、不改 create。
  Parallelization: Wave 2 | Blocked by: — | Blocks: —
  References: services/content.py（delete 函数），services/vote.py（delete 函数），core/permissions.py（check_visibility owner_or_admin 参考）
  Acceptance criteria: py_compile 全部 4 文件通过
  QA: `python3 -m py_compile app/services/content.py record.py vote.py form.py` exit 0
  Commit: Y | fix(service): Content/Record/Vote/Form 删除规则与权限规格对齐

- [ ] T9. Server 维护人员权限
  What to do: services/server.py update/delete/get 函数改为：
  - `if server.owner_id == user_id` → 允许
  - `if role == ADMIN` → 允许
  - `if maintainer_ids contains user_id` → 允许
  - 否则 403
  Must NOT do: 不改 list（保持所有人可见）、不改 create。
  Parallelization: Wave 2 | Blocked by: — | Blocks: —
  References: services/server.py
  Acceptance criteria: maintainer 可以管理服务器（含部署状态变更）
  QA: curl maintainer token → 访问 server 资源 → 200（非 owner 但 maintainer）
  Commit: Y | feat(server): maintainer_ids 成员可管理服务器

- [ ] T10. 前端 visibility 选择器（10+ 模块）
  What to do: 为每个需加 visibility 的模块创建/更新相关表单，加入 VisibilitySetting 组件（已有共享组件，路径 `frontend/src/components/VisibilitySetting/VisibilitySetting.tsx`）。
  需修改的文件（Form 弹窗）：InventoryManagement.tsx（添加 visibility selector）、ContactManagement.tsx、TaskManagement.tsx、NoteManagement.tsx、SecretManagement.tsx、SecretCategoryPage.tsx（如果需要创建分类）、TemplateManagement.tsx、ReminderFormModal.tsx、CalendarPage.tsx（添加 visibility to event create/edit）。
  
  每个模块在新建/编辑弹窗中加 `<VisibilitySetting value={visibility} onChange={setVisibility} />`，参考 ContentForm.tsx 使用模式。
  同时 API 请求/响应类型（types/*.ts）需加 visibility 字段（T6 已处理 types，此处确认 types 完备并适配前端）。
  Must NOT do: 不进后端架构变更、不触碰 Content/Record/Vote/Form 等已有组件的 visibility。
  Parallelization: Wave 2 | Blocked by: T8 | Blocks: F2
  References: frontend/src/components/VisibilitySetting/VisibilitySetting.tsx（共享组件），frontend/src/pages/content/ContentForm.tsx（visibility 使用模式）
  Acceptance criteria: tsc -b + build 通过
  QA: Playwright 打开各管理页 → 新建/编辑弹窗 → visibility 选择器渲染
  Commit: Y | feat(frontend): 10+ 模块加 visibility 选择器

- [ ] T11. 前端 StreamRoom 管理面板
  What to do: RoomListPage.tsx（直播工作室列表）模块操作列（或单独信息行）加"管理"按钮，点击弹出 Modal 含：删除直播间/踢出用户/强制关闭按钮 + 确认提示。非管理员看到的列表无此按钮。
  Must NOT do: 不改变推流页面 UI、不修改直播间信息展示。
  Parallelization: Wave 3 | Blocked by: T5 | Blocks: F2
  References: frontend/src/pages/streaming/RoomListPage.tsx（直播列表页）
  Acceptance criteria: 管理员看到管理按钮，成员看不到
  QA: Playwright 以 admin 登录 → 直播列表 → 点击管理按钮 → Modal 弹出 → 确认 → 成功提示
  Commit: Y | feat(frontend): StreamRoom 管理面板

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE.
- [ ] F1. 后端 py_compile 全部模型/Schema/Service/API 文件 + alembic upgrade head 无错误
- [ ] F2. 前端 tsc --noEmit 零错误 + npm run build 成功
- [ ] F3. Docker 部署 7/7 健康 + curl 冒烟测试（覆盖 visibility 三态：public 可见/private 不可见/restricted 仅指定用户可见 + admin 权限差异化）
- [ ] F4. Scope 审计 — 确认无越界、无新依赖、无 Emoji

## Commit strategy
- Commit 1: feat(permission): 迁移 024 + 10 模型 visibility 字段 + project member_ids（T1+T2+T3）
- Commit 2: fix(permission): system.py admin + StreamRoom admin + Server maintainer（T4+T5+T9）
- Commit 3: feat(service): 10 模块 visibility 管理 + Content/Record/Vote/Form 规则（T7+T8）
- Commit 4: feat(frontend): 成员目录 + visibility 选择器 + StreamRoom 管理（T6+T10+T11）
- Commit 5: chore: 最终验证 F1-F4（验证记录）

## Success criteria
1. 10+ 模块新增 visibility 字段且 migration 正常 rollback
2. Admin 权限按模块规格差异化（非一刀切 all-powerful）
3. Frontend 所有管理页含 visibility 选择器
4. system.py 补 require_admin 认证
5. 成员目录页公开可访问
6. tsc 零错误 + Docker 7/7 健康 + curl 冒烟三态正确