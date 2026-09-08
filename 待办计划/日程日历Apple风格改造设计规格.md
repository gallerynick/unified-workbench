# 日程日历 Apple 风格改造 — 设计规格（Phase 1）

> 状态：**已实施**（2026-09-08，提交 cedea61 / 124f339，开发日志 097）
> 版本：v2.0.0
> 范围：`项目文件/frontend/src/pages/calendar/`（纯前端）
> 权威依据：`项目基定/UI设计规范.md`、`项目基定/开发基准文档.md` 第 5 章

---

## 一、背景与问题

当前 `CalendarPage` 使用 FullCalendar（`dayGridMonth` / `timeGridWeek` / `timeGridDay`）渲染日历，
交互与数据逻辑完整可用，但**视觉层被 FullCalendar 默认件与 antd 默认件覆盖**，与项目已确立的
Apple 风设计语言割裂：

1. **工具条是 FullCalendar 默认件**——小标题（1.75em）、灰底圆角按钮，无 Apple 的大月份标题、
   「今天」药丸、分段视图切换。
2. **网格是 FullCalendar 默认件**——`#ddd` 实线网格、默认表头、默认 today 高亮（黄色 15% 透明底），
   与规格中的 hairline（`#e0e0e0`）/ 行动蓝（`#0066cc`）体系不符。
3. **事件是实心色块**——`backgroundColor` 直接铺满，无 Apple Calendar 的「左色条 + 浅彩底 + 深字」语言。
4. **弹窗是 antd 默认表单**——`datetime-local` 原生控件、圆形色点无选中态环、footer 按钮非胶囊形。
5. **无列表视图、无筛选能力**——长事件无法一览，无法按颜色收敛视图。
6. 周起始日为周日（FullCalendar 默认），与中文惯例及 Apple Calendar 中文版不一致。

> 关键前提：项目的 UI 基定本就是 Apple 风（`DESIGN.md` name 即 `Apple-design-analysis`，
> `primary #0066cc` / `primary-focus #0071e3` / `canvas-parchment #f5f5f7` / 系统字体栈）。
> 本次改造是**让日历回归既有基定**，不是引入新设计语言。

## 二、设计目标

1. 日历主体（工具条 / 网格 / 事件）与事件弹窗统一到 `项目基定/UI设计规范.md` 的 token 体系，
   达成 Apple Calendar.app 的观感：大月份标题、圆形导航、「今天」药丸、hairline 网格、
   左色条浅彩底事件、胶囊按钮。
2. 新增**列表视图**（对应 Apple Calendar 的「列表」），长事件可按日期分组一览。
3. 新增**颜色筛选条**，可按事件的 `color` 收敛显示并显示计数。
4. 周起始日改为**周一**。
5. 浅色 / 深色双模式完整适配；图标仅使用 `@ant-design/icons`；无 Emoji。
6. **零后端改动**：不改数据模型、不改 API、不做迁移。

## 三、已确认的决策（用户拍板）

| 决策点 | 结论 |
|--------|------|
| 改造档位 | **B 档视觉深度改造**，保留 FullCalendar 引擎 |
| 方案 | **FullCalendar 深覆写 + 自绘工具条**（非自绘组件、非仅换主题 CSS） |
| 事件弹窗 | **一起 Apple 化**（与日历视觉一致），但**不偏离 UI 设计规范** |
| 视图范围 | 月 / 周 / 日 + **新增列表视图** |
| 分类深度 | **分两期**：本期基于现有 `color` 做筛选；命名分类体系留 Phase 2 |
| 筛选形态 | **不占大块区域**——放在工具条正下方**一行**，不做侧栏 |
| 周起始日 | 周一（`firstDay: 1`） |
| 列表视图锚点 | 当周（`listWeek`，7 个日期分组） |

## 四、范围边界

### 本期做（Phase 1）

- 自绘 Apple 风格工具条，替代 FullCalendar 内置 toolbar
- FullCalendar 全套 CSS 覆写（浅深双模式）
- 事件视觉改为「左色条 + 浅彩底 + 深字」（周/日视图）、「实色圆点 + 白字」（月视图全天事件）
- 新增列表视图
- 新增颜色筛选条（一行）+ 计数
- 事件弹窗 Apple 化（含 `datetime-local` → antd `DatePicker showTime`）
- 周起始日周一

