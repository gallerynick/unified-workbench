# 交流记录内容 Tab 展开计划

> 状态：待确认
> 日期：2026-09-01
> 关联日志：085

## 一、背景与用户决策

用户反馈：交流记录「新建」不应强制填写正文内容（类比创建文件夹——先设文件夹属性，内容后填）。在此基础上进一步要求：详情页的「内容」方向需要展开。

用户明确决策：
1. **正文格式**：切到 Tiptap 富文本（与提案描述一致）
2. **正文编辑入口**：在详情页内联编辑，不走 Modal
3. **列表页原则**：所有模块的列表/Tab 只保留「进入」按钮，不放删除和编辑按钮。重要操作一律在详情页。此原则适用于全项目，本次先改交流记录，后续推广
4. **备注能力**：追加 + 编辑 + 删除单条备注
5. **Tab 结构**：拆 3 个 tab，不并入

## 二、现状盘点

### 后端
- `ProjectMeeting.content`：`str` 字段，存 `标题\n\n正文` 纯文本
- `ProjectMeeting.notes`：`JSONB list`，已支持 CRUD（service 接受 notes 数组）
- 无 `title` 字段，标题混在 content 里

### 前端
- MeetingDetailPage：2 tab（交流详情 / 关联内容），正文纯文本段落展示
- MeetingRecordTab：列表行有删除、编辑按钮（违反新原则）
- MeetingModal：新建/编辑共用，title 字段名为「内容」（已在上轮改为「主题」），body 字段仅编辑模式展示
- ContentEditor：Tiptap 富文本组件，支持 `editable={false}` 只读
- `parseDescription` / `wrapPlainTextToDoc` / `serializeDescription`：提案描述的 Tiptap ↔ 纯文本兼容工具，可复用

### 既有文档对齐
- 《项目重做计划.md》Tab6 交流记录：字段「类型/时间/发言人/参与人/内容/备注列表」，「每场/次为单位，可追加备注」
- 《前端架构概览.md》：富文本 Tiptap
- 提案模块已采用 `parseDescription` + ContentEditor 模式，本次复用

## 三、改动范围

### 3.1 后端（4 个文件 + 1 个迁移）

**模型 `app/models/project_meeting.py`**
- 新增 `title: Mapped[str | None]`，`comment="交流主题"`
- `content` 保持 `str`，语义改为「正文（Tiptap doc JSON 字符串或纯文本旧数据）」

**Schema `app/schemas/project_meeting.py`**
- Create / Update / Response 各新增 `title` 字段

**Service `app/services/project_meeting.py`**
- create / update 接收 `title`

**迁移 `alembic/versions/044_add_title_to_meeting.py`**
- `project_meeting` 表新增 `title` 列（nullable）
- 回填：现有记录的 `content` 按 `\n\n` 拆分，前半段写入 `title`，后半段保留在 `content`（仍为纯文本，前端用 `wrapPlainTextToDoc` 包装显示）
- 不强制把所有历史 content 转 Tiptap JSON，由前端兼容层处理

**DB 启动迁移**：044 随 Dockerfile CMD 自动执行（已就位）

### 3.2 前端（5 个文件）

**类型 `src/types/project-meeting.ts`**
- 新增 `title?: string | null`（Create / Update / Response）

**MeetingModal `src/pages/projects/components/MeetingModal.tsx`**
- 新建模式：title → `title` 字段；body 隐藏（新建只填元数据，已在上轮完成）
- 编辑模式：title → `title` 字段（保留编辑主题）；body 移除（正文编辑迁移到详情页）
- 删除 `splitTitleContent` 导出（不再需要，content 不再混 title）
- 提交 payload：`title: values.title.trim()`，`content: 空字符串`（新建时不写 content，留待详情页编辑）

**MeetingDetailPage `src/pages/projects/MeetingDetailPage.tsx`**
- 3 tab：交流详情 / 交流内容 / 关联内容
- **交流详情**：定义列表（编号/类型/主题/时间/发言人/参与人/关联/时间戳），不含正文和备注
- **交流内容**：
  - 正文区：默认只读（ContentEditor editable={false}），右上角「编辑正文」按钮切换为可编辑，「保存」「取消」按钮
  - 备注区：列表 + 「追加备注」输入框
  - 每条备注：右侧「编辑」「删除」按钮（编辑→内联 textarea，删除→confirm）
- **关联内容**：保持现状

**MeetingRecordTab `src/pages/projects/tabs/MeetingRecordTab.tsx`**
- 删除删除按钮、编辑按钮
- 保留「进入」按钮（navigate 到详情页）
- 保留搜索、类型筛选、分页、新建按钮

