# five-feature-tasks - Work Plan

## TL;DR (For humans)

**What you'll get:** 五个功能模块的完整实现：文件有效期、文件夹统一管理、物品管理、设备管理退出登录、日历功能。

**Why this approach:** 基于现有代码模式，复用现有组件和API结构，确保一致性。

**What it will NOT do:** 不修改现有核心功能，不影响现有数据。

**Effort:** Large
**Risk:** Medium - 涉及多个模块，需要仔细测试
**Decisions to sanity-check:** 文件夹统一管理模式、物品管理字段设计

Your next move: approve. Full execution detail follows below.

---

> TL;DR (machine): Large effort, Medium risk, deliverables: 5 feature modules

## Scope
### Must have
1. 文件管理：文件有效期设置功能
2. 文件夹管理：统一管理开关 + 与文件一致的设置
3. 物品管理：新模块，记录管理物品
4. 设备管理：添加退出登录按钮，验证用户隔离
5. 日历功能：确保日历功能完整可用

### Must NOT have (guardrails, anti-slop, scope boundaries)
- 不修改现有核心功能
- 不影响现有数据
- 不引入破坏性变更

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after + manual QA
- Evidence: .omo/evidence/task-N-five-feature-tasks.<ext>

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

**Wave 1: 文件管理增强**
- T1: 文件有效期设置功能
- T2: 文件夹统一管理功能

**Wave 2: 新模块开发**
- T3: 物品管理模块（后端）
- T4: 物品管理模块（前端）

**Wave 3: 设置和日历**
- T5: 设备管理退出登录功能
- T6: 日历功能完善

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| T1 | - | T2 | - |
| T2 | T1 | - | T3, T4, T5, T6 |
| T3 | - | T4 | T1, T2, T5, T6 |
| T4 | T3 | - | T1, T2, T5, T6 |
| T5 | - | - | T1, T2, T3, T4, T6 |
| T6 | - | - | T1, T2, T3, T4, T5 |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

- [ ] 1. 文件有效期设置功能
  What to do / Must NOT do: 在文件管理中添加有效期设置功能，支持设置文件过期时间
  Parallelization: Wave 1 | Blocked by: - | Blocks: T2
  References (executor has NO interview context - be exhaustive): backend/app/models/file.py:44-46, frontend/src/pages/files/FileManagement.tsx
  Acceptance criteria (agent-executable): 文件可设置过期时间，过期后自动标记
  QA scenarios (name the exact tool + invocation): 创建文件，设置过期时间，验证过期逻辑
  Commit: Y | feat(files): add file expiration date setting

- [ ] 2. 文件夹统一管理功能
  What to do / Must NOT do: 文件夹添加统一管理开关，开启后子文件继承文件夹设置
  Parallelization: Wave 1 | Blocked by: T1 | Blocks: -
  References (executor has NO interview context - be exhaustive): backend/app/models/folder.py:43-45, frontend/src/pages/files/FolderTree.tsx
  Acceptance criteria (agent-executable): 文件夹可设置统一管理，子文件继承设置
  QA scenarios (name the exact tool + invocation): 创建文件夹，开启统一管理，验证子文件继承
  Commit: Y | feat(folders): add unified management feature

- [ ] 3. 物品管理模块（后端）
  What to do / Must NOT do: 创建物品管理后端API，包括模型、Schema、API端点
  Parallelization: Wave 2 | Blocked by: - | Blocks: T4
  References (executor has NO interview context - be exhaustive): backend/app/models/task.py, backend/app/api/tasks.py
  Acceptance criteria (agent-executable): 物品管理API可正常工作
  QA scenarios (name the exact tool + invocation): 使用curl测试物品管理API
  Commit: Y | feat(backend): add inventory management API

- [ ] 4. 物品管理模块（前端）
  What to do / Must NOT do: 创建物品管理前端页面，包括列表、创建、编辑、删除功能
  Parallelization: Wave 2 | Blocked by: T3 | Blocks: -
  References (executor has NO interview context - be exhaustive): frontend/src/pages/tasks/TaskManagement.tsx
  Acceptance criteria (agent-executable): 物品管理页面可正常工作
  QA scenarios (name the exact tool + invocation): 访问物品管理页面，测试CRUD操作
  Commit: Y | feat(frontend): add inventory management page

- [ ] 5. 设备管理退出登录功能
  What to do / Must NOT do: 在设备管理页面添加退出登录按钮，验证用户隔离
  Parallelization: Wave 3 | Blocked by: - | Blocks: -
  References (executor has NO interview context - be exhaustive): frontend/src/pages/settings/DeviceManagement.tsx
  Acceptance criteria (agent-executable): 设备管理页面可退出登录，用户数据隔离正确
  QA scenarios (name the exact tool + invocation): 测试退出登录功能，验证用户隔离
  Commit: Y | feat(settings): add logout button to device management

- [ ] 6. 日历功能完善
  What to do / Must NOT do: 确保日历功能完整可用，修复已知问题
  Parallelization: Wave 3 | Blocked by: - | Blocks: -
  References (executor has NO interview context - be exhaustive): frontend/src/pages/calendar/CalendarPage.tsx
  Acceptance criteria (agent-executable): 日历功能正常工作，可创建、编辑、删除事件
  QA scenarios (name the exact tool + invocation): 测试日历CRUD操作
  Commit: Y | feat(calendar): ensure calendar functionality works

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
- [ ] F2. Code quality review
- [ ] F3. Real manual QA
- [ ] F4. Scope fidelity

## Commit strategy
每个任务完成后提交一次，使用语义化提交信息。

## Success criteria
- 文件可设置过期时间
- 文件夹可设置统一管理
- 物品管理功能完整可用
- 设备管理可退出登录
- 日历功能正常工作
- 所有功能经过验证无错误
