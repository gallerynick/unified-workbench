# 项目模块小需求：创建时可选负责人 + Tab 去图标

## TL;DR (For humans)

两个明确的小改动：
1. **创建项目时可选择项目负责人**：后端 `ProjectCreate` 加 `owner_id` 字段 + `create_project` 支持覆盖负责人；前端 `ProjectForm` 创建模式加"项目负责人"下拉（不选默认创建者本人）。
2. **项目详情页 Tab 去掉图标**：`ProjectDetailPage.tsx` 9 个 tab 删除 `icon` 属性，并清理不再使用的图标 import（严格 TS noUnusedLocals 会报错，必须一并删）。

## 背景（已探索确认）

- 后端 `schemas/project.py` `ProjectCreate`（L14-26）无 `owner_id` 字段；`services/project.py` `create_project(db, data, owner_id)`（L22-43）的 owner_id 由 API 层写死为 `current_user.id`
- `api/projects.py` `create_project_endpoint`（L31-38）调用 `create_project(db, request.model_dump(), current_user.id)`
- 前端 `ProjectForm.tsx`（191 行）已有 `listUsers` 拉取 userOptions（L45-59），成员多选 Select 已存在；`handleSubmit` create 分支（L102-111）构造 `ProjectCreate`
- 前端 `ProjectDetailPage.tsx`（253 行）`tabItems`（L116-198）9 个 tab 均带 `icon` 属性（InfoCircleOutlined/TeamOutlined/LineChartOutlined/BulbOutlined/CheckSquareOutlined/MessageOutlined/HistoryOutlined/FileTextOutlined/CalendarOutlined）；L14-27 imports 这些图标；**保留**的图标：ArrowLeftOutlined（返回）、ExportOutlined（导出）、SettingOutlined（权限设置）

## 待办

### T1: 后端 — ProjectCreate 支持 owner_id
- `schemas/project.py`：`ProjectCreate` 加 `owner_id: uuid.UUID | None = None`（字段放在 number 后、title 前）
- `services/project.py` `create_project`：data 中带 `owner_id` 时校验该用户存在（`select(User).where(User.id == owner_id)` 不存在则 400 "指定的项目负责人不存在"），存在则 `owner_id = data["owner_id"]` 覆盖；否则保持传入的 owner_id（默认创建者本人）
- `api/projects.py`：无需改动（`request.model_dump()` 已含 owner_id）
- 验证：py_compile 通过

### T2: 前端 — ProjectForm 创建模式加负责人选择
- `ProjectForm.tsx`：创建模式（`!isEdit`）在"项目成员"上方加 Form.Item name="owner_id" label="项目负责人"，Select options={userOptions} placeholder="选择项目负责人（不选默认创建者本人）" allowClear，tooltip 说明不选默认为创建者本人
- `handleSubmit` create 分支：`...(values.owner_id ? { owner_id: values.owner_id } : {})` 加入 ProjectCreate
- edit 分支不动（负责人变更属移交流程）
- 验证：tsc -b 零错误

### T3: 前端 — Tab 去图标
- `ProjectDetailPage.tsx`：`tabItems` 9 个 tab 删除 `icon: <XxxOutlined />` 行
- imports（L14-27）删除仅用于 tab 图标的：InfoCircleOutlined/TeamOutlined/LineChartOutlined/BulbOutlined/CheckSquareOutlined/MessageOutlined/HistoryOutlined/FileTextOutlined/CalendarOutlined；**保留** ArrowLeftOutlined/ExportOutlined/SettingOutlined
- 验证：tsc -b 零错误（noUnusedLocals 不报未用 import）

### T4: 验证
- `npx tsc -b` 零错误 + 后端 py_compile
- 部署（docker cp 热更新 backend 2 文件 + npm run build + docker cp dist）或 start.sh
- 冒烟：POST /projects/ 带 owner_id=其他用户 → 返回 owner_id 正确；不带 → 默认创建者；Tab 页面无图标

## Must NOT
- 不修改 edit 模式（负责人变更不在此需求内）
- 不引入新依赖、无 Emoji
- 不改后端 ProjectUpdate（不在本次范围）
