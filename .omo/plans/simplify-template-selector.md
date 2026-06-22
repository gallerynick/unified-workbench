# simplify-template-selector - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** 简化的模板选择器，只显示搜索栏和模板列表，移除分类选择。模板管理中可以设置模板的位置属性（项目、记录、全局），选择器根据位置自动过滤。

**Why this approach:** 用户明确要求简化UI，移除分类选择。通过添加位置字段实现模板的定向显示，保持灵活性。

**What it will NOT do:** 不修改现有模板数据，不实现复杂的位置管理逻辑。

**Effort:** Quick
**Risk:** Low - 简单的UI调整和字段添加
**Decisions to sanity-check:** 位置字段的枚举值定义

Your next move: approve. Full execution detail follows below.

---

> TL;DR (machine): Quick effort, Low risk, deliverables: Simplified TemplateSelector + location field

## Scope
### Must have
- 简化 TemplateSelector 组件，移除分类选择
- 添加模板位置字段（project, record, global）
- 更新模板编辑器支持设置位置
- 更新模板管理页面显示位置信息
- TemplateSelector 根据位置过滤模板

### Must NOT have (guardrails, anti-slop, scope boundaries)
- 不修改现有模板数据（保持向后兼容）
- 不实现复杂的位置管理逻辑

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after + manual QA
- Evidence: .omo/evidence/task-N-simplify-template-selector.<ext>

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

**Wave 1: Backend changes**
- T1: Add location field to Template model
- T2: Update Template schemas
- T3: Update Template API to support location filter

**Wave 2: Frontend changes**
- T4: Simplify TemplateSelector component
- T5: Update TemplateEditor to support location field
- T6: Update TemplateManagement to display location

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| T1 | - | T2, T3 | - |
| T2 | T1 | T4-T6 | T3 |
| T3 | T1 | T4-T6 | T2 |
| T4 | T2, T3 | - | T5, T6 |
| T5 | T2 | - | T4, T6 |
| T6 | T2 | - | T4, T5 |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

- [x] 1. Add location field to Template model
  What to do / Must NOT do: 在 template 表添加 location 字段，枚举值 project/record/global，默认 global
  Parallelization: Wave 1 | Blocked by: - | Blocks: T2, T3
  References (executor has NO interview context - be exhaustive): backend/app/models/template.py:20-48
  Acceptance criteria (agent-executable): 模型更新成功，可通过 Alembic 迁移
  QA scenarios (name the exact tool + invocation): 运行 alembic upgrade head，验证字段添加成功
  Commit: Y | feat(backend): add location field to template model

- [x] 2. Update Template schemas
  What to do / Must NOT do: 更新 Pydantic 模型，添加 location 字段
  Parallelization: Wave 1 | Blocked by: T1 | Blocks: T4-T6
  References (executor has NO interview context - be exhaustive): backend/app/schemas/template.py:27-80
  Acceptance criteria (agent-executable): Pydantic 模型更新成功
  QA scenarios (name the exact tool + invocation): 运行 Python 测试，验证模型验证逻辑
  Commit: Y | feat(backend): update template schemas with location field

- [x] 3. Update Template API to support location filter
  What to do / Must NOT do: 更新模板列表 API，支持按 location 过滤
  Parallelization: Wave 1 | Blocked by: T1 | Blocks: T4-T6
  References (executor has NO interview context - be exhaustive): backend/app/api/templates.py:45-56
  Acceptance criteria (agent-executable): API 支持 location 查询参数
  QA scenarios (name the exact tool + invocation): 使用 curl 测试带 location 参数的请求
  Commit: Y | feat(backend): add location filter to template API

- [x] 4. Simplify TemplateSelector component
  What to do / Must NOT do: 移除分类选择器，简化UI，添加 location 过滤参数
  Parallelization: Wave 2 | Blocked by: T2, T3 | Blocks: -
  References (executor has NO interview context - be exhaustive): frontend/src/pages/projects/TemplateSelector.tsx:1-224
  Acceptance criteria (agent-executable): 组件简化成功，只显示搜索栏和模板列表
  QA scenarios (name the exact tool + invocation): 启动前端，打开模板选择器，验证UI简化
  Commit: Y | feat(frontend): simplify template selector component

- [x] 5. Update TemplateEditor to support location field
  What to do / Must NOT do: 在模板编辑器中添加位置选择字段
  Parallelization: Wave 2 | Blocked by: T2 | Blocks: -
  References (executor has NO interview context - be exhaustive): frontend/src/pages/templates/TemplateEditor.tsx:1-372
  Acceptance criteria (agent-executable): 编辑器支持设置模板位置
  QA scenarios (name the exact tool + invocation): 启动前端，编辑模板，验证位置字段可设置
  Commit: Y | feat(frontend): add location field to template editor

- [x] 6. Update TemplateManagement to display location
  What to do / Must NOT do: 在模板管理表格中显示位置列
  Parallelization: Wave 2 | Blocked by: T2 | Blocks: -
  References (executor has NO interview context - be exhaustive): frontend/src/pages/templates/TemplateManagement.tsx:188-261
  Acceptance criteria (agent-executable): 表格显示位置列
  QA scenarios (name the exact tool + invocation): 启动前端，查看模板管理页面，验证位置列显示
  Commit: Y | feat(frontend): display location in template management

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [x] F1. Plan compliance audit
- [x] F2. Code quality review
- [x] F3. Real manual QA
- [x] F4. Scope fidelity

## Commit strategy
每个任务完成后提交一次，使用语义化提交信息。

## Success criteria
- TemplateSelector 组件简化成功，只显示搜索栏和模板列表
- 模板位置字段添加成功，支持 project/record/global
- 模板编辑器支持设置位置
- 模板管理页面显示位置信息
- 所有功能正常工作，无明显 bug
