# 项目信息 Tab 展示重构 — 设计规格

> 状态：**已实施**（日志 074，已部署验证通过）
> 关联文件：`项目文件/frontend/src/pages/projects/tabs/ProjectInfoTab.tsx`
> 版本：v2.0.0（开发中）

---

## 一、背景与问题

当前 `ProjectInfoTab.tsx` 把项目全部信息塞进**一张 `Descriptions bordered column={2}` 表格**（约 19 个字段）。问题：

1. **信息性质差异大，单一容器无法承载**：短键值（编号/团队/语言）挤在窄单元格里视觉空洞；长文本（目标/需求/开发流程）在 2 列单元格里换行挤压，阅读体验差。
2. **标题/状态/可见性等"身份类"信息**被表格边框包裹，本应使用主标题与 Tag 呈现。
3. **关系类信息**（关联项目）仅显示名称拼接，无跳转能力。
4. **信息缺口**：`types/project.ts` 已有 `owner_name`（负责人）、`description`（描述）、`member_ids`（成员数）等字段，但 InfoTab 当前未展示负责人与描述。
5. 与项目详情页其余 Tab（如 `ProjectProgressTab` 的 Card 分区范式）视觉风格不一致。

## 二、设计目标

1. 按信息性质分组展示，短键值用**左标签右内容定义列表**，长文本用**独立段落区块**，状态/可见性用 **Tag**。
2. 保留在 InfoTab 内展示项目名称与可见性（用户确认：不与页头去重，信息页自包含）。
3. 补充缺失字段：项目负责人、项目描述、成员规模；关联项目可点击跳转。
4. 全部样式使用设计令牌（`var(--token)`），深浅色模式自动适配；不引入新依赖；图标使用 @ant-design/icons。
5. 仅重构**展示层**，不改后端 API、不改 `ProjectForm` 编辑通道（`description` 已有创建/编辑入口）。

## 三、已确认的决策（用户拍板）

| 决策点 | 结论 |
|--------|------|
| 整体布局范式 | **自定义定义列表**（左标签右内容网格 + 长文本全宽段落），脱离 `Descriptions` 表格 |
| 长文本展示 | **独立段落区块**（字段标题 + 完整段落） |
| 分区组织 | **用分区标题分组**（如 基础信息 / 项目描述 / 规划与关联） |
| 项目名称/可见性 | **保留在 InfoTab 内**（不因页头已展示而去重） |
| 补充字段 | 项目负责人（owner_name）、项目描述（description）、成员规模（member_ids 数量） |
| 关联项目 | **可点击跳转**到对应项目详情页 |
| 成员规模形式 | **Tag + 数字**（如「成员 5」） |

## 四、信息分组与字段映射

### 区块 A：基础信息（短键值定义列表）

| 标签 | 字段来源 | 展示方式 |
|------|---------|---------|
| 项目名称 | `project.title` | 定义列表项（或区块标题） |
| 项目编号 | `project.number` | 文本，空值显示 `-` |
| 项目状态 | `project.status` | Tag（draft/ongoing/done/archived → 草稿/进行中/已完成/已归档） |
| 可见性 | `project.visibility` | Tag（复用 `getVisibilityConfig`）+ restricted 用户数 |
| 项目负责人 | `project.owner_name`（新补） | 文本 |
| 所属团队/部门 | `project.department` | 文本 |
| 项目语言 | `project.language` | 文本 |
| 是否开源 | `project.is_open_source` | Tag（开源/闭源） |
| 仓库地址 | `project.repo_url` | 链接（开源时展示） |
| 项目优先级 | `project.priority` | Tag（立即/重要/一般/最后/待定） |
| 项目类型 | `project.project_type` | 文本（映射 PROJECT_TYPE 标签） |
| 成员规模 | `project.member_ids?.length`（新补） | Tag「成员 N」 |
| 创建时间 | `project.created_at` | 文本（zh-CN locale） |
| 更新时间 | `project.updated_at` | 文本（zh-CN locale） |

### 区块 B：项目描述（长文本独立段落区块）

| 标签 | 字段来源 | 展示方式 |
|------|---------|---------|
| 项目描述 | `project.description`（新补） | 段落（空值显示「-」或占位） |
| 项目目标 | `project.goals` | 段落 |
| 项目需求 | `project.requirements` | 段落 |
| 附加需求 | `project.additional_req` | 段落 |

### 区块 C：规划与关联（长文本段落 + 交互）

| 标签 | 字段来源 | 展示方式 |
|------|---------|---------|
| 模块划分 | `project.modules` | 段落 |
| 开发流程 | `project.dev_process` | 段落 |
| 关联项目 | `parseRelatedProjects(project.related_projects)` | 可点击列表（跳转对应项目详情页） |

