# server-management - Work Plan

## TL;DR (For humans)

**What you'll get:** 一个完整的服务器管理模块——可以录入服务器（名称、用途、位置、IP/端口、备注、状态），每个服务器下管理多个系统，每个系统下管理多个服务，服务可以标记"为谁服务"（设备/人员/组织）。服务器分单系统/多系统两种类型，创建后不可更改；若需变更类型，需标记为"重新部署"状态。维护人员必须是工作台已有成员。

**Why this approach:** 服务目标的"设备/人员/组织"不建独立管理页（组合字段记录即可），维护人员强制关联 User 表——这是最务实的平衡：不做过度设计，但关键的人员权限不放松。单/多系统服务器的行为差异体现在 UI 层：单系统直接展示服务列表（跳过系统层级），多系统展示系统树。

**What it will NOT do:** 不管理设备/人员/组织本身（不做独立管理页），不做服务器资源监控（CPU/内存/磁盘），不做 SSH 远程连接，不做自动化部署脚本生成，不改动 Topology 模型。

**Effort:** Large（6 个 model + 前后端全链路 ~30 文件）
**Risk:** Medium — 核心 CRUD 可参考已有模块，但 Server→System→Service 三级嵌套是项目首个层级树
**Decisions to sanity-check:** 服务目标用选项 A（组合字段不建新表），server_type 创建后不可变（需变更 → 标记重新部署），单系统服务列表直接展示（无系统选择步骤），维护人员必须是工作台成员

Your next move: approve（批准后由 Sisyphus 执行）。Full execution detail follows below.

---

> TL;DR (machine): Large, Medium risk — Server/System/Service 三级 CRUD + 前端管理页列表+详情树 + Alembic 迁移 + 路由/侧边栏注册，~30 文件

## Scope
### Must have
- Server 模型：name/purpose/location/ip/port/description/notes/status/server_type(SINGLE|MULTI)/deploy_status(NORMAL|PENDING_REDEPLOY|REDEPLOYING)/owner_id/maintainer_ids
- System 模型：name/description/server_id(FK)/maintainer_ids
- Service 模型：name/description/system_id(FK)/target_type/target_name/target_ref/maintainer_ids
- 后端四层标准 CRUD（models/schemas/services/api）
- 单系统服务器：系统配置页面（设置系统名称/描述），不显示系统树
- 多系统服务器：系统树 + 自由增删系统
- server_type 创建后不可变；变更类型需标记 deploy_status = PENDING_REDEPLOY
- 维护人员必须是工作台 User 表成员，前端用用户选择器
- 前端标准管理页（Table 分页） + 服务器详情页（系统树 + 服务列表）
- Alembic 迁移 020
- 路由 /servers + /servers/:id + 嵌套 /servers/:id/systems + /systems/:id/services
### Must NOT have (guardrails, anti-slop, scope boundaries)
- 不做 Device/Personnel/Organization 独立管理页（服务目标仅组合字段记录）
- 不修改 Topology 模型（服务器管理与拓扑图独立）
- 不修改 Inventory 模型
- 不做服务器资源实时监控（CPU/内存/磁盘）
- 不做 SSH/远程连接/命令执行
- 不做自动化部署脚本生成
- 不改动基定文档
- 不引入新 npm/pip 依赖
- 不修改已有模块的路由/API

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after（后端 py_compile + API curl 冒烟，前端 tsc --noEmit + build）
- Evidence: .omo/evidence/task-<N>-server-management.<ext>

## Execution strategy
### Parallel execution waves
Wave 1（5 parallel）：DB 迁移 + 3 个模型/配置 + Schema 全量 + 3 个 Service + 3 个 API + 前端 types/API 封装
Wave 2（2 parallel）：前端管理页 + 详情页
Wave 3（1 solo）：路由注册 + 侧边栏 + routeTitles
Wave 4（验证）：后端编译 + 前端 tsc/build + Docker 部署 + curl 冒烟

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| T1 DB 迁移 | — | — | T2-T3 |
| T2 3 个模型 | — | T4-T5-T6 | T1,T3 |
| T3 Config 更新 | — | T4-T5-T6 | T1,T2 |
| T4 3 个 Schema | T2,T3 | T5-T6 | — |
| T5 3 个 Service | T2,T3,T4 | T6 | — |
| T6 3 个 API + router | T2,T3,T4,T5 | T11 | — |
| T7 前端 types | — | T9-T10 | T8 |
| T8 前端 API 封装 | — | T9-T10 | T7 |
| T9 ServerManagement 页 | T7,T8 | — | T10 |
| T10 ServerDetail 页 | T7,T8 | — | T9 |
| T11 路由+侧边栏注册 | T6,T9,T10 | — | — |
| F1-F4 验证 | ALL | — | 并行 |

