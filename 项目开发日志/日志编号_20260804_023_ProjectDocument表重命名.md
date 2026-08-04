## 日志编号_20260804_023_ProjectDocument表重命名

### 开发版本
版本号：v1.0.1

### 关联基定
《项目基定/开发基准文档.md》：项目文档模块表结构（project 模型）

### 开发目标
1. 将 `project_document` 表重命名为 `project`，与模型类 `Project` 对应
2. API 路由前缀 `/project-documents` 改为 `/projects`
3. 前端路由、侧边栏已使用 `/projects`，确认无 `/project-documents` 残留

### 涉及模块 / 文件
- 模块：项目文档 / 前后端
- 新增文件：
  - `backend/alembic/versions/023_rename_project_document_to_project.py`：迁移 023，`ALTER TABLE project_document RENAME TO project`
  - `项目开发日志/日志编号_20260804_023_ProjectDocument表重命名.md`
- 修改文件：
  - `backend/app/models/project.py`：`__tablename__` 由 `"project_document"` 改为 `"project"`
  - `backend/app/api/router.py`：projects 路由前缀 `/project-documents` 改为 `/projects`
- 未改动（核查确认已符合）：
  - `frontend/src/router.tsx`：路由已为 `/projects`、`/projects/:id`
  - `frontend/src/config/routeTitles.ts`：已为 `/projects`
  - `frontend/src/pages/settings/SidebarManagement.tsx`：key 已为 `/projects`
  - `frontend/src/layouts/MainLayout.tsx`：无 `/project-documents` 引用
  - `frontend/src/api/records.ts`、`frontend/src/types/record.ts`：无 `/project-documents`、`ProjectDocumentRecord` 残留
- 删除文件：无

### 开发内容详述

#### 后端
- `models/project.py`：类 `Project` 的 `__tablename__` 由 `"project_document"` 改为 `"project"`
- `api/router.py`：`projects_router` 注册前缀由 `/project-documents` 改为 `/projects`（tags 仍为「项目文档」）

#### Alembic 迁移 023
- `upgrade()`：`ALTER TABLE IF EXISTS project_document RENAME TO project`
- `downgrade()`：`ALTER TABLE IF EXISTS project RENAME TO project_document`
- 使用 `IF EXISTS` 兼容全新部署（无旧表时跳过）

#### 前端
- 全仓检索确认：前端无 `/project-documents` 或 `ProjectDocumentRecord` 残留，无需改动

### 部署与验证
1. `python3 -m py_compile` 通过（models/project.py、api/router.py、api/projects.py、迁移 023）
2. `npm run build`（tsc -b + vite build）通过
3. `bash start.sh` 重建部署；因后端启动仅 `create_all`（新建了空 `project` 表），先 `DROP TABLE IF EXISTS project`，再 `alembic upgrade head` 执行 023，将 `project_document` 重命名
4. 验证：
   - `alembic current` = `023 (head)`
   - 数据库仅存在 `project` 表，`project_document` 已不存在
   - `GET /api/v1/projects/` 已注册，`GET /api/v1/project-documents` 返回 404
   - 前端首页 HTTP 200，标题正常

### 备注
- `project` 与 `project_document` 均无业务数据（0 行），重命名无数据迁移成本
- 后续若需彻底清理旧表引用，可在 P4 收尾阶段统一核查
