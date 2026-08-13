# data-export-import - Work Plan

## TL;DR (For humans)

**What you'll get:** 管理员可在系统设置页设置密码 → 导出全量数据为 AES-256 加密 ZIP 包直接下载到本机；导入时在系统设置页或初始化界面中上传加密 ZIP + 输入密码 → 版本兼容性校验 → 迁移 → 清空覆盖 → 写入 → 数据包立即从服务器删除。版本仅允许同版本导入与向前小版本迁移，跨大版本（有破坏性 schema 变更）拒绝导入。

**Why this approach:** ZIP AES-256 密码加密保证数据包传输安全，密码由管理员设置不存服务器；导入后立即删除数据包不留服务器；严格版本兼容矩阵杜绝旧版断崖导入。迁移函数链仍然精确可控。

**What it will NOT do:** 不做降级导入（高版本→低版本拒绝）；不做跨大版本 schema 破坏性变更的自动迁移（如 record 表删除这类必须人工介入）；服务器不保留任何导出/导入数据包文件；不加密单个 JSON 字段（整体 ZIP 加密即可）。

**Effort:** Medium
**Risk:** Medium — 完全覆盖现有数据，需用户二次确认；31 张表可能有大表（如 notification），需分页导出避免 OOM。
**Decisions to sanity-check:** 导出 JSON 是否用 compact 格式（节省空间）vs pretty（便于人工检查）；secret 表加密数据直接导出密文（跨实例需同步 ENCRYPTION_MASTER_KEY 才有意义）。

Your next move: 审批后执行。完整执行细节见下。

---

> TL;DR (machine): Medium effort, 31-table ZIP export/import + version migration chain, 覆盖式导入, 4 waves

## Scope
### Must have
1. 管理员通过 API POST /data/export 触发全量导出 → 生成 ZIP 包下载
2. ZIP 包结构：manifest.json（版本号+导出时间+表清单） + `tables/<表名>.json` + `files/<原路径>`
3. 管理员通过 API POST /data/import 上传 ZIP → 校验 → 清空 → 跨版本迁移 → 写入
4. 迁移函数链：`migrations/v1.0.0.py` 等模块，每个注册 `upgrade(data: dict) -> dict`
5. 导出/导入进度反馈（大表异步处理）
6. 前端设置页：导出按钮 + 导入上传 + 进度条

### Must NOT have (guardrails, anti-slop, scope boundaries)
- **禁止高版本→低版本导入**：version.py 做 source_version > current_version → 拒绝
- **禁止跨大版本破坏性 schema 变更的自动导入**：如 record 表被删除这类需人工介入的场景，迁移函数返回错误标记，前端显示具体不兼容项
- 不做增量/差异导出
- 不按模块/用户筛选（MVP 全量）
- 不修改现有备份机制（pg_dump 备份方案保持不变）
- 不自动触发（手动操作）
- **导入/导出完成后立即从服务器删除 ZIP 文件**（不保留数据包）
- 不包含 Docker 卷/Redis 数据
- 不加密单个 JSON 字段（整体 ZIP AES-256 加密即可）
- **密码不存服务器**：用户设置的密码仅用于 ZIP 加密，不写入 DB/日志

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after + 冒烟对比
- Evidence: .omo/evidence/task-<N>-data-export-import.<ext>

## 设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 导出格式 | 每表独立 JSON + files/ → **AES-256 加密 ZIP** | pyzipper 库支持标准 AES-256 加密；文件不 base64 编码避免膨胀；密码由管理员导出时设定，不存服务器 |
| 导入策略 | 清空后全量覆盖 + **密码校验** | 用户确认；导入时解压前先校验密码，失败则拒绝；解压到内存/临时目录后立即清理 |
| 版本兼容 | **source ≤ current 且无 schema 破坏性变更** | 高版本数据导入低版本环境 → 拒绝；跨大版本破坏性变更 → 迁移函数标记 incompatible，前端显示原因 |
| 版本迁移 | 迁移函数链 | 精确可控，每版本一个 upgrade() 函数，链式调用 |
| 数据包清理 | **导出/导入完成后立即 os.remove** | 不保留 ZIP 文件在服务器磁盘上 |
| 初始化支持 | **Welcome 页可导入数据** | 初始化时无管理员账户，使用系统初始密码；导入成功后自动完成初始化 |
| 隐私保护 | **ZIP 整体加密 + 导入页隐私警告** | 私密数据(visibility=private)在导出数据中明文可见，靠 ZIP 密码保护传输安全；导入页面需明确警告"数据包含所有用户的私密数据" |

