## 日志编号_20260810_025_Project表project_id字段清理

### 开发版本
版本号：v1.0.1（未升级，紧急 bug 修复）

### 关联基定
《项目基定/开发基准文档.md》：功能模块 — 项目管理（P2 特色）

### 开发目标
1. 删除 `Project` 模型中残留的 `project_id` 字段（迁移 034 重建后的 project 表无此列，残留声明导致 SQLAlchemy 所有查询报错 "column project.project_id does not exist"）
2. 后端 schema/service 中 `project_id` 字段引用全部替换为 `number`
3. 前端 `Project` 类型将 `number` / `member_permissions` 改为必填非空（后端现已输出）

### 涉及模块 / 文件
- 模块：项目管理 / 后端模型 / 前端类型
- 新增文件：
  - `项目开发日志/日志编号_20260810_025_Project表project_id字段清理.md`
- 修改文件：
  - `backend/app/models/project.py`：删除 `project_id` 字段定义（仅保留 `number`）
  - `backend/app/schemas/project.py`：`ProjectCreate`/`ProjectUpdate`/`ProjectResponse` 的 `project_id` 字段替换为 `number`；`ProjectResponse` 新增 `member_permissions: dict | None = None`
  - `backend/app/services/project.py`：`create_project` 中 `project_id=data.get("project_id")` 改为 `number=data.get("number")`；`update_project` 字段元组 `("project_id", ...)` 改为 `("number", ...)`
  - `frontend/src/types/project.ts`：`Project.number` / `Project.member_permissions` 改为必填非空；`ProjectCreate`/`ProjectUpdate` 保持可选
- 删除文件：无

### 开发内容详述
1. **模型层**：删除 `Project.project_id`（`String(50)`，可空）字段定义。迁移 034 重建后的 project 表列集合为 `id/number/title/description/content/status/owner_id/member_ids/visibility/restricted_users/restricted_tags/status_log/member_permissions/created_at/updated_at`，无 `project_id` 列；不删除会导致 SQLAlchemy 在构建 SELECT 时引用不存在的列。
2. **Schema 层**：三个模型中的 `project_id: str | None = None` 全部替换为 `number: str | None = None`；`ProjectResponse` 补充 `member_permissions: dict | None = None`（模型已有该列，`from_attributes=True` 自动取值，列表端点无需额外代码）。
3. **Service 层**：仅替换两处真正的字段名引用；`get_project`/`update_project`/`delete_project` 的函数参数 `project_id` 语义为主键 `Project.id`，内部使用 `Project.id == project_id` 查询，保持不变。
4. **前端类型**：`Project.number` 改为 `number: string | null`、`Project.member_permissions` 改为 `Record<string, string> | null`（必填非空，因后端响应现已包含）；创建/更新入参保持可选。

### 遇到的问题与解决
- 问题：`project_common.py` 与各项目子模块服务中大量出现 `project_id`
- 解决方案：逐一核对——`project_common.py` 的 `project_id` 为函数参数名（查询用 `Project.id == project_id`，主键语义）；子模块（todo/proposal/change/meeting/event/member）的 `project_id` 为各自子表的外键列，与主 project 表字段无关。以上均不改动。
- 遗留问题 / 待办：前端页面代码（`ProjectForm.tsx` 表单字段 `name="project_id"`、`ProjectManagement.tsx` 列 `dataIndex: 'project_id'`）仍引用旧字段名，提交时后端将忽略多余字段，属后续前端 Tab 开发时的适配项。

### 测试情况
- 测试方式：
  - `py_compile` 校验 4 个后端文件：`.venv/bin/python -m py_compile app/models/project.py app/schemas/project.py app/services/project.py app/api/projects.py`，退出码 0
  - 前端类型检查：`npx tsc -b`，退出码 0
  - grep 全后端确认：`data.get("project_id")` / `Project.project_id` / 字段元组 `"project_id",` 均无残留；唯一匹配为 `project_member.py` 子表自身 `UniqueConstraint("project_id", "user_id")` 外键约束，属无关项保留
- 测试结果：通过

### 与项目基定的一致性确认
☑ 本次开发完全符合《项目基定》要求
☐ 如有偏离，说明原因及是否已确认：

### 下一步计划
- 继续前端项目模块 Tab 开发，同时将前端页面中的 `project_id` 引用适配为 `number` 字段