### 本期不做（明确非目标）

- **任何后端改动**：不改 `calendar_event` 表、不做 Alembic 迁移、不改 API schema/路由/service
- 不改动 `CalendarEventModal` 的 props 契约与「共用弹窗」定位（T6 抽取成果保留）
- 不改可见性逻辑（`visibility` / `restricted_users`）、提醒链路（`reminder_enabled` 等）、
  拖拽移动语义、事件增删改查语义、权限说明弹窗结构（仅轻量 token 对齐）
- 不做命名分类体系（`calendar_category` 表、分类 CRUD、事件归属）——Phase 2
- 不做侧栏式分类面板、不做移动端专门布局
- 不引入 FullCalendar Premium / 付费插件
- 不新增除 `@fullcalendar/list` 以外的依赖

## 五、技术前提（已核实）

| 项 | 事实 |
|----|------|
| 深色模式机制 | `:root[data-theme="dark"]` 切 token，定义于 `src/styles/token.css`；`--canvas` 深色 `#141414`、`--hairline` 深色 `#434343` |
| 颜色 token | 8 个事件色 `--color-info`/`-success`/`-warning`/`-error`/`-purple`/`-cyan`/`-magenta`/`-orange-bright` 在浅深两套中均有定义 |
| 事件 color 存储 | `var(--color-info)` 这类 **CSS 变量字符串**（`CalendarEventModal.PRESET_COLORS`），可直接作为 CSS 值参与 `color-mix()` 求值 |
| FullCalendar 版本 | 6.1.21；`EventInput` 支持 `backgroundColor` / `borderColor` / `textColor` / `classNames` / `eventDidMount`，**不支持 `style`** |
| 事件颜色注入点 | 通过 `eventDidMount` 在事件 DOM 上写 `--cal-event-color` 自定义属性，CSS 侧统一消费 |
| `@fullcalendar/list` | 已安装 6.1.21，提供 `listPlugin` 与 `listDay` / `listWeek` / `listMonth` 视图 |
| 浏览器 | Chrome / Edge / Firefox 最新版 → `color-mix(in srgb, …)` 可用 |

## 六、界面结构

```text
┌────────────────────────────────────────────────────────────────────────┐
│ [ ‹ | 今天 | › ]        2026年9月        [ 月 周 日 列表 ]  [+ 新建事件] ⊙  │  ← 工具条（自绘）
├────────────────────────────────────────────────────────────────────────┤
│ ● 全部 12   ● 蓝 5   ● 绿 3   ● 黄 2   ● 红 2   ● 紫 1   ● 青 1   ● 粉 1    │  ← 筛选条（新增，一行）
├────────────────────────────────────────────────────────────────────────┤
│   FullCalendar（月 / 周 / 日 / 列表，内置 toolbar 隐藏）                  │
└────────────────────────────────────────────────────────────────────────┘
```

## 七、工具条设计

| 区块 | 内容与 token |
|------|-------------|
| 左·导航组 | 圆角矩形容器（`rounded.sm 8px` + `hairline` 描边 + `canvas` 底）；内含 `‹` / `今天` / `›` 三个按钮，按钮间 `divider-soft` 竖线；hover 底 `bg-tertiary`；字号 `button-utility` 14px |
| 中·标题 | 月份标题用 `heading-1`（32px / 600）+ 字距 `-0.3px`，色 `ink`；周视图显示 `M月D日 – M月D日`；日视图显示 `M月D日 星期X`；列表视图显示对应周区间 |
| 右·视图切换 | 规格 `segmented`：底 `bg-tertiary`、文字 `text-secondary`、选中字 `color-info` 且底 `canvas`、`rounded.sm`；项：月 / 周 / 日 / 列表 |
| 右·新建 | `button-primary`：`color-primary` 底 + `on-primary` 字 + `rounded.pill 9999px` + padding 11px 22px + `PlusOutlined` |
| 右·说明 | `QuestionCircleOutlined` 图标按钮，色 `ink-muted-48`，打开既有权限说明弹窗 |
| 交互 | 按下态 `transform: scale(0.95)`（规格要求以缩放表达按压，而非变色）；键盘焦点 `outline: 2px solid var(--color-primary-focus)` |

