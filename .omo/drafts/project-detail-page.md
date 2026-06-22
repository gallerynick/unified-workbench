---
slug: project-detail-page
status: awaiting-approval
intent: clear
pending-action: write .omo/plans/project-detail-page.md
approach: 创建项目详情页，实现右侧操作区 + 功能页切换 + 项目文档编辑器 + 模板集成
---

# Draft: project-detail-page

## Components (topology ledger)
| id | outcome | status | evidence path |
|----|---------|--------|---------------|
| C1 | ProjectDetailPage 主组件 | active | frontend/src/pages/projects/ProjectDetailPage.tsx |
| C2 | ProjectInfoTab 项目信息页 | active | frontend/src/pages/projects/tabs/ProjectInfoTab.tsx |
| C3 | ProjectProgressTab 项目进度页 | active | frontend/src/pages/projects/tabs/ProjectProgressTab.tsx |
| C4 | ProjectDocumentTab 项目文档页 | active | frontend/src/pages/projects/tabs/ProjectDocumentTab.tsx |
| C5 | TemplateSelector 模板选择器 | active | frontend/src/pages/projects/TemplateSelector.tsx |
| C6 | 后端项目文档API | active | backend/app/api/project_documents.py |
| C7 | 项目文档模型 | active | backend/app/models/project_document.py |

## Open assumptions (announced defaults)
| assumption | adopted default | rationale | reversible? |
|------------|-----------------|-----------|-------------|
| 路由方案 | /projects/:id 子路由 | 复用现有路由结构 | 是 |
| 文档存储 | 独立 project_document 表 | 与 record 分离，便于扩展 | 是 |
| 编辑器 | 复用 ContentEditor (Tiptap) | 已有成熟实现 | 是 |
| 模板集成 | 搜索模板 + 一键导入内容 | 简化用户操作 | 是 |

## Findings (cited - path:lines)
- RecordManagement.tsx:306-317 - 进入按钮已实现，点击调用 handleEdit
- RecordManagement.tsx:173-179 - handleEdit 函数，从 record.template_snapshot 获取字段定义
- router.tsx:81-83 - /projects 路由使用 RecordManagement defaultType="project"
- ContentEditor.tsx:82-255 - Tiptap 编辑器已实现，支持富文本，使用 JSON 格式存储
- TemplateManagement.tsx:42-339 - 模板管理系统已实现
- TemplateEditor.tsx:25-37 - 支持 11 种字段类型
- backend/app/models/record.py:37-78 - Record 模型包含 template_id, data, type 字段
- backend/app/schemas/template.py:27-39 - TemplateField 定义了字段类型
- backend/app/services/record.py:43 - 创建时自动从模板拷贝 schema 到 template_snapshot
- frontend/src/api/templates.ts:1-59 - 模板 API 客户端
- frontend/src/types/template.ts:1-39 - 模板类型定义
- backend/app/api/router.py:35-36 - 后端路由前缀配置

## Decisions (with rationale)
1. **路由方案**: 使用 /projects/:id 子路由，点击进入后导航到详情页
2. **文档存储**: 创建独立的 project_document 表，存储项目文档内容
3. **编辑器**: 复用现有的 ContentEditor 组件，保持一致性
4. **模板集成**: 在文档编辑器旁添加模板搜索面板，支持一键导入
5. **文档格式**: 使用 Tiptap JSON 格式存储文档内容，与 ContentEditor 一致

## Scope IN
- 点击进入后显示项目详情页
- 右侧操作区，上方切换功能页（项目信息、项目进度、项目文档）
- 项目文档页面包含文本编辑器
- 模板搜索和导入功能
- 项目信息展示（标题、状态、创建时间等）
- 项目进度展示（状态流转）

## Scope OUT (Must NOT have)
- 不实现复杂的项目管理功能（甘特图、资源分配等）
- 不实现多人协作编辑
- 不实现文档版本控制
- 不实现文档权限管理

## Open questions
无

## Approval gate
status: approved
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