## 版本迁移链设计

```
v0.1.0 → v0.2.0 → v1.0.0 → v1.0.1(current)
```

每个版本一个 `migrations/v{version}.py`：
```python
# migrations/v0.2.0.py
def upgrade(table_name: str, records: list[dict]) -> list[dict]:
    if table_name == "reminder":
        for r in records:
            r.setdefault("visibility", "private")
    if table_name == "file_shares":
        for r in records:
            r["is_deleted"] = r.get("is_deleted", False)
    return records
```

当前需覆盖的关键变更：
- v0.2.0→v1.0.0: 15 张表补 `visibility: "private"` + `restricted_users: []`；record 表数据跳过不导入；file→file_shares 映射
- v1.0.0→v1.0.1: servers 表补 hardware_specs: {}；reminder 删 channels 列；user 表补 email/phone/gender: null

## 导出 ZIP 格式定义

```
export_20260807_150000.zip
├── manifest.json          # {"version":"1.0.1","exported_at":"...","tables":["user","tag",...31个],"file_count":42}
├── tables/
│   ├── user.json          # [{id, username, nickname, email, ...}, ...]
│   ├── tag.json
│   ├── ...
│   └── system_config.json
└── files/
    └── 2026/08/uuid-file.pdf   # 原 /data/files/ 下的文件，保持原路径结构
```

