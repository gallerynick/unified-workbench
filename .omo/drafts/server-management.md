---
slug: server-management
status: awaiting-approval
intent: clear
pending-action: 用户批准后由 Sisyphus 执行（$start-work）
approach: Standard four-layer backend + standard management page frontend; composite inline targets (Option A — Q1 decided); single-system auto-creates one default system (Option A — Q2 decided); deploy_status state machine (normal→pending_redeploy→redeploying); maintainer_ids must be User table members
decided:
  Q1: Option A — composite fields target_type/target_name/target_ref, no separate Device/Personnel/Organization models
  Q2: Single-system = auto-creates default system, multi-system = free add/delete; system name/description set in server settings
  maintainers: JSONB[UUID], must be workspace members (User table)
---

# Draft: server-management

## Components (topology ledger)
| id | outcome | status | evidence |
|----|---------|--------|----------|
| C1 | Server Model + DB Migration — 新建 servers 表，字段：name/purpose/location/ip/port/description/notes/status/server_type(SINGLE/MULTI)/deploy_status | active | 参考 models/inventory.py 模式 |
| C2 | Server Backend CRUD — models/schemas/services/api 四层，LIST/CREATE/GET/PUT/DELETE 标准五端点 | active | 参考 api/topology.py 模式 |
| C3 | System + Service Models — systems 表(FK→server) + services 表(FK→system)，含 target_type/target_id | active | — |
| C4 | System + Service Backend CRUD — 系统/服务的增删改查，嵌套于服务器路由下 | active | — |
| C5 | Frontend Server List Page — 标准 Table 管理页（container→header→Table 分页→Modal 表单） | active | 参考 FileSharePage.tsx 模式 |
| C6 | Frontend Server Detail Page — 服务器详情页，含系统树 + 服务列表 + 目标管理 | active | 参考 NoteManagement 树形 + CategoryDetail 嵌套 |

## Open assumptions (announced defaults)
| assumption | adopted default | rationale | reversible? |
|------------|-----------------|-----------|-------------|
| A1 | Server 不可见共享（private-only） | 与 Inventory 一致，纯所有者管理 | 可逆（后续加 visibility） |
| A2 | 类型不可变性：server_type 创建后不可改；需变更类型时删除旧服务器新建 | 用户明确要求"一旦创建则不允许更改" | 不可逆（需求约束） |
| A3 | 重新部署状态：deploy_status 枚举（normal / pending_redeploy / redeploying） | 用户要求"标记为重新部署状态" | 可逆 |
| A4 | 路由前缀：/servers（列表）+ /servers/:id（详情，含 systems/services 嵌套） | 遵循现有命名约定（/shares, /content, /topologies） | 可逆 |

## Findings (cited - path:lines)
- 无现有 Server/Device/Equipment 模型（models/__init__.py 29 个模型均无）
- Inventory 是最接近的资产模型（name/category/status/location/description/owner）
- Topology 节点 JSONB 含 'server' 类型（ip/status/x/y/label），非独立实体
- 标准后端四层约定：models(声明式 Mapped/mapped_column) → schemas(Pydantic 四件套 from_attributes) → services(纯 async + 审计 log_audit) → api(APIRouter 五端点 + UnifiedResponse 泛型)
- Alembic 最新迁移 019，新表从 020 起
- 前端标准管理页模式：container→header{Title+Space+按钮}→Table{pagination:showQuickJumper+showSizeChanger+showTotal}→Modal 弹窗
- 树形子项参考：NoteManagement（扁平 parent_id + 前端 buildTree + TreeSelect）
- 路由注册：router.tsx lazy + MainLayout children 相对路径 + routeTitles.ts + SidebarManagement DEFAULT_ITEMS + MainLayout ICON_MAP
- 新模块落地 6 步：types/api/pages + router.tsx + routeTitles.ts + 侧边栏注册

## Decisions (with rationale)
- D1: 后端新模块路径 `backend/app/models/server.py`（同目录其他模型命名模式）
- D2: 前端新模块路径 `frontend/src/pages/servers/ServerManagement.tsx` + `ServerDetail.tsx`
- D3: 系统和服务作为服务器的子资源，API 嵌套：`/servers/{id}/systems` + `/systems/{id}/services`
- D4: deploy_status 枚举：normal=正常运行 / pending_redeploy=待重新部署 / redeploying=重新部署中

## Scope IN
- Server CRUD（列表/创建/编辑/删除），含全部用户所述字段
- 单系统/多系统服务器区分，创建后类型不可变
- 系统管理（增删改查，嵌套于服务器下）
- 服务管理（增删改查，嵌套于系统下），含目标类型/目标
- 重新部署状态机制
- 前后端全链路打通 + 路由 + 侧边栏
- Alembic 迁移

## Scope OUT (Must NOT have)
- 不修改 Topology 模型（服务器管理与拓扑节点独立）
- 不修改 Inventory 模型
- 不改动基定文档
- 不做服务器资源监控（CPU/内存/磁盘实时数据——那是运维监控系统的事）
- 不做 SSH/远程连接/命令执行功能
- 不做自动化部署脚本生成

## Open questions
### Q1 (FOGGIEST — 服务目标如何建模？)
服务可指向三种目标类型：**设备 / 人员 / 组织**。这决定了是否需要新表、以及整体架构复杂度。

已探索：项目中 Inventory 是"物品清单"（有 name/status/location 字段），User 表是系统用户。无独立 Device/Personnel/Organization 模型。

| 选项 | 描述 | 工作量 | 
|------|------|--------|
| **A（推荐）** | 组合字段：`target_type` 枚举(device/personnel/organization) + `target_name` 自由文本 + `target_ref` 可选引用键(如 user_id 或 inventory_id)。不建新表。 | 低 |
| B | 为三种目标各建独立模型（完整 CRUD + 管理页） | 非常高（3 表 × 四层 + 3 前端页面） |
| C | 仅 `target_description` 自由文本，无结构化关联 | 极低 |

### Q2（单/多系统服务器的行为差异确认）
单系统服务器是否意味着只能有 **1 个系统**（自动创建或限制为 1）？多系统服务器可创建 N 个系统？

| 选项 | 描述 |
|------|------|
| **A（推荐）** | 单系统=服务器创建时自动生成 1 个默认系统，不可新增/删除；多系统=可自由增删系统。UI 上单系统直接显示服务列表（跳过系统层级）。 |
| B | 单系统也允许手动创建系统，但最多 1 个 |

## Approval gate
status: drafting
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