**工具复用**
- 复用 `parseDescription` / `wrapPlainTextToDoc` / `serializeDescription`（从 `proposalDescription.ts` 导入）
- 不抽取到新文件，避免改动面扩大

### 3.3 CSS

MeetingDetailPage.module.css 新增：
- `.contentSection`：正文编辑区容器
- `.contentToolbar`：工具栏（编辑/保存/取消）
- `.notesSection`：备注区容器
- `.noteItem`：单条备注（content + meta + actions）
- `.noteActions`：备注操作按钮组

## 四、数据兼容策略

| 数据形态 | 来源 | 前端处理 |
|----------|------|----------|
| content 为空 | 新建未填正文 | ContentEditor 显示空 doc |
| content 为纯文本（`标题\n\n正文`） | 旧数据 | `wrapPlainTextToDoc(body)` 包装为段落 doc |
| content 为 Tiptap JSON 字符串 | 新数据 | `parseDescription` 解析后渲染 |

`title` 字段：
- 旧数据：迁移回填（从 content 拆出）
- 新数据：新建/编辑时直接写入
- 若 `title` 为空但 `content` 有旧格式标题：前端 fallback 用 `splitTitleContent` 兼容（保留函数但改为内部使用）

## 五、交互细节

### 5.1 正文编辑
- 默认只读：ContentEditor `editable={false}`
- 点击「编辑正文」→ `editable={true}`，出现「保存」「取消」
- 保存：`updateProjectMeeting({ content: serializeDescription(editor.getJSON()) })`
- 取消：恢复只读，丢弃未保存修改
- 权限：仅 `canManageMeetings` 可见编辑按钮

### 5.2 备注追加
- 输入框（TextArea rows=2）+ 「追加」按钮
- 追加：`notes = [...currentNotes, { content, author: user.nickname, created_at: new Date().toISOString() }]` → `updateProjectMeeting({ notes })`
- 追加成功后清空输入框，刷新列表

### 5.3 备注编辑
- 点击「编辑」→ 该条备注变为 TextArea（内联）
- 「保存」「取消」
- 保存：更新对应索引的 `content` → `updateProjectMeeting({ notes: modified })`

### 5.4 备注删除
- 点击「删除」→ `Modal.confirm` 二次确认
- 确认后：`notes = notes.filter((_, i) => i !== index)` → `updateProjectMeeting({ notes })`

### 5.5 列表页（MeetingRecordTab）
- 每行操作列：仅「查看」按钮（进入详情页）
- 新建按钮保留（在列表顶部）
- 删除、编辑功能完全移除（迁至详情页）

## 六、风险与遗留

### 风险
1. **迁移 044 回填逻辑**：`content` 按 `\n\n` 拆分，若旧数据正文含 `\n\n` 会误拆
   - 缓解：回填时取**第一个** `\n\n` 作为分隔，标题为第一段，其余全部作为正文
2. **MeetingModal 编辑模式移除 body**：用户在 Modal 里无法编辑正文
   - 缓解：详情页有内联编辑，且列表页「编辑」按钮已移除，用户不会从列表进 Modal 编辑
3. **全项目推广原则**：本次只改交流记录，其他模块（提案、待办等）的列表页仍有删除/编辑按钮
   - 缓解：本次聚焦交流记录，后续日志单独记录推广任务

### 遗留
- 其他模块列表页按新原则清理（提案/待办/修改记录/项目事件等）
- MeetingRecordTab 的「编辑」入口移除后，用户需要先进详情页再编辑——这是设计决策，非 bug

## 七、执行顺序

1. 后端：模型 → schema → service → 迁移 044 → 部署验证
2. 前端：类型 → MeetingModal 改造 → MeetingDetailPage 3 tab → MeetingRecordTab 清理 → 部署验证
3. 日志：086 记录

## 八、验证清单

- [ ] 新建交流记录：只填元数据，content 为空，title 写入
- [ ] 详情页交流详情 tab：显示元数据，无正文
- [ ] 详情页交流内容 tab：正文默认只读（空状态），点击「编辑正文」可编辑，保存后回显
- [ ] 详情页交流内容 tab：追加备注成功，列表刷新
- [ ] 详情页交流内容 tab：编辑单条备注成功
- [ ] 详情页交流内容 tab：删除单条备注成功（二次确认）
- [ ] 详情页关联内容 tab：保持现状
- [ ] 列表页 MeetingRecordTab：无删除/编辑按钮，仅「查看」
- [ ] 旧数据兼容：迁移后 title 回填正确，content 旧格式可正常显示
- [ ] 权限：非 canManageMeetings 用户只读，无编辑按钮
- [ ] tsc 0、build 通过、部署 exit 0、curl 200
