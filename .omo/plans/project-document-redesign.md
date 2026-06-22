# project-document-redesign - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** 重新设计的项目文档Tab，文档列表按分类分组显示（可收起展开），顶部有搜索栏，右侧有新增分类和新增文档按钮，编辑模式下点击"套用模板"按钮弹出浮窗显示模板列表（浮窗内容先空着）。

**Why this approach:** 用户要求改进文档管理体验，需要文档列表、分类、编辑和模板套用功能。

**What it will NOT do:** 不实现复杂的文档权限、版本控制或多人协作。

**Effort:** Medium
**Risk:** Low - 重构现有组件，保持数据结构兼容
**Decisions to sanity-check:** 文档分类方式、编辑模式交互

Your next move: approve. Full execution detail follows below.

---

> TL;DR (machine): Medium effort, Low risk, deliverables: Redesigned ProjectDocumentTab with collapsible categories, document list, edit mode, and template modal

## Scope
### Must have
- 重构 ProjectDocumentTab 为两层结构：文档列表 + 编辑模式
- 文档列表按分类分组显示，每个分类可收起展开
- 顶部搜索栏，右侧新增分类按钮（蓝色）和新增文档按钮（蓝色）
- 实现文档编辑模式（点击文档进入编辑）
- 编辑模式下点击"套用模板"按钮弹出浮窗，浮窗内容先空着
- 保持现有数据结构兼容

### Must NOT have (guardrails, anti-slop, scope boundaries)
- 不实现复杂的文档权限管理
- 不实现文档版本控制
- 不实现多人协作编辑

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after + manual QA
- Evidence: .omo/evidence/task-N-project-document-redesign.<ext>

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

**Wave 1: 重构文档Tab**
- T1: 重构 ProjectDocumentTab 组件架构
- T2: 添加文档分类功能（可收起展开）
- T3: 实现文档编辑模式
- T4: 实现模板浮窗功能

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| T1 | - | T2, T3, T4 | - |
| T2 | T1 | - | T3, T4 |
| T3 | T1 | - | T2, T4 |
| T4 | T1 | - | T2, T3 |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

- [ ] 1. 重构 ProjectDocumentTab 组件架构
  What to do / Must NOT do: 将组件重构为两层结构：文档列表模式和编辑模式，文档列表按分类分组显示（可收起展开）
  Parallelization: Wave 1 | Blocked by: - | Blocks: T2, T3, T4
  References (executor has NO interview context - be exhaustive): frontend/src/pages/projects/tabs/ProjectDocumentTab.tsx:1-310
  Acceptance criteria (agent-executable): 组件支持文档列表和编辑两种模式，文档列表按分类分组显示
  QA scenarios (name the exact tool + invocation): 启动前端，验证文档列表按分类分组显示和编辑模式切换
  Commit: Y | feat(frontend): refactor ProjectDocumentTab architecture

- [ ] 2. 添加文档分类功能（可收起展开）
  What to do / Must NOT do: 顶部搜索栏，右侧新增分类按钮（蓝色）和新增文档按钮（蓝色），文档列表按分类分组，每个分类可收起展开
  Parallelization: Wave 1 | Blocked by: T1 | Blocks: -
  References (executor has NO interview context - be exhaustive): frontend/src/pages/projects/tabs/ProjectDocumentTab.tsx
  Acceptance criteria (agent-executable): 搜索栏和按钮布局正确，文档按分类分组，可收起展开
  QA scenarios (name the exact tool + invocation): 启动前端，验证搜索栏和按钮布局，验证分类收起展开功能
  Commit: Y | feat(frontend): add document category feature

- [ ] 3. 实现文档编辑模式
  What to do / Must NOT do: 点击文档进入编辑模式，显示返回按钮和保存状态
  Parallelization: Wave 1 | Blocked by: T1 | Blocks: -
  References (executor has NO interview context - be exhaustive): frontend/src/pages/projects/tabs/ProjectDocumentTab.tsx
  Acceptance criteria (agent-executable): 点击文档可进入编辑，返回按钮可回到列表
  QA scenarios (name the exact tool + invocation): 启动前端，点击文档验证编辑模式
  Commit: Y | feat(frontend): implement document edit mode

- [ ] 4. 实现模板浮窗功能
  What to do / Must NOT do: 编辑模式下点击"套用模板"按钮弹出浮窗，浮窗内容先空着
  Parallelization: Wave 1 | Blocked by: T1 | Blocks: -
  References (executor has NO interview context - be exhaustive): frontend/src/pages/projects/tabs/ProjectDocumentTab.tsx
  Acceptance criteria (agent-executable): 编辑模式下点击"套用模板"按钮可弹出浮窗
  QA scenarios (name the exact tool + invocation): 启动前端，编辑文档时点击"套用模板"按钮验证浮窗弹出
  Commit: Y | feat(frontend): implement template modal feature

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
- [ ] F2. Code quality review
- [ ] F3. Real manual QA
- [ ] F4. Scope fidelity

## Commit strategy
每个任务完成后提交一次，使用语义化提交信息。

## Success criteria
- 文档列表按分类分组显示，每个分类可收起展开
- 顶部搜索栏，右侧新增分类按钮（蓝色）和新增文档按钮（蓝色）
- 点击文档可进入编辑模式
- 编辑模式下点击"套用模板"按钮可弹出浮窗
- 返回按钮可回到文档列表
- 所有功能正常工作，无明显 bug