工具条数据源：`ref.getApi()` 的 `getDate()` 与 `getView()`，标题由前端格式化（不依赖 FullCalendar 的 title 文案）。

## 八、筛选条设计

| 项 | 处理 |
|----|------|
| 位置 | 工具条正下方一行，高约 40px |
| 容器 | `canvas-parchment` 底 + `rounded.sm 8px` + `hairline` 描边 + padding 8px |
| 芯片 | `option-chip` 压缩版：`canvas` 底 / `rounded.pill` / padding 6px 12px / `caption` 14px |
| 色点 | 8px 圆点，取该色 token |
| 名称 | 颜色中文映射：蓝 / 绿 / 黄 / 红 / 紫 / 青 / 粉 / 橙 |
| 计数 | 当前视图可见范围内该色事件数，色 `text-secondary` |
| 「全部」芯片 | 无色点（用 `FilterOutlined`），选中时等价于全选 |
| 选中态 | `tag-primary`：`color-info-bg` 底 + `color-info` 字 |
| 未选中 | 文字 `ink-muted-48`，色点保持原色 |
| 多选 | 支持；点击切换；「全部」一键全选 |
| 新建联动 | 仅当选中单一颜色时，新建事件默认套该色 |
| 持久化 | 筛选偏好存 `localStorage`（key: `calendar.activeColors`），仅视图偏好，不进后端 |
| 组件 | `ColorFilterBar.tsx` 自洽组件；颜色常量与名称映射集中在 `CalendarColors.ts`，Phase 2 升级为分类时复用 |

## 九、网格与事件设计

| 项 | 处理 |
|----|------|
| 边框 | `--fc-border-color: var(--border-secondary)`，全部 hairline |
| 表头 | 底 `bg-secondary`；`caption-strong` 14px/600；日号 `ink`，周几 `text-secondary` |
| 今天 | 整列极淡 `color-info-bg`；日号进 `color-primary` 实心圆（`rounded.full`，24px，白字） |
| 周/日视图事件 | 底 `color-mix(色 16%, transparent)`；左侧 3px 实色条；文字 `ink`；`rounded.xs 5px`；`body-xs` 12px；hover `--shadow-sm` + `scale(0.95)`；无边框 |
| 月视图全天事件 | 实色底 + 白字 + `rounded.xs`，与周视图区分 |
| 月视图非全天事件 | 同周视图（浅彩底 + 左色条） |
| 「+N 更多」 | `text-link`（`color-primary`），去除灰底 |
| 时间轴 | slot 高 40→44px；时间标签 `text-tertiary` 12px；时间线 hairline |
| 列表视图 | 按日分组；日期头 `caption-strong`；行内 `color-info-bg` 圆点 + 标题 `body-sm`；行 hover `bg-secondary` |
| 深色模式 | 全部走 token（`--border-secondary` 深色 `#303030`、`--hairline` 深色 `#434343`、`-dark` 色变体），事件浅彩底在深色下改用 `color-mix(色 28%, transparent)` 保证可读 |

## 十、事件弹窗设计

| 项 | 处理 |
|----|------|
| 容器 | 宽 560 / `rounded.sm 8px` / `canvas` 底 / `shadow-md` / padding 24 |
| 标题 | `heading-3` 20px/600（新建事件 / 编辑事件） |
| 标签 | `caption-strong` 14px/600 |
| 输入 | 规格 `input`：高 32 / `rounded.sm` / `border-primary`；焦点 `border: color-info` + `0 0 0 2px rgba(22,119,255,0.1)` |
| 起止时间 | `datetime-local` 原生控件 → antd `DatePicker showTime`（与站内统一） |
| 颜色选择器 | 28px 圆点；选中态双层环（内圆 + 外圈 `ink` 环留白）；hover 显示色名 tooltip |
| footer | 「保存」→ `button-primary` 胶囊；「取消」→ `button-secondary-pill`（`canvas` 底 + `color-primary` 字） |
| 其余 | `Switch` / `Select` / `VisibilitySetting` 沿用 antd 主题，不重造 |