## Todos
> Implementation + Test = ONE todo. Never separate.

- [x] T1. DB 迁移 — 新建 servers + systems + services 三张表（Alembic 020）
  What to do: 创建 Alembic 迁移文件 `020_create_server_tables.py`，建三张表（servers→systems FK→foreign keys），含全部字段、索引、默认值。server_type 用 SQLAlchemy Enum(SINGLE/MULTI) 不可空，deploy_status Enum(NORMAL/PENDING_REDEPLOY/REDEPLOYING) 默认 NORMAL。maintainer_ids 用 JSONB 默认 `[]`。target_type Enum(DEVICE/PERSONNEL/ORGANIZATION) 可空。
  Must NOT do: 不修改已有迁移文件，不删除已有表。
  Parallelization: Wave 1 | Blocked by: — | Blocks: —
  References: backend/alembic/versions/019_add_deleted_at_to_file_shares.py（最新迁移编号），backend/app/models/inventory.py（标准 SQLAlchemy 2.0 声明式模式）
  Acceptance criteria: `py_compile` 通过，`alembic upgrade head` 无错误，三表在 PostgreSQL 中存在。
  QA scenarios: `pytest` 迁移测试 + `psql -c "\dt servers;\dt systems;\dt services"` 确认表存在。
  Commit: Y | feat(db): 新建 servers/systems/services 三表

- [x] T2. 三个模型文件 — models/server.py + models/system.py + models/service.py
  What to do: 创建三个 SQLAlchemy 声明式模型。Server：id(UUID)/name(200)/purpose(500)/location(200)/ip(45)/port(Integer)/description(1000)/notes(1000)/status(20 默认 active)/server_type(Enum)/deploy_status(Enum 默认 NORMAL)/owner_id(FK→user)/maintainer_ids(JSONB 默认[])/created_at/updated_at。System：id/name(200)/description(1000)/server_id(FK→server CASCADE)/maintainer_ids(JSONB)/created_at/updated_at。Service：id/name(200)/description(1000)/system_id(FK→system CASCADE)/target_type(Enum 可空)/target_name(200)/target_ref(UUID 可空)/maintainer_ids(JSONB)/created_at/updated_at。更新 models/__init__.py 导出。
  Must NOT do: 不加 visibility 字段（private-only），不加 file_ids 等无关字段。
  Parallelization: Wave 1 | Blocked by: — | Blocks: T4-T5-T6
  References: backend/app/models/inventory.py（标准模型模式），backend/app/core/visibility.py（可见性枚举参考但不使用）
  Acceptance criteria: `py_compile` models/server.py/system.py/service.py 通过，models/__init__.py 正确导出。
  QA scenarios: `python -c "from app.models.server import Server; from app.models.system import System; from app.models.service import Service; print('OK')"`
  Commit: Y | feat(model): 新增 Server/System/Service 模型

- [x] T3. 配置更新 — core/config.py 加默认值 + 清理
  What to do: 无新增配置项（不需要）。如已有 MAX_* 相关配置需保持不动。
  Must NOT do: 不删已有配置。
  Parallelization: Wave 1 | Blocked by: — | Blocks: T4-T5-T6
  References: backend/app/core/config.py
  Acceptance criteria: 无需单独验证（T2 模型导入 config 正常使用）
  QA scenarios: 随 T2 QA 一并验证。
  Commit: Y | chore(config): 确认配置兼容

