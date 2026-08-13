# server-unified-refactor — Work Plan

## TL;DR (For humans)

**What you'll get:** 统一的服务器管理系统——取消单/多系统区分，服务器→系统→虚拟机→服务四级层级。系统支持 parent_system_id 自引用（最深 1 层 VM）。Server 新增硬件字段（hostname/os/cpu/ram/disk/model），System 新增 IP/os/环境/资源分配字段。所有 System 详情页结构统一（深度 0 可建 VM+Service，深度 1 仅可建 Service）。

**Why this approach:** 同一 System 模型承载"操作系统"和"虚拟机"两种身份，通过 parent_system_id IS NULL/IS NOT NULL 区分。深度限制为应用层校验（parent_system_id 的 System 不能再被其他 System 作为 parent）。

**What it will NOT do:** 不建独立 VM 表、不改动 Server/System 的核心 CRUD 模式、不做深度 2+ 的 VM 嵌套、不改动 Service 的核心结构（仅加 protocol 字段）。

**Effort:** Medium（~15 文件，前后端全链路）
**Risk:** Medium — DB 迁移有数据影响；前端重构从卡片双视图变为统一 System 详情页

---

## Scope

### Must have
- Server 删除 `server_type`/`deploy_status`，新增 hostname/os/cpu_cores/ram_gb/disk_gb/model/serial_number/tags
- System 新增 parent_system_id(FK→system 自引用)/ip/os_type/os_version/cpu_allocated/ram_allocated/disk_allocated/status/environment/tags/notes
- Service 新增 protocol/status/health_check_url
- 删除 `PUT /servers/{id}/change-type` 端点
- 深度校验：parent_system_id 非空的 System（VM）不能作为 parent（深度 1 封顶）
- 前端 ServerDetail → System 详情页（卡片网格）→ click → Service 列表（VM 详情页同上结构但无 VM 区域）
- 前端 Server 表单新增硬件字段，System 表单新增 IP/os/资源/环境字段

### Must NOT have
- 不做 VM 独立模型（全部用 System 模型承载）
- 不做深度 2+ 的 VM 嵌套
- 不做端口转发/环境变量/定时任务/挂载点独立表
- 不改动已有模块（Content/Topology/Inventory 等）
- 不引入新依赖

---

## Todos

- [x] T1. DB 迁移 022 — Server + 字段 / System + parent_id+字段 / Service + protocol；drop server_type/deploy_status 列
- [x] T2. 模型 — models/server.py -server_type/deploy_status +hostname/os/cpu/ram/disk/model；system.py +parent_system_id/ip/os/cpu/ram/status；service.py +protocol
- [x] T3. Schema — schemas 三个文件更新 Create/Update/Response/ListResponse；移除 ChangeServerTypeRequest
- [x] T4. Service 层 — update_server/change_type 删除；create_system 加深度校验；create_service 加 protocol
- [x] T5. API — servers.py 删除 change-type；systems.py 加 ?parent_system_id= 过滤
- [x] T6. 前端 types+API — 更新 server.ts/system.ts/service.ts 类型 + api 文件
- [x] T7. 前端 ServerManagement — 卡片网格更新（显示硬件信息）；ServerFormModal 加硬件字段
- [x] T8. 前端 SystemDetail（新建） — 系统详情页：信息卡 + VM 卡片网格 + Service Table；depth=0 显示 VM 区域，depth=1 不显示
- [x] T9. 前端 SystemForm（新建） — 系统/VM 新建/编辑表单
- [x] T10. 前端路由 — server.tsx → SystemDetail 路由（/servers/:serverId/systems/:systemId）
- [x] T11. 验证 — py_compile + alembic + tsc -b + Docker 部署 + curl 冒烟

## Final verification wave
- [x] F1. 后端 py_compile 全部通过 + alembic 迁移无错误
- [x] F2. 前端 tsc -b 零错误 + npm run build 成功
- [x] F3. Docker 部署 7/7 + curl 冒烟（创建服务器→系统→VM→服务→深度校验→删除）
- [x] F4. Scope 审计 — 无修改已有模块、无新依赖、无 Emoji

## Execution strategy

**Wave 1（4 parallel）：** T1-T2-T3-T4-T5（后端全链路）+ T6（前端 types/API）
**Wave 2（3 parallel）：** T7（ServerManagement）+ T8（SystemDetail）+ T9（SystemForm）
**Wave 3（1 solo）：** T10 路由注册
**Wave 4（验证）：** F1-F4

## Success criteria
1. Server 的 server_type/deploy_status 已删除，硬件字段可用
2. System 的 parent_system_id 支持自引用嵌套（最深 1 层）
3. 深度校验：VM（parent 非空）不可再建 VM
4. 前端 System 详情页深度 0 显示 VM+Service，深度 1 仅显示 Service
5. TypeScript 零错误，Docker 7/7 健康，curl 冒烟全 PASS
