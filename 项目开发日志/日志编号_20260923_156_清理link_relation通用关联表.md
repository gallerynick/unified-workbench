## [日志编号_20260923_156] - 2026-09-23

### 开发版本
版本号：v2.0.0

### 关联基定
- 项目基定/开发基准文档.md 第 5 章（代码规范基准）
- 反熵治理原则：零消费者基建清理

### 开发目标
1. 清理 `link_relation` 通用关联表全套基建（零消费者、无实际调用）
2. 删除对应数据库表（表内 0 行数据，无数据损失风险）
3. 保留 Alembic 迁移文件 034（历史已应用，不可删除），新增 049 迁移记录 DROP 操作

### 涉及模块 / 文件

#### 删除文件（9 个）
- 项目文件/backend/app/models/link_relation.py
- 项目文件/backend/app/schemas/link_relation.py
- 项目文件/backend/app/services/link_relation.py
- 项目文件/backend/app/api/link_relations.py
- 项目文件/frontend/src/api/link-relations.ts
- 项目文件/frontend/src/types/link-relation.ts
- link_relation说明.md
- 项目文件/backend/app/api/router.py（移除 import 与 include_router 两行）
- 项目文件/backend/app/models/__init__.py（移除 import 与 __all__ 导出两行）

#### 新增文件（1 个）
- 项目文件/backend/alembic/versions/049_drop_link_relation.py

#### 修改文件（1 个）
- 项目文件/backend/app/startup_migrate.py（新增 DROP INDEX + DROP TABLE 幂等语句，更新文件头注释）

### 开发内容详述

#### 背景
`link_relation` 是迁移 034（项目重做）时引入的通用双向关联表，设计目标是跨模块松散关联。经全仓扫描确认：
- **零消费者**：除自身 5 个文件互相引用外，无任何业务代码引用 `LinkRelation` 模型或 `/link-relations` API
- **项目管理内部关联已由标准外键覆盖**（如 `project_todo.meeting_id` → `project_meeting.id`）
- **表内 0 行数据**：DROP 无数据损失风险

#### 删除范围
| 层 | 资产 | 处理 |
|----|------|------|
| 后端模型 | `models/link_relation.py` | 删除 |
| 后端 Schema | `schemas/link_relation.py` | 删除 |
| 后端服务 | `services/link_relation.py` | 删除 |
| 后端 API | `api/link_relations.py` | 删除 |
| 路由注册 | `api/router.py` 第 19 行、第 86 行 | 移除两行 |
| 模型导出 | `models/__init__.py` 第 11 行、第 59 行 | 移除两行 |
| 前端客户端 | `api/link-relations.ts` | 删除 |
| 前端类型 | `types/link-relation.ts` | 删除 |
| 文档 | `link_relation说明.md` | 删除 |
| 数据库表 | `link_relation` + 索引 `ix_link_relation_source_type_source_id` | DROP |
| 迁移文件 034 | 历史已应用 | **保留不动**（Alembic 链完整性） |

#### 数据库清理
- 新增 Alembic 迁移 `049_drop_link_relation.py`，含 `upgrade()`（DROP）和 `downgrade()`（重建表+索引），可回滚
- 同步更新 `startup_migrate.py`（项目实际使用的迁移执行机制），新增幂等 DROP 语句
- 迁移文件 034 保留：Alembic 迁移链的完整性要求，删除会导致链断裂

#### 反熵治理声明
```
Deletion Class: contract-carrying code + derived persistent-state (empty table)
Old Path/Object: link_relation 全套基建（9 文件 + 1 空表）
New Canonical Owner: 无（项目内部关联由标准外键承担）
Expected Preserved Behavior: 项目管理内部关联（外键）不受影响
Expected Retired Behavior: link_relation 跨模块关联能力（零消费）
External Boundary Touched: no
Source-of-Truth Data Risk: none（表内 0 行）
User Confirmation Required: no（代码层 delete-first；空表 DROP 无数据风险）
```

### 遇到的问题与解决

1. **Docker 不在沙箱 PATH**：`docker` 命令在沙箱环境不可用，Docker Desktop 安装在 `/Applications/Docker.app/Contents/Resources/bin/docker`，需使用完整路径调用。
   - 解决：定位到完整路径后直接调用。

2. **ruff 不在系统 Python**：`ruff` 安装在后端 venv 中（`.venv/bin/ruff`），系统 Python 无此模块。
   - 解决：使用 `.venv/bin/ruff` 路径调用。

3. **迁移执行机制**：项目未初始化 `alembic_version`，`alembic upgrade head` 不会自动执行。实际迁移通过 `startup_migrate.py` 的 inline SQL 完成。
   - 解决：同时更新迁移文件 049（文档/回滚用途）和 `startup_migrate.py`（实际执行）。

4. **既有 ruff 错误**：`router.py` 和 `__init__.py` 各有 1-2 个 ruff 错误（import 排序、行长、未用导入），均为既有问题，与本次清理无关。

### 测试情况
- 测试方式：Docker 容器内验证 + 全仓引用扫描 + 构建检查
- 测试结果：通过
  - ✅ 全仓残留扫描：仅迁移文件 034/049 含 `link_relation` 字样（预期保留）
  - ✅ 前端 `npx tsc -b --noEmit`：零错误
  - ✅ 后端 ruff：无新增错误（既有 3 个错误与本次无关）
  - ✅ API 下线验证：`GET /api/v1/link-relations/` 返回 404
  - ✅ 数据库表验证：`to_regclass('public.link_relation')` 返回空（表已删除）
  - ✅ 部署冒烟：所有容器 healthy，前端 200 / 后端 health 200

### 与项目基定的一致性确认
☑ 本次开发完全符合《项目基定》要求
- 代码规范：PEP8 + ruff 检查通过（无新增错误）
- 部署规范：使用 `start.sh` 统一启动脚本
- 安全约束：表内 0 行数据，无数据损失

### 下一步计划
1. 继续「会议记录」模块设计评审与实施计划
2. 清理其他零消费者基建（如有）

---