## API 端点设计

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/data/export` | 触发生成 ZIP，返回 download_id |
| GET | `/data/export/{download_id}` | 下载生成的 ZIP |
| GET | `/data/export/{download_id}/status` | 查询导出进度 |
| POST | `/data/import` | 上传 ZIP（multipart），触发导入 |
| GET | `/data/import/{task_id}/status` | 查询导入进度 |

## Todos

### Wave 1: 后端导出（T1-T2）

- [ ] **T1: 导出 Service**（`services/data_export.py`）
  - `export_all(db) -> str`：遍历 31 表（skip user_notification_config.refresh_token），分页读取（page_size=1000），写 JSON → 临时目录
  - `create_manifest(version, tables, file_count) -> dict`：生成 manifest.json
  - `copy_files(source_dir, dest_dir)`：遍历 /data/files，硬链接/复制到临时 files/ 目录
  - `pack_zip(temp_dir) -> str`：打包为 ZIP，返回文件路径
  - 异步处理（asyncio + 大表分页）；需处理的表清单定义在 `EXPORT_TABLE_ORDER`（按外键依赖排序：先父表后子表）
  - 依赖：models/__init__.py（读 31 表清单）、core/config.py（FILE_STORAGE_PATH）
  - 验证：导出一个测试服务器（先建少量数据）→ 解压检查 manifest + JSON 完整性

- [ ] **T2: 导出 API**（`api/data_export.py`）
  - POST `/data/export` → 后台启动导出任务 → 返回 `export_id`
  - GET `/data/export/{export_id}` → FileResponse 下载 ZIP
  - GET `/data/export/{export_id}/status` → 返回进度（`{status, total_tables, completed_tables, current_table}`）
  - 注册到 `api/router.py`：`include_router(data_export_router, prefix="/data", tags=["数据管理"])`
  - require_admin 认证
  - 依赖：T1 的 service
  - 验证：curl 触发导出 → 等待完成 → 下载 ZIP 200

### Wave 2: 后端导入+迁移（T3-T5）

- [ ] **T3: 迁移函数链**（`services/data_migrations/`）
  - 新建 `services/data_migrations/__init__.py`：`MIGRATION_CHAIN` 列表，按版本序排列
  - 新建 `services/data_migrations/v0_2_0.py`：补 visibility/restricted_users 默认值；处理 record 表（跳过不导入）；file→file_shares 映射
  - 新建 `services/data_migrations/v1_0_0.py`：servers 补 hardware_specs/hostname/os 等硬件字段默认值
  - 新建 `services/data_migrations/v1_0_1.py`：reminder 兼容无 channels 字段；user 补 email/phone/gender null
  - `apply_migration_chain(source_version, target_version, table_name, records) -> records`：链式调用 upgrade 函数
  - 依赖：version.py（当前版本号）、alembic 迁移历史参考
  - 验证：构造旧版 JSON → 运行升级链 → 对比字段预期

- [ ] **T4: 导入 Service**（`services/data_import.py`）
  - `import_all(db, zip_path) -> dict`：
    1. 解压 ZIP → 临时目录
    2. 读取 manifest.json → 校验版本
    3. 显示警告（"这将完全覆盖所有数据"）→ 确认标记
    4. 清空所有表（`TRUNCATE ... CASCADE` 按依赖逆序）
    5. 按外键顺序（先父表后子表）遍历 tables/*.json
    6. 对每张表的记录：`apply_migration_chain()` → `db.execute(insert(T).values(...))`
    7. 复制 files/ 到 FILE_STORAGE_PATH
    8. 返回导入统计 `{imported_tables, imported_rows, skipped_tables, errors}`
  - 注：user 表 id 保留原 UUID（需同步更新 user_notification_config 等关联表的外键）
  - 依赖：T3 迁移链
  - 验证：导出→删除记录→导入→对比行数一致

- [ ] **T5: 导入 API**（`api/data_import.py`）
  - POST `/data/import` → 接收 UploadFile(ZIP) → 后台启动导入 → 返回 `task_id`
  - GET `/data/import/{task_id}/status` → 返回进度
  - 注册到 `api/router.py`
  - require_admin 认证
  - 验证：上传之前导出的 ZIP → 等待导入完成 → 验证数据完整性

### Wave 3: 前端（T6-T7）

- [ ] **T6: 导出/导入页面**（`pages/settings/DataManagement.tsx`）
  - 新建页面：导出按钮（触发 POST /data/export → 轮询进度 → 下载链接）
  - 导入区：Upload.Dragger（接受 .zip）→ 二次确认 Modal（"这将完全覆盖现有数据"）→ POST /data/import → 轮询进度
  - 进度条展示（导出：表数进度；导入：表数+行数进度）
  - 与标准管理页同构（container/header/title）
  - 依赖：T2 + T5 的 API
  - 验证：点击导出 → 等待进度完成 → 下载 ZIP

- [ ] **T7: 路由+侧边栏注册**
  - `router.tsx`：lazy import + 路由 `data/export-import`
  - `routeTitles.ts`：标题映射
  - `MainLayout.tsx`：ICON_MAP 加 DatabaseOutlined（或 ExportOutlined）+ admin 可见菜单项
  - 验证：管理员登录 → 侧边栏可见 → 点击进入页面

### Wave 4: 验证（F1-F4）

- [ ] **F1: 后端验证**
  - `py_compile` 全部新文件
  - import 链验证
  - 验证：`python -c "from app.services.data_export import export_all"` 等

- [ ] **F2: 前端验证**
  - `npx tsc -b` 零错误
  - `npm run build` 成功

- [ ] **F3: 部署 + 冒烟**
  - Docker 部署 → 7/7 健康
  - curl 冒烟：导出 → 下载 ZIP → 导入 → 验证数据完整性（14 步链路）
  - 证据：`.omo/evidence/task-F3-data-export-import.txt`

- [ ] **F4: Scope 审计**
  - 变更文件均在 plan 范围内
  - 无新依赖（zipfile/tempfile/json 均为标准库）
  - 无 Emoji

## 依赖图

```
T1(导出Service) → T2(导出API) ──→ T6(前端)
                                    ↓
T3(迁移链) ──→ T4(导入Service) → T5(导入API) → T6(前端)
                                                    ↓
                                                  T7(路由)
                                                    ↓
                                              F1-F4(验证)
```

## 提交策略

1. Commit 1: `feat: 数据导出后端（Service+API）` — T1+T2
2. Commit 2: `feat: 版本迁移链 + 数据导入后端` — T3+T4+T5
3. Commit 3: `feat: 数据导入导出前端页面 + 路由` — T6+T7
4. Commit 4: `chore: 验证 + 冒烟证据` — F1-F4
