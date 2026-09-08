# 日程日历 Apple 风格改造 — 实施计划（Phase 1）

> 关联规格：`待办计划/日程日历Apple风格改造设计规格.md`
> 执行方式：inline（同一 session，文件间存在样式耦合，不拆分 subagent）
> TDD Route：off / skipped / post-change regression

## Goal

把 `pages/calendar/` 的视觉层统一到 `项目基定/UI设计规范.md`（Apple 风 token 体系），
新增列表视图与颜色筛选条，事件弹窗 Apple 化。**零后端改动。**

## Architecture

- 引擎：FullCalendar 6.1.21（`dayGridPlugin` + `timeGridPlugin` + `interactionPlugin` + `listPlugin`），
  `headerToolbar={false}` 隐藏内置工具条，自绘工具条经 `ref.getApi()` 驱动
- 视觉：`CalendarPage.module.css`（页面结构）+ `CalendarPage.global.css`（`.fc` 覆写）
  双文件分工不变，全部 token 引用 `src/styles/token.css`
- 事件色：`eventDidMount` 写 `--cal-event-color` 到事件 DOM，CSS 以 `color-mix()` 派生浅彩底
- 筛选：`ColorFilterBar.tsx` + `CalendarColors.ts`，状态在 `CalendarPage`，偏好存 localStorage

## Tech Stack

React 18 / TypeScript 5 / antd 5.29.3 / dayjs 1.11.21 / FullCalendar 6.1.21 / CSS Modules + 全局 CSS

## Baseline / Authority Refs

- `项目基定/UI设计规范.md`：token 语义与组件 recipe（`button-primary` / `segmented` / `option-chip` / `tag-primary` / `modal` / `input`）
- `项目基定/UI设计规范.md` 约束：单一交互蓝、hairline、无装饰渐变、无 chrome 阴影、无 Emoji、无 weight 500、按下用 scale
- `src/styles/token.css`：实际变量值（浅 `--canvas #ffffff` / 深 `#141414`；`--hairline` 浅 `#e0e0e0` / 深 `#434343`）
- `项目基定/开发基准文档.md` 第 5 章：代码规范、深浅色适配、禁 Emoji

## Compatibility Boundary

- `CalendarEventModal` props 契约不变（`open` / `editingEvent` / `defaultStart` / `defaultEnd` / `onClose` / `onSaved` / `onDelete`）
- 事件颜色继续存储 CSS 变量字符串（如 `var(--color-info)`），后端无感知
- 提交时间仍为 ISO 字符串；`datetime-local` → `DatePicker showTime` 仅改输入控件
- 权限说明弹窗、拖拽、选区新建、删除确认逻辑保留
- 不新增除 `@fullcalendar/list` 之外的依赖

## Change Necessity

- 用户可见需求：日历视觉与项目 Apple 设计基定割裂，且缺列表视图与筛选能力
- 无代码方案不成立：观感由 FullCalendar/antd 默认件决定，必须替换工具条与覆写样式；
  列表视图需新增插件；筛选需新增状态与组件
- 最小变更边界：仅 `pages/calendar/` 内 8 个文件 + `package.json`

## Task Batches

### Task 1 — 颜色常量与筛选条组件

**Files**：新增 `CalendarColors.ts`、`ColorFilterBar.tsx`、`ColorFilterBar.module.css`
**Change Necessity**：筛选需要单一事实来源的颜色→名称→计数映射，Phase 2 升级为分类时复用
**Impact**：新增文件，无调用方，无破坏
**Verification**：`npx tsc -b` 通过

1. 写 `CalendarColors.ts`：导出 `CALENDAR_COLORS`（8 项：`{value, name, label}`，
   `value` 为 `var(--color-info)` 等）、`DEFAULT_COLOR`、`colorName(value)`、`countByColor(events)`
2. 写 `ColorFilterBar.tsx`：props `{events, activeColors, onChange, total}`，
   渲染「全部」+ 8 色芯片，多选切换，计数来自当前事件集
3. 写 `ColorFilterBar.module.css`：`canvas-parchment` 容器 + `option-chip` 压缩芯片 + `tag-primary` 选中态
4. 跑 `npx tsc -b`

### Task 2 — 自绘工具条 + 列表视图 + 周起始日

**Files**：改 `CalendarPage.tsx`、`CalendarPage.module.css`
**Change Necessity**：内置 toolbar 无法呈现大月份标题/圆形导航/分段切换
**Impact**：页面组件内部重构，路由与数据流不变
**Verification**：`npx tsc -b` 通过；四视图切换与标题文案正确