- [x] T4. 三个 Schema 文件 — schemas/server.py + schemas/system.py + schemas/service.py
  What to do: 每个 schema 文件含 Create/Update/Response/ListResponse 四件套。Create 含 field_validator 校验必填字段、status 枚举、server_type 枚举、deploy_status 枚举精确保留 NORMAL 拦截规则、ip 格式校验（IPv4/IPv6 可选）、port 范围 1-65535。Update 全部字段 Optional（等于客户端不传则不改）。Response 含 `ConfigDict(from_attributes=True)`，serialize maintainer_ids 为 list[str]。ListResponse 含 items: list + total: int。ServerCreateResponse 加 `system_id: UUID | None`（单系统自动创建后返回）。
  Must NOT do: 不加 visibility 字段，不加 Content 关联字段。
  Parallelization: Wave 1 | Blocked by: T2,T3 | Blocks: T5-T6
  References: backend/app/schemas/inventory.py 模式，backend/app/schemas/topology.py（topology 含 JSONB 字段）
  Acceptance criteria: `py_compile` 三个 schema 文件通过，与模型导入不冲突。
  QA scenarios: `python -c "from app.schemas.server import ServerCreate; print(ServerCreate(name='test',ip='1.1.1.1',port=80))"`
  Commit: Y | feat(schema): 新增 Server/System/Service Pydantic Schema

- [x] T5. 三个 Service 文件 — services/server.py + services/system.py + services/service.py
  What to do: 每个 service 文件提供 6 个核心函数：list_xxx（分页 + 按 owner 过滤 + total count 子查询）、get_xxx（owner 校验，403 forbidden）、create_xxx（db.add→flush→log_audit→refresh）、update_xxx（逐字段 is not None 判断 + log_audit）、delete_xxx（返回 bool）。Server service 额外：create_server 当 server_type=SINGLE 时自动创建默认 System（name=f"{server.name}-系统"），返回时附带 system_id；change_server_type 校验类型是否可改，不可改 → deploy_status=PENDING_REDEPLOY。service 的 target_type/target_name/target_ref 仅在 target_type 不为空时写入。
  Must NOT do: 不做 visibility 共享过滤（private-only），不引入外部服务调用。
  Parallelization: Wave 1 | Blocked by: T2,T3,T4 | Blocks: T6
  References: backend/app/services/inventory.py（CRUD 模式），backend/app/services/topology.py（含审计日志模式），backend/app/services/visibility.py（可见性过滤参考但不使用）
  Acceptance criteria: `py_compile` 三个 service 文件通过，无循环导入。
  QA scenarios: `python -c "from app.services.server import list_servers, create_server, get_server, update_server, delete_server; print('OK')"`
  Commit: Y | feat(service): 新增 Server/System/Service 业务层

- [x] T6. 三个 API 路由 + router 注册 — api/servers.py + api/systems.py + api/services.py
  What to do: 每个 API 文件含 APIRouter + 标准五端点（GET list/GET detail/POST create/PUT update/DELETE delete），统一 `response_model=UnifiedResponse[XxxResponse]`。Server API 包含额外端点：GET /servers/{id}/systems（获取服务器的系统列表）、PUT /servers/{id}/change-type（变更服务器类型 → 标记重新部署）、GET /servers/{id}/systems（嵌套路由）。System API 嵌套在 `/systems/` 下，含 `?server_id=` Query 过滤。Service API 嵌套在 `/services/` 下，含 `?system_id=` Query 过滤。所有端点校验 owner（非 owner 返回 403）。更新 `api/router.py` 注册三个路由（tags 中文）。
  Must NOT do: 不做公开端点（所有端点需认证）。不改变已有路由结构。
  Parallelization: Wave 1 | Blocked by: T2,T3,T4,T5 | Blocks: T11
  References: backend/app/api/inventory.py（标准五端点），backend/app/api/router.py（路由注册模式）
  Acceptance criteria: 三个 API 文件 py_compile 通过，router.py 注册无冲突。
  QA scenarios: curl POST /api/v1/servers 创建服务器 → 200 + 返回含 server_id；curl GET /api/v1/servers/ → 列表含新服务器；curl GET /api/v1/servers/{id}/systems → 单系统含默认系统
  Commit: Y | feat(api): 新增 /servers + /systems + /services 路由

