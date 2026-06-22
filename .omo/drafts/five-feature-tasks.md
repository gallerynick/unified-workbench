---
slug: five-feature-tasks
status: drafting
intent: clear
pending-action: write .omo/plans/five-feature-tasks.md
approach: <fill: the approach you intend to plan>
---

# Draft: five-feature-tasks

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->

## Findings (cited - path:lines)

### 文件管理
- `backend/app/models/file.py:44-46` - File 模型已有 `expires_at` 字段
- `backend/app/models/folder.py:43-45` - Folder 模型已有 `unified_management` 字段
- `frontend/src/pages/files/FileManagement.tsx:73-341` - 文件管理主页面，表格+侧边栏文件夹树
- `frontend/src/pages/files/FolderTree.tsx:18-193` - 文件夹树组件，支持递归构建
- `frontend/src/pages/files/FileUploadModal.tsx:42-216` - 文件上传弹窗，含可见性设置
- `backend/app/services/file.py:175-219` - 可见性过滤逻辑

### 设备管理
- `frontend/src/pages/settings/DeviceManagement.tsx:24-136` - 纯 Mock 数据，无后端 API
- 后端无设备管理相关模型、API 或服务

### 日历
- `frontend/src/pages/calendar/CalendarPage.tsx:12-187` - 自定义月视图日历
- `backend/app/models/calendar_event.py` - 日历事件模型
- `backend/app/api/calendar_events.py` - 日历事件 API（5个端点）

### 用户隔离
- `backend/app/core/deps.py:17-44` - JWT 认证依赖
- `backend/app/core/permissions.py:15-60` - 可见性三态模型
- 所有服务层都强制 `owner_id` 过滤

### 物品管理模式
- `backend/app/models/task.py` - 任务模型（最完整示例）
- `frontend/src/pages/tasks/TaskManagement.tsx:1-183` - 任务管理页面（推荐模板）
- 通用模式：UUID 主键、owner_id 隔离、JSONB 元数据、5 端点 RESTful API

## Decisions (with rationale)

## Scope IN

## Scope OUT (Must NOT have)

## Open questions

## Approval gate
status: approved
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
