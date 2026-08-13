# project-detail-page - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** 点击项目管理页面的"进入"按钮后，右侧显示项目详情操作区，可切换项目信息、项目进度、项目文档三个功能页。项目文档页面包含富文本编辑器，可搜索并导入模板内容。

**Why this approach:** 复用现有的 ContentEditor 和模板系统，创建独立的项目文档表存储文档内容，通过路由导航实现页面切换。

**What it will NOT do:** 不实现复杂的项目管理功能（甘特图、资源分配）、多人协作编辑、文档版本控制。

**Effort:** Medium
**Risk:** Low - 复用现有组件，架构清晰
**Decisions to sanity-check:** 路由方案、文档存储结构、模板集成方式

Your next move: approve. Full execution detail follows below.

---

> TL;DR (machine): Medium effort, Low risk, deliverables: ProjectDetailPage + 3 tabs + document editor + template integration

## Scope
### Must have
- 点击进入后显示项目详情页
- 右侧操作区，上方切换功能页（项目信息、项目进度、项目文档）
- 项目文档页面包含文本编辑器
- 模板搜索和导入功能
- 项目信息展示（标题、状态、创建时间等）
- 项目进度展示（状态流转）

### Must NOT have (guardrails, anti-slop, scope boundaries)
- 不实现复杂的项目管理功能（甘特图、资源分配等）
- 不实现多人协作编辑
- 不实现文档版本控制
- 不实现文档权限管理

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after + manual QA
- Evidence: .omo/evidence/task-N-project-detail-page.<ext>

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

**Wave 1: Backend foundation**
- T1: Create project_document model
- T2: Create project_document API endpoints
- T3: Create project_document schemas

**Wave 2: Frontend components**
- T4: Create ProjectDetailPage main component
- T5: Create ProjectInfoTab
- T6: Create ProjectProgressTab
- T7: Create ProjectDocumentTab with editor

**Wave 3: Template integration**
- T8: Create TemplateSelector component
- T9: Integrate template import into document editor

**Wave 4: Router and navigation**
- T10: Update router for project detail page
- T11: Update RecordManagement navigation

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| T1 | - | T2, T3 | - |
| T2 | T1 | T4-T11 | T3 |
| T3 | T1 | T4-T11 | T2 |
| T4 | T2, T3 | T5-T11 | - |
| T5 | T4 | T10, T11 | T6, T7 |
| T6 | T4 | T10, T11 | T5, T7 |
| T7 | T4 | T8, T9 | T5, T6 |
| T8 | T7 | T10, T11 | T9 |
| T9 | T7, T8 | T10, T11 | T8 |
| T10 | T4-T9 | T11 | - |
| T11 | T10 | - | - |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

- [x] 1. Create project_document model
  What to do / Must NOT do: 创建 project_document 表，包含 id, project_id, title, content (JSONB), created_at, updated_at 字段
  Parallelization: Wave 1 | Blocked by: - | Blocks: T2, T3
  References (executor has NO interview context - be exhaustive): backend/app/models/record.py:37-78, backend/app/models/template.py:20-48
  Acceptance criteria (agent-executable): 模型创建成功，可通过 Alembic 迁移
  QA scenarios (name the exact tool + invocation): 运行 alembic upgrade head，验证表创建成功
  Commit: Y | feat(backend): add project_document model

- [x] 2. Create project_document API endpoints
  What to do / Must NOT do: 创建 CRUD API 端点，支持创建、读取、更新、删除项目文档
  Parallelization: Wave 1 | Blocked by: T1 | Blocks: T4-T11
  References (executor has NO interview context - be exhaustive): backend/app/api/records.py:42-49, backend/app/api/templates.py:33-109
  Acceptance criteria (agent-executable): API 端点创建成功，可通过 curl 测试
  QA scenarios (name the exact tool + invocation): 使用 curl 测试 POST/GET/PUT/DELETE 端点
  Commit: Y | feat(backend): add project_document API endpoints

- [x] 3. Create project_document schemas
  What to do / Must NOT do: 创建 Pydantic 模型，用于请求和响应验证
  Parallelization: Wave 1 | Blocked by: T1 | Blocks: T4-T11
  References (executor has NO interview context - be exhaustive): backend/app/schemas/record.py:14-66, backend/app/schemas/template.py:27-80
  Acceptance criteria (agent-executable): Pydantic 模型创建成功，可正确验证数据
  QA scenarios (name the exact tool + invocation): 运行 Python 测试，验证模型验证逻辑
  Commit: Y | feat(backend): add project_document schemas

- [x] 4. Create ProjectDetailPage main component
  What to do / Must NOT do: 创建项目详情页主组件，包含右侧操作区和功能页切换
  Parallelization: Wave 2 | Blocked by: T2, T3 | Blocks: T5-T11
  References (executor has NO interview context - be exhaustive): frontend/src/pages/records/RecordManagement.tsx:1-430, frontend/src/pages/content/ContentManagement.tsx:1-339
  Acceptance criteria (agent-executable): 组件创建成功，可正确渲染
  QA scenarios (name the exact tool + invocation): 启动前端，访问 /projects/:id，验证页面渲染
  Commit: Y | feat(frontend): add ProjectDetailPage component