1. 引入 `listPlugin`、`useState` 记录当前视图与当前日期
2. `headerToolbar={false}`，新增自绘工具条 JSX（导航组 / 标题 / segmented / 新建 / 说明）
3. 标题由 `view.type` + `api.getDate()` 用 `dayjs` 格式化；监听 `datesSet` 与 `viewDidMount` 同步 state
4. 加 `firstDay={1}`、`dayMaxEvents={3}`
5. 挂载 `ColorFilterBar`，在 `fetchEvents` 的 `successCallback` 前按 `activeColors` 过滤
6. 新建事件默认色：仅选中单一颜色时套用
7. 工具条样式写入 `CalendarPage.module.css`

### Task 3 — FullCalendar Apple 主题覆写

**Files**：改 `CalendarPage.global.css`
**Change Necessity**：`.fc` 默认件必须被整体替换为 hairline / 行动蓝 / 浅彩底事件
**Impact**：全局 CSS 仅作用于 `.fc`，不外溢
**Verification**：浅深双模式下无白块、无默认蓝/黄残留

1. 写浅模式 `.fc` 变量集：`--fc-border-color: var(--border-secondary)`、`--fc-page-bg-color: var(--canvas)`、
   `--fc-today-bg-color: var(--color-info-bg)`、`--fc-highlight-color`、`--fc-more-link-*` 等
2. 表头：`bg-secondary` 底 + `caption-strong` + 日号 `ink`
3. 今天：日号 `color-primary` 实心圆 24px 白字 + 列淡 `color-info-bg`
4. 事件：`.fc-event` 以 `!important` 覆盖内联色——周/日视图浅彩底 + 3px 左色条 + `ink` 字；
   月视图全天事件实色底白字；hover `--shadow-sm` + `scale(0.95)`
5. 时间轴 slot 44px；`+N 更多` 改 `text-link`
6. 列表视图：日期头 `caption-strong`、行 hover `bg-secondary`
7. 写 `[data-theme="dark"] .fc` 覆写：边框 `#303030`、事件浅彩底提至 `color-mix(28%)`
8. `eventDidMount` 注入 `--cal-event-color`（在 Task 2 的 `fetchEvents` 映射中加）

### Task 4 — 事件弹窗 Apple 化

**Files**：改 `CalendarEventModal.tsx`、新增 `CalendarEventModal.module.css`
**Change Necessity**：弹窗是日历交互入口，默认件会造成视觉割裂
**Impact**：props 契约不变；提交 payload 结构不变
**Verification**：`npx tsc -b` 通过；新建/编辑/删除/提醒/可见性不回归

1. `datetime-local` → antd `DatePicker showTime`（`dayjs` 值），提交时 `dayjs().toISOString()`
2. 引入 `CalendarColors.CALENDAR_COLORS`，色点选择器改 28px + 选中双层环 + tooltip 色名
3. 样式迁入 `CalendarEventModal.module.css`：标题 `heading-3`、标签 `caption-strong`、
   输入按规格 `input` recipe、footer「保存」胶囊 / 「取消」次级胶囊
4. 删除按钮改为文字危险按钮（`type="text" danger`），置于 footer 左侧

### Task 5 — 验证、日志、部署

1. `npx tsc -b` + `npm run build`
2. 写 `项目开发日志/` 日志（按格式模板，含文件清单与一致性确认）
3. `git add` + 提交
4. `bash 项目文件/start.sh` 重部署
5. 浏览器冒烟：四视图 / 浅深 / 筛选 / 弹窗

## Risks

| 风险 | 处置 |
|------|------|
| `.fc-event` 内联色覆盖失败 | CSS 用 `!important` + 作用域限 `.fc` |
| `DatePicker` 时间偏移 | 提交统一 `toISOString()`，本地时间语义不变 |
| `color-mix` 在深色下可读性 | 深色分支提至 28% |
| 工具条与网格标题重复 | `headerToolbar={false}` 彻底隐藏内置工具条 |

## Retirement

- 旧 `headerToolbar` 配置、旧 `.fc-toolbar-title` / `.fc-button-primary` 覆写规则在 Task 3 中删除（不再引用）
- `PRESET_COLORS` 常量在 `CalendarEventModal.tsx` 中删除，改从 `CalendarColors.ts` 引入（单一事实来源）
- 无 fallback / compat 路径残留；无数据迁移

## Verification

```bash
cd 项目文件/frontend && npx tsc -b && npm run build
```