## 十一、涉及文件

| 动作 | 文件 |
|------|------|
| 新增依赖 | `@fullcalendar/list@6.1.21`（`package.json` + `package-lock.json`） |
| 新增 | `frontend/src/pages/calendar/CalendarColors.ts` |
| 新增 | `frontend/src/pages/calendar/ColorFilterBar.tsx` |
| 新增 | `frontend/src/pages/calendar/CalendarEventModal.module.css` |
| 修改 | `frontend/src/pages/calendar/CalendarPage.tsx` |
| 修改 | `frontend/src/pages/calendar/CalendarPage.module.css` |
| 修改 | `frontend/src/pages/calendar/CalendarPage.global.css` |
| 修改 | `frontend/src/pages/calendar/CalendarEventModal.tsx` |

不新增目录、不新增全局组件、不改路由。

## 十二、验收标准

1. `npx tsc -b` 零错误；`npm run build` 通过
2. 月 / 周 / 日 / 列表四视图可切换，事件渲染正确；标题文案随视图正确变化
3. 拖拽移动、点击编辑、空白处选区新建、删除、权限说明弹窗均不回归
4. 筛选条按颜色收敛显示，计数正确；多选与「全部」行为正确；偏好刷新后保持
5. 浅色 / 深色两种模式均无白块、无对比度问题、无残留默认蓝/黄
6. 周视图以周一为首列
7. 图标全部来自 `@ant-design/icons`，无 Emoji
8. 颜色 / 圆角 / 间距 / 字号全部引用 `token.css` 变量，无硬编码色值（事件色除外，其为数据）

## 十三、风险与回退

| 风险 | 说明 | 处置 |
|------|------|------|
| FullCalendar 内联样式优先级 | 事件颜色由 FC 以内联样式写入，CSS 需 `!important` 覆盖 | 页面级 `.global.css` 内对 `.fc-event` 使用 `!important`，作用域限定在 `.fc` 内，不外溢 |
| `color-mix()` 兼容性 | 老浏览器不支持 | 项目目标为三大浏览器最新版，可接受 |
| 事件 DOM 变量注入时机 | `eventDidMount` 若未覆盖某些渲染路径，左色条会回退到默认蓝 | 兜底 `var(--cal-event-color, var(--color-info))` |
| `DatePicker` 替换引起的时间解析差异 | 原生 `datetime-local` 与 antd 日期对象序列化方式不同 | 统一走 `dayjs` 序列化，提交仍为 ISO 字符串，后端无感知 |
| 回退 | 纯前端改动，无数据影响 | `git revert` 单提交即可完全回退 |

## 十四、Phase 2 衔接点（本期不做，仅记录）

Phase 2 将引入命名分类体系，本期为其预留的最小接口面：

1. 新增 `calendar_category` 表：`id / name / color / owner_id / created_at`
2. `calendar_event` 增加可空 `category_id` 外键（`ondelete SET NULL`）+ Alembic 迁移（编号顺延）
3. 新增分类 CRUD API 与 service；列表接口增加 `category_id` 过滤参数
4. 前端新增分类管理 UI；事件弹窗的「颜色」改为「分类」（保留颜色作为分类属性）
5. `ColorFilterBar.tsx` 升级为 `CategoryFilterBar.tsx`：芯片由颜色改为分类名，筛选键由 `color` 改为 `category_id`
6. 旧数据 `category_id = NULL` 显示为「未分类」，向后兼容

> `CalendarColors.ts` 的色板与名称映射在 Phase 2 中作为分类默认色板复用，不需要重写。

---

## 附录：TDD Route

```text
TDD Route:
- Mode: off
- Decision: skipped
- Strict authority: not applicable（无显式 TDD 要求）
- Test posture: post-change regression（构建 + 部署 + 浏览器冒烟）
- Reason: 纯视觉/交互层改造，无业务逻辑分支与数据契约变更，单元测试收益低
- Verification: npx tsc -b && npm run build && 部署后浏览器四视图 + 浅深双模式冒烟
```
