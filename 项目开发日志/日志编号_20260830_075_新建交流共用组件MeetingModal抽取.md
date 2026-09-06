## [日志编号 075] - 2026-08-30

### 开发版本
版本号：v2.0.0（开发中，未触发版本升级条件）

### 关联基定
- 《项目基定/开发基准文档.md》— 前端架构（组件组织）、3.2 通用设计模式
- 《项目架构/前端架构概览.md》— 组件目录约定（全局 components/、页面级 pages/、项目模块子目录）
- 《项目基定/UI设计规范.md》— Modal/表单组件规范、design token
- 《项目基定/文档编写规范.md》— 日志/注释简体中文

### 开发目标
1. 按《共用组件抽取与推广计划》T2，抽取新建交流共用组件 MeetingModal（TodoModal 姊妹组件）
2. 交流记录 Tab（MeetingRecordTab）与提案详情页「一键新建并关联」改用 MeetingModal，消除重复实现
3. 补齐前端 ProjectMeetingCreate 类型缺失的 proposal_id / todo_id 字段，打通预关联

### 涉及模块 / 文件
- 模块：项目管理 / 交流记录创建弹窗共用组件
- 新增文件：
  - `项目文件/frontend/src/pages/projects/components/MeetingModal.tsx` — 项目交流记录新建/编辑共用弹窗（字段：类型/内容/时间/发言人/参与人，支持 initialProposalId/initialTodoId 预关联，自动编号）
- 修改文件：
  - `项目文件/frontend/src/pages/projects/tabs/MeetingRecordTab.tsx` — 删除内联 Modal/form/编号/提交逻辑，改用 MeetingModal
  - `项目文件/frontend/src/pages/projects/ProposalDetailPage.tsx` — 删除自建交流 Modal/编号/提交逻辑，改用 MeetingModal（initialProposalId 预关联）
  - `项目文件/frontend/src/types/project-meeting.ts` — ProjectMeetingCreate 增加 proposal_id / todo_id；speaker 类型放宽为 string | null
- 删除文件：无
- 其他：创建还原点 tag `restore-20260830-pre-meeting-modal`

### 开发内容详述

#### 1. 共用组件 MeetingModal（pages/projects/components/MeetingModal.tsx）
- **Props**（与 TodoModal 同构）：
  - `project`：所属项目（编号生成用）
  - `open` / `onClose`：显隐控制
  - `editingMeeting`：非空=编辑模式，null=新建
  - `existingMeetings`：项目现有交流记录（用于生成下一个编号）
  - `initialProposalId` / `initialTodoId`：新建时预关联的提案/待办 id
  - `onSaved`：保存成功回调（父组件刷新列表）
- **内部自洽**：打开时加载用户选项（发言人/参与人下拉）；表单含类型/内容/时间(默认现在)/发言人/参与人；编号生成 `buildMeetingNumber`（MTG-项目编号-序号）内聚在组件中
- **编辑模式**：内容字段按「标题\n\n正文」约定拆分，仅编辑标题，保留原正文，避免编辑丢失正文
- **消息提示**：新建「交流记录已创建」/编辑「交流记录已更新」，成功后 onClose + onSaved

#### 2. MeetingRecordTab 改造
- 删除：内联 Modal JSX、`modalVisible`/`editing`/`submitting`/`form` 状态、表单填充 useEffect、`handleSubmit`（含 create/update 与编号逻辑）、相关 import（Form/DatePicker/AutoComplete/dayjs/createProjectMeeting/updateProjectMeeting/PROJECT_NUMBER_PREFIX）
- 保留：`meetingModalOpen`/`editingMeeting` 状态与打开/关闭/刷新回调，底部渲染 `<MeetingModal project existingMeetings onClose onSaved={fetchMeetings} />`

#### 3. 提案详情页改造
- 删除：`createMeetingForm`/`createMeetingSubmitting` 状态、`buildMeetingNumber`、`openCreateMeeting`/`submitCreateMeeting`、自建「新建交流并关联」Modal JSX、相关 import（createProjectMeeting/MEETING_TYPE_OPTIONS/PROJECT_NUMBER_PREFIX/dayjs/DatePicker）
- 改为：`<MeetingModal project open existingMeetings={meetings} initialProposalId={proposal?.id} onClose onSaved={fetchProposal} />`，创建后自动关联当前提案并刷新

#### 4. 类型补齐
- `ProjectMeetingCreate` 原缺少 `proposal_id`/`todo_id`（后端 schema 已支持），补上后新建交流可预关联提案/待办
- `speaker` 类型由 `string` 放宽为 `string | null`，匹配后端可空语义，编辑清空发言人时传 null

### 遇到的问题与解决
- 问题 1：`ProjectMeetingCreate` 前端类型缺 `proposal_id`/`todo_id`，预关联字段无法编译通过
  - 解决方案：补充字段并放宽 speaker 为可空
- 问题 2：MeetingRecordTab 删除内联 Modal 后大量未使用 import（Form/DatePicker/AutoComplete/dayjs/createProjectMeeting/updateProjectMeeting/PROJECT_NUMBER_PREFIX 等）
  - 解决方案：逐一清理；tsc 严格模式验证通过
- 问题 3：旧编辑逻辑会把 content 整段覆盖（丢失正文），抽取时改为按「标题\n\n正文」拆分保留正文
  - 解决方案：编辑模式 `splitTitleContent` 拆分，仅更新标题部分

### 测试情况
- 测试方式：
  1. `npx tsc -b` 零错误（strict + exactOptionalPropertyTypes）
  2. `npm run build` 通过（4.02s），新 bundle `ProposalDetailPage-CkUzU_Mg.js`
  3. `./start.sh` 部署（buildx 写 ~/.docker 需完整访问，后台运行）
  4. 冒烟：https 首页 200；grep 确认旧 chunk 已下线、新 chunk 生效
- 测试结果：通过

### 与项目基定的一致性确认
☑ 本次开发符合《项目基定》要求
- 组件目录遵循前端架构约定（项目模块共用组件放 pages/projects/components/）
- 无 Emoji 图标；Modal/表单样式对齐 UI 规范（560px、maxHeight 滚动、design token）
- 未改后端逻辑（后端 schema/service 此前已支持 proposal_id）、未加依赖、未改数据库、未改权限模型
- 未更新版本号（v2.0.0 保持）

### 下一步计划
1. 用户在浏览器验证：交流记录 Tab 新建/编辑、提案详情页「新建并关联」（表单一致、发言人/参与人可选、编号自动）
2. 按《共用组件抽取与推广计划》继续 T3 提案新建/编辑共用组件 ProposalModal
3. 继续其余项目模块开发（待用户指定方向）

---