- [x] 5. Create ProjectInfoTab
  What to do / Must NOT do: 创建项目信息页，展示项目标题、状态、创建时间等信息
  Parallelization: Wave 2 | Blocked by: T4 | Blocks: T10, T11
  References (executor has NO interview context - be exhaustive): frontend/src/pages/records/RecordForm.tsx:1-368
  Acceptance criteria (agent-executable): 组件创建成功，可正确展示项目信息
  QA scenarios (name the exact tool + invocation): 启动前端，切换到项目信息页，验证信息展示
  Commit: Y | feat(frontend): add ProjectInfoTab component

- [x] 6. Create ProjectProgressTab
  What to do / Must NOT do: 创建项目进度页，展示项目状态流转
  Parallelization: Wave 2 | Blocked by: T4 | Blocks: T10, T11
  References (executor has NO interview context - be exhaustive): frontend/src/pages/records/RecordManagement.tsx:250-265
  Acceptance criteria (agent-executable): 组件创建成功，可正确展示项目进度
  QA scenarios (name the exact tool + invocation): 启动前端，切换到项目进度页，验证进度展示
  Commit: Y | feat(frontend): add ProjectProgressTab component

- [x] 7. Create ProjectDocumentTab with editor
  What to do / Must NOT do: 创建项目文档页，包含富文本编辑器
  Parallelization: Wave 2 | Blocked by: T4 | Blocks: T8, T9
  References (executor has NO interview context - be exhaustive): frontend/src/pages/content/ContentEditor.tsx:1-255
  Acceptance criteria (agent-executable): 组件创建成功，可正确渲染编辑器
  QA scenarios (name the exact tool + invocation): 启动前端，切换到项目文档页，验证编辑器渲染
  Commit: Y | feat(frontend): add ProjectDocumentTab component

- [x] 8. Create TemplateSelector component
  What to do / Must NOT do: 创建模板选择器组件，支持搜索和选择模板
  Parallelization: Wave 3 | Blocked by: T7 | Blocks: T10, T11
  References (executor has NO interview context - be exhaustive): frontend/src/pages/templates/TemplateManagement.tsx:1-339
  Acceptance criteria (agent-executable): 组件创建成功，可正确搜索和选择模板
  QA scenarios (name the exact tool + invocation): 启动前端，打开模板选择器，验证搜索功能
  Commit: Y | feat(frontend): add TemplateSelector component

- [x] 9. Integrate template import into document editor
  What to do / Must NOT do: 将模板内容导入到文档编辑器中
  Parallelization: Wave 3 | Blocked by: T7, T8 | Blocks: T10, T11
  References (executor has NO interview context - be exhaustive): frontend/src/pages/content/ContentEditor.tsx:97-117
  Acceptance criteria (agent-executable): 模板内容可正确导入到编辑器
  QA scenarios (name the exact tool + invocation): 启动前端，选择模板，验证内容导入
  Commit: Y | feat(frontend): integrate template import into document editor

- [x] 10. Update router for project detail page
  What to do / Must NOT do: 更新路由配置，添加 /projects/:id 路由
  Parallelization: Wave 4 | Blocked by: T4-T9 | Blocks: T11
  References (executor has NO interview context - be exhaustive): frontend/src/router.tsx:81-83
  Acceptance criteria (agent-executable): 路由配置成功，可正确访问 /projects/:id
  QA scenarios (name the exact tool + invocation): 启动前端，访问 /projects/:id，验证页面渲染
  Commit: Y | feat(frontend): add project detail page route

- [x] 11. Update RecordManagement navigation
  What to do / Must NOT do: 更新 RecordManagement 组件，点击进入时导航到项目详情页
  Parallelization: Wave 4 | Blocked by: T10 | Blocks: -
  References (executor has NO interview context - be exhaustive): frontend/src/pages/records/RecordManagement.tsx:306-317
  Acceptance criteria (agent-executable): 点击进入按钮可正确导航到项目详情页
  QA scenarios (name the exact tool + invocation): 启动前端，点击进入按钮，验证导航
  Commit: Y | feat(frontend): update RecordManagement navigation

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [x] F1. Plan compliance audit
- [x] F2. Code quality review
- [x] F3. Real manual QA
- [x] F4. Scope fidelity

## Commit strategy
每个任务完成后提交一次，使用语义化提交信息。

## Success criteria
- 点击进入按钮可正确导航到项目详情页
- 项目详情页可正确渲染，包含右侧操作区
- 可切换项目信息、项目进度、项目文档三个功能页
- 项目文档页面包含富文本编辑器
- 可搜索并导入模板内容
- 所有功能正常工作，无明显 bug