- [x] T7. 前端 types — types/server.ts + types/system.ts + types/service.ts
  What to do: 创建三个类型文件。ServerRecord：全部字段 + created_at/updated_at 字符串。ServerFormValues：Create/Update 表单类型。SystemRecord + SystemFormValues。ServiceRecord（含 targetType/targetName/targetRef）+ ServiceFormValues。ServerType 枚举（'single'|'multi'），DeployStatus 枚举（'normal'|'pending_redeploy'|'redeploying'），TargetType 枚举（'device'|'personnel'|'organization'）。
  Must NOT do: 不加 file_ids/visibility 等无关字段。
  Parallelization: Wave 1 | Blocked by: — | Blocks: T9-T10
  References: frontend/src/types/inventory.ts（标准类型文件模式），frontend/src/types/file-share.ts（含枚举定义）
  Acceptance criteria: `npx tsc --noEmit` 零错误。
  QA scenarios: tsc 编译通过 + 在 T9 使用前不报类型错误。
  Commit: Y | feat(types): 新增 Server/System/Service 前端类型

- [x] T8. 前端 API 封装 — api/servers.ts + api/systems.ts + api/services.ts
  What to do: 基于 `../utils/request` 创建三个 API 文件。列表函数支持 `page/page_size/status/search` 参数。每个实体含 create/get/update/del 四个标准请求。Server API 额外含 `getServerSystems(id)` 和 `changeServerType(id, type)`。
  Must NOT do: 不引入新 HTTP 库，基于现有 request 封装。
  Parallelization: Wave 1 | Blocked by: — | Blocks: T9-T10
  References: frontend/src/api/inventory.ts（标准 API 封装），frontend/src/utils/request.ts（UnifiedResponse 泛型）
  Acceptance criteria: `npx tsc --noEmit` 零错误。
  QA scenarios: 随 T9/T10 页面的数据获取验证。
  Commit: Y | feat(api): 新增 Server/System/Service 前端 API 封装

- [x] T9. 前端 ServerManagement 列表页 — pages/servers/ServerManagement.tsx + .module.css
  What to do: 创建标准管理页。列表展示服务器（name/purpose/location/ip/port/status/server_type/deploy_status/maintainer_count/created_at），操作列含编辑/删除/进入详情。新建/编辑用 Modal Form（全部字段可填，维护人员用 Select mode="multiple" optionFilterProp="label" 从 /api/v1/users 获取成员列表）。删除用 Modal.confirm。server_type 字段在新建时可选，编辑时disabled（创建后不可改）。status 字段含 active/maintenance/retired 等预设值。
  Must NOT do: 不用 Emoji，全部用 @ant-design/icons。CSS 与 ContentManagement.module.css 同构。不做树形展示（详情页做树）。
  Parallelization: Wave 2 | Blocked by: T7,T8 | Blocks: T11
  References: frontend/src/pages/inventory/InventoryManagement.tsx（标准管理页），frontend/src/pages/file-share/FileSharePage.tsx（标准管理页）
  Acceptance criteria: `npx tsc --noEmit` 零错误，页面渲染不崩溃。
  QA scenarios: Playwright 打开 /servers → 表格渲染 → 新建服务器弹窗 → 填写必填字段 → 提交 → 列表更新。
  Commit: Y | feat(page): 新增服务器管理列表页

