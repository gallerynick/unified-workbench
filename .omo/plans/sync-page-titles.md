# sync-page-titles - Work Plan

## TL;DR (For humans)

**What you'll get:** 点击侧边栏任意菜单项后，页面顶部固定标题栏会显示与侧边栏完全相同的标题文字（同一个数据源），标题位置固定不随滚动移动。

**Why this approach:** 创建一个共享的路由→标题映射文件，侧边栏菜单和顶部标题栏都读取这个映射，确保两者永远一致。标题放在已有的 sticky Header 中，无需新增固定定位元素。

**What it will NOT do:** 不会删除各页面组件内部已有的 `<Title>` 标题（避免大规模改动），只在 Header 中新增同步标题。

**Effort:** Quick
**Risk:** Low - 仅新增一个配置文件和修改一个布局文件
**Decisions to sanity-check:** 标题放在 Header 左侧（折叠按钮之后）还是 Header 下方独立一行

Your next move: 批准后执行。

---

> TL;DR (machine): Quick, Low risk, 创建共享路由标题映射 + Header 中添加固定页面标题

## Scope
### Must have
- 创建 `frontend/src/config/routeTitles.ts`，包含所有路由路径→中文标题的映射
- `MainLayout.tsx` 的 Header 中添加当前页面标题，使用 `getRouteTitle(location.pathname)` 获取
- 标题位置：Header 左侧（折叠按钮之后），字号 16px 加粗
- 侧边栏菜单标签也引用同一映射（可选优化，当前标签已与映射一致）
- 动态路由支持：`/projects/:id` → "项目详情"，`/secrets/category/:categoryId` → "密钥分类"
### Must NOT have (guardrails, anti-slop, scope boundaries)
- 不删除各页面组件内部的 `<Title>` 元素
- 不修改路由配置
- 不改变 Header 现有的右侧内容（通知铃铛 + 用户头像）
- 不改变侧边栏的折叠/展开行为

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: none（纯 UI 样式变更，无业务逻辑）
- Evidence: .omo/evidence/task-N-sync-page-titles.<ext>

## Execution strategy
### Parallel execution waves
> 2 个 todo，1 个 wave（顺序依赖）

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | - | 2 | - |
| 2 | 1 | - | - |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. 创建共享路由标题映射文件
  What to do / Must NOT do: 创建 `项目文件/frontend/src/config/routeTitles.ts`，导出 `ROUTE_TITLES` 常量和 `getRouteTitle(pathname)` 函数。映射包含所有路由：`/`→"首页"、`/tasks`→"任务管理"、`/contacts`→"客户管理"、`/calendar`→"日历"、`/votes`→"投票决策"、`/forms`→"表单收集"、`/members`→"成员目录"、`/announcements`→"公告中心"、`/notes`→"笔记知识库"、`/files`→"文件管理"、`/content`→"内容管理"、`/projects`→"项目管理"、`/inventory`→"物品管理"、`/finance`→"财务管理"、`/secrets`→"密钥管理"、`/reminders`→"提醒管理"、`/records`→"记录管理"、`/settings/personalization`→"用户个性化"、`/audit`→"审计日志"、`/settings`→"系统设置与管理"、`/settings/users`→"用户管理"、`/settings/tags`→"标签管理"、`/settings/templates`→"模板管理"、`/settings/site`→"站点配置"、`/settings/sidebar`→"侧边栏管理"、`/settings/devices`→"设备管理"、`/settings/notifications`→"通知配置"、`/settings/backups`→"备份管理"、`/settings/customization`→"应用配置"、`/profile`→"个人资料"。`getRouteTitle` 函数处理动态路由：`pathname.startsWith('/projects/')`→"项目详情"，`pathname.startsWith('/secrets/category/')`→"密钥分类"，无匹配返回空字符串。Must NOT do: 不包含任何业务逻辑，不导入 React 或 antd。
  Parallelization: Wave 1 | Blocked by: - | Blocks: 2
  References: `项目文件/frontend/src/router.tsx`（所有路由定义）、`项目文件/frontend/src/layouts/MainLayout.tsx:70-114`（getMenuItems 中的标签定义）、`项目文件/frontend/src/pages/settings/SidebarManagement.tsx:20-37`（DEFAULT_ITEMS 标签定义）
  Acceptance criteria: `node -e "const m = require('./项目文件/frontend/src/config/routeTitles.ts'); console.log(m.getRouteTitle('/calendar'))"` 输出 "日历"
  QA scenarios: 运行 `cd 项目文件/frontend && npx tsc --noEmit src/config/routeTitles.ts` 确认无类型错误，Evidence .omo/evidence/task-1-sync-page-titles.txt
  Commit: N（与 task 2 一起提交）

- [ ] 2. MainLayout.tsx Header 中添加同步页面标题 + 构建部署提交
  What to do / Must NOT do: 在 `项目文件/frontend/src/layouts/MainLayout.tsx` 中：1) 导入 `getRouteTitle` from `../../config/routeTitles`；2) 在 Header 的 `<Space>` 左侧区域（折叠按钮之后）添加 `<Text strong style={{ fontSize: 16, marginLeft: 8 }}>{getRouteTitle(location.pathname)}</Text>`；3) 确保标题文字在 Header 中垂直居中。构建前端 `npm run build`，部署 `docker compose -p unified-workbench up --build -d frontend nginx`，验证 `curl -s http://localhost/api/v1/health`。Git 提交：`feat: 侧边栏与顶部标题同步，使用共享路由标题映射`。Must NOT do: 不删除各页面内部 Title，不修改路由，不改变 Header 右侧内容。
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: -
  References: `项目文件/frontend/src/layouts/MainLayout.tsx:244-301`（Header 组件结构）、`项目文件/frontend/src/layouts/MainLayout.tsx:127-138`（MainLayout 函数，location 变量在 line 131）
  Acceptance criteria: `curl -s http://localhost/api/v1/health` 返回 `{"code":0}`，前端构建无错误
  QA scenarios: 构建成功 + 容器运行 + 后端健康检查通过，Evidence .omo/evidence/task-2-sync-page-titles.txt
  Commit: Y | feat(sync-titles): 侧边栏与顶部标题同步，使用共享路由标题映射

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
- [ ] F2. Code quality review
- [ ] F3. Real manual QA
- [ ] F4. Scope fidelity

## Commit strategy
单次提交：`feat: 侧边栏与顶部标题同步，使用共享路由标题映射`

## Success criteria
1. `routeTitles.ts` 文件存在且导出 ROUTE_TITLES 和 getRouteTitle
2. MainLayout.tsx Header 中显示当前页面标题
3. 标题文字与侧边栏选中项标签完全一致
4. 标题位置固定（Header 已有 sticky positioning）
5. 前端构建成功
6. Docker 容器运行正常
7. Git 提交完成