> 说明：关联项目字段存储为 JSON 数组字符串（兼容旧逗号分隔文本），前端已有 `parseRelatedProjects` 工具。跳转需要 id → 标题 映射，复用 InfoTab 现有的 `listProjects` 拉取的 `projectOptions`。

## 五、布局结构与样式

### 5.1 结构草图

```text
<div className={styles.container}>
  <div className={styles.section}>
    <div className={styles.sectionTitle}>基础信息</div>
    <div className={styles.definitionList}>
      {短键值项：<div className={styles.defItem}><span className={styles.defLabel}>{label}</span><span className={styles.defValue}>{value}</span></div>}
    </div>
  </div>

  <div className={styles.section}>
    <div className={styles.sectionTitle}>项目描述</div>
    {长文本项：<div className={styles.textBlock}><div className={styles.textLabel}>{label}</div><div className={styles.textBody}>{content}</div></div>}
  </div>

  <div className={styles.section}>
    <div className={styles.sectionTitle}>规划与关联</div>
    {长文本项 + 关联项目可点击列表}
  </div>

  <div className={styles.actions}>
    <Button type="primary" icon={<EditOutlined />}>编辑信息</Button>
  </div>
</div>
```

### 5.2 样式规范（新建 `ProjectInfoTab.module.css`，全部引用 design token）

| 类名 | 规则 |
|------|------|
| `.container` | flex column，gap: var(--spacing-card-gap) |
| `.section` | 含下边距 var(--spacing-card-gap) |
| `.sectionTitle` | 字号 var(--text-caption-strong)（14px/600），下边距 var(--spacing-sm) |
| `.definitionList` | 网格或两列 flex，column-gap var(--spacing-lg)、row-gap var(--spacing-sm)，响应式（窄屏 1 列） |
| `.defItem` | 行内 flex |
| `.defLabel` | 固定宽度约 100px，颜色 var(--text-secondary)，flex-shrink:0 |
| `.defValue` | 颜色 var(--text-primary)，溢出省略或换行 |
| `.textBlock` | 独立段落区块，下边距 var(--spacing-md) |
| `.textLabel` | 标题，颜色 var(--text-secondary)，14px/600 |
| `.textBody` | 正文，白色/ink，white-space: pre-wrap（保留换行），14px |
| `.actions` | 区块底部，右对齐或与标题同排 |

> 深浅色：所有颜色一律用 token（`--text-secondary` / `--text-primary` / `--ink` 等），无硬编码色值；`[data-theme="dark"]` 自动适配。图标 `EditOutlined` 来自 @ant-design/icons。

### 5.3 关联模板展示

若 `template` prop 存在，保留现有「关联模板」Descriptions 区块（模板名称/分类/版本/字段数量），样式对齐新区块（或保留原样，见边界）。

## 六、交互与状态

- **编辑入口**：保留右上/底部「编辑信息」按钮，打开现有编辑 Modal（`ProjectForm` 已有 description 编辑，不改动）。
- **关联项目跳转**：点击关联项目名称 → `useNavigate(`/projects/${id}`)` 跳转对应项目详情页；无 id 匹配时回退显示原始值。
- **空值处理**：短键值空值显示 `-`；长文本空值显示「暂无」或 `-`（设计定稿时明确其一）。
- **负责人/描述/成员数**：均为纯展示，新增字段仅读 `project` 对象，无需新增 API。

## 七、边界与非目标

- **不改**：后端 API、`ProjectForm` 编辑表单、`ProjectDetailPage` 页头（名称/可见性/导出按钮）、其余 8 个 Tab。
- **不引入**：新 npm 依赖、PDF/WeasyPrint、新的后端字段。
- **关联模板**：如保留，沿用现有展示结构，仅调整样式对齐（或明确列为二期）。
- **性能**：无新接口调用（关联项目映射复用现有 `listProjects`），无性能风险。

## 八、验收标准

1. InfoTab 不再使用 `Descriptions bordered` 单表格；按「基础信息 / 项目描述 / 规划与关联」三区块 + 分区标题展示。
2. 长文本字段（描述/目标/需求/附加需求/模块/流程）以段落区块呈现，无单元格挤压。
3. 新增展示：项目负责人、项目描述、成员规模（Tag 数字）。
4. 关联项目可点击跳转对应项目详情页。
5. 项目名称与可见性仍在 InfoTab 内展示。
6. `npx tsc -b` 零错误；`npm run build` 通过；浏览器深浅色模式下视觉正常；无 Emoji（图标用 @ant-design/icons）。
7. 冒烟：进入任意项目详情页 → 项目信息 Tab 三区块渲染正确、新增字段显示、关联项目跳转生效、编辑按钮仍可用。

## 九、审阅与下一步

- 请审阅本规格，确认或提出修改。
- 批准后进入 writing-plans 编写实施计划（**暂不执行代码**）。