- [x] T10. 前端 ServerDetail 详情页 — pages/servers/ServerDetail.tsx + .module.css + SystemForm.tsx + ServiceForm.tsx
  What to do: 创建服务器详情页，路由 /servers/:id。页面展示服务器信息卡（name/purpose/ip/port/status 等）+ 维护人员 Tag 列表。单系统服务器（server_type=SINGLE）：直接展示系统设置卡片（名称/描述可编辑）+ 该系统的服务列表 Table（增删改查）；不显示系统选择器。多系统服务器（server_type=MULTI）：左侧系统树（antd Tree） + 选中系统后右侧展示该系统的服务列表 Table；可新增/删除系统，系统间拖拽不支持（纯 CRUD）。服务新建弹窗含 target_type 下拉（设备/人员/组织）+ target_name 输入 + target_ref 可选引用键 + 维护人员选择器。deploy_status 为 PENDING_REDEPLOY 时显示醒目标记 + 操作按钮"标记为重新部署中" / "标记为已重新部署→恢复正常"。
  Must NOT do: 不引入第三方树组件（antd Tree 足够），不做拖拽移动（override NoteManagement 的拖拽逻辑），不做系统间嵌套。
  Parallelization: Wave 2 | Blocked by: T7,T8 | Blocks: T11
  References: frontend/src/pages/notes/NoteManagement.tsx（Tree 树形参考），frontend/src/pages/secrets/CategoryDetail.tsx（嵌套子项参考）
  Acceptance criteria: `npx tsc --noEmit` 零错误，页面渲染不崩溃，单/多系统模式切换正常。
  QA scenarios: Playwright 从列表点击进入详情 → 单系统服务器展示服务列表 Table → 新增服务（选 target_type + 填 target_name + 选维护人员）→ 服务列表更新。多系统服务器展示系统树 → 选系统 → 展示该系统的服务。
  Commit: Y | feat(page): 新增服务器详情页（系统树 + 服务管理）

- [x] T11. 路由/侧边栏/标题注册
  What to do: router.tsx 添加两个 lazy 路由：/servers（ServerManagement）+ /servers/:id（ServerDetail），均在 AuthGuard 内。config/routeTitles.ts 添加 '/servers'='服务器管理' + '/servers/' 前缀匹配。MainLayout.tsx ICON_MAP 添加 icon<CloudServerOutlined>。SidebarManagement.tsx DEFAULT_ITEMS 添加 {key:'/servers',label:'服务器管理',icon:'CloudServerOutlined',visible:true}。
  Must NOT do: 不改动已有路由的路径。
  Parallelization: Wave 3 | Blocked by: T6,T9,T10 | Blocks: —
  References: frontend/src/router.tsx（路由注册），frontend/src/config/routeTitles.ts，frontend/src/layouts/MainLayout.tsx（ICON_MAP + getMenuItems），frontend/src/pages/settings/SidebarManagement.tsx（DEFAULT_ITEMS）
  Acceptance criteria: 访问 /servers 路由不 404，侧边栏渲染"服务器管理"菜单项。
  QA scenarios: Playwright 打开 app → 侧边栏点击"服务器管理" → 页面展示 ServerManagement。
  Commit: Y | feat(router): 注册 /servers + /servers/:id 路由+侧边栏

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE.
- [x] F1. 后端 py_compile 全部模型/schema/service/api 通过 + alembic upgrade head 无错误
- [x] F2. 前端 tsc --noEmit 零错误 + npm run build 成功
- [x] F3. Docker 部署 7/7 服务健康 + curl 冒烟测试（创建服务器→获取列表→获取详情→创建系统→创建服务→删除→验证状态变更）
- [x] F4. Scope 审计 — 确认无修改已有模块、无引入新依赖、无残留 Emoji、无硬编码颜色

## Commit strategy
- Commit 1: feat(server): Server/System/Service 模型+迁移+配置（T1+T2+T3）
- Commit 2: feat(server): Server/System/Service Schema+Service+API 后端全链路（T4+T5+T6）
- Commit 3: feat(server): 前端 servers 管理页+详情页+类型+API 封装（T7+T8+T9+T10）
- Commit 4: feat(server): 路由/侧边栏/标题注册 + 最终验证（T11+F1-F4）

## Success criteria
1. 三表（servers/systems/services）在 PostgreSQL 中存在且迁移可回滚
2. 后端 18 个端点（3×5+3）均可通过 curl 正常调用
3. 前端服务器列表页渲染正常，创建/编辑/删除数据正确
4. 前端服务器详情页单/多系统模式切换正常，系统和服务 CRUD 正常
5. deploy_status 状态机（NORMAL → PENDING_REDEPLOY → REDEPLOYING → NORMAL）正常流转
6. 侧边栏/路由/标题注册无遗漏
7. TypeScript 编译零错误，Docker 部署 7/7 健康
