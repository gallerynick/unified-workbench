## [日志编号 076] - 2026-08-30

### 开发版本
版本号：v2.0.0（开发中，未触发版本升级条件）

### 关联基定
- 《项目基定/开发基准文档.md》— 前端架构（组件组织）、3.2 通用设计模式
- 《项目架构/前端架构概览.md》— 组件目录约定（全局 components/、页面级 pages/、项目模块子目录）
- 《项目基定/UI设计规范.md》— Modal/表单组件规范、design token、无 Emoji 图标
- 《项目基定/文档编写规范.md》— 日志/注释简体中文

### 开发目标
1. 按《共用组件抽取与推广计划》T3，抽取提案新建/编辑共用组件 ProposalModal
2. 提案 Tab（ProposalTab 新建）与提案详情页（ProposalDetailPage 编辑）改用 ProposalModal，富文本描述与附件处理全局一致
3. 抽取描述富文本工具（parseDescription / wrapPlainTextToDoc / serializeDescription）为共享模块，消除重复实现

### 涉及模块 / 文件
- 模块：项目管理 / 提案创建与编辑弹窗共用组件
- 新增文件：
  - `项目文件/frontend/src/pages/projects/components/ProposalModal.tsx` — 项目提案新建/编辑共用弹窗（标题/类型/优先级/描述(Tiptap 富文本)/附件/执行人，自动编号）
  - `项目文件/frontend/src/pages/projects/components/proposalDescription.ts` — 描述富文本共享工具（parseDescription / wrapPlainTextToDoc / serializeDescription）
- 修改文件：
  - `项目文件/frontend/src/pages/projects/tabs/ProposalTab.tsx` — 删除内联新建 Modal/form/编号/提交逻辑，改用 ProposalModal
  - `项目文件/frontend/src/pages/projects/ProposalDetailPage.tsx` — 删除内联编辑 Modal/editForm/submitEdit 与本地 parseDescription/wrapPlainTextToDoc，改用 ProposalModal + 共享工具
- 删除文件：无
- 其他：创建还原点 tag `restore-20260830-pre-proposal-modal`

### 开发内容详述

#### 1. 共享工具 proposalDescription.ts
- `parseDescription(value)`：兼容 Tiptap JSON 字符串与纯文本旧数据，返回 Tiptap doc JSON 对象（供编辑器回显与只读渲染）
- `wrapPlainTextToDoc(text)`：把纯文本包装为 Tiptap 段落 doc
- `serializeDescription(value)`：提交时序列化——Tiptap doc 对象 → JSON 字符串；纯文本 → trim 后非空字符串；空则 undefined

#### 2. 共用组件 ProposalModal（pages/projects/components/ProposalModal.tsx）
- **Props**（与 TodoModal/MeetingModal 同构）：
  - `project`：所属项目（编号生成用）
  - `open` / `onClose`：显隐控制
  - `editingProposal`：非空=编辑模式（详情页编辑），null=新建（列表页新建）
  - `existingProposals`：项目现有提案（新建时生成下一个编号）
  - `onSaved`：保存成功回调（父组件刷新列表/详情）
- **内部自洽**：打开时加载执行人选项（listUsers）；表单含标题/类型/优先级/描述(Tiptap 富文本)/执行人/附件(Form.List)；编号生成 `buildProposalNumber`（PRP-项目编号-序号）内聚在组件中
- **富文本一致性**：新建与编辑统一使用 ContentEditor，编辑回填经 parseDescription/wrapPlainTextToDoc 还原 doc，提交经 serializeDescription 序列化
- **消息提示**：新建「提案已创建」/编辑「提案已更新」，成功后 onClose + onSaved

#### 3. ProposalTab 改造
- 删除：内联新建 Modal JSX、`modalVisible`/`submitting`/`form` 状态、`handleCreate`/`handleSubmit`、`buildProposalNumber`、`ProposalFormValues` 接口、相关 import（Modal/Form/DeleteOutlined/createProjectProposal/PROJECT_NUMBER_PREFIX/AttachmentLink/TextArea）
- 保留：列表/筛选/权限/进入详情逻辑；底部渲染 `<ProposalModal project existingProposals={proposals} onSaved={fetchData} />`

#### 4. ProposalDetailPage 改造
- 删除：内联编辑 Modal JSX、`editForm`/`submittingEdit` 状态、`submitEdit`、`openEdit` 的表单填充逻辑、本地 `parseDescription`/`wrapPlainTextToDoc` 定义、`ProposalFormValues` 接口、相关 import（Form/DeleteOutlined/AttachmentLink）
- `openEdit` 简化为仅 `setEditVisible(true)`，底部渲染 `<ProposalModal project editingProposal={proposal} onSaved={fetchProposal} />`
- `renderDescriptionBlock` 改从共享模块导入 `parseDescription`（只读渲染富文本描述不变）

### 遇到的问题与解决
- 问题 1：ProposalDetailPage 本地 parseDescription/wrapPlainTextToDoc 与 ProposalModal 需要同一套逻辑
  - 解决方案：抽为 `components/proposalDescription.ts` 共享模块，两处共用；新增 serializeDescription 统一提交序列化
- 问题 2：删除内联编辑/新建 Modal 后大量未使用 import
  - 解决方案：tsc 严格模式逐一清理（Form/DeleteOutlined/AttachmentLink/Modal/createProjectProposal/PROJECT_NUMBER_PREFIX/TextArea 等）
- 问题 3：编辑模式回填需把存储的 JSON 字符串还原为 Tiptap doc 对象
  - 解决方案：`parseDescription(description) ?? wrapPlainTextToDoc(description)`（复用 072 约定）

### 测试情况
- 测试方式：
  1. `npx tsc -b` 零错误（strict + exactOptionalPropertyTypes）
  2. `npm run build` 通过（3.55s），新 bundle `ProposalDetailPage-B7zdHH_k.js`
  3. `./start.sh` 部署（buildx 写 ~/.docker 需完整访问，后台运行）
  4. 冒烟：https 首页 200；grep 确认新 chunk 生效
- 测试结果：通过

### 与项目基定的一致性确认
☑ 本次开发符合《项目基定》要求
- 组件目录遵循前端架构约定（项目模块共用组件放 pages/projects/components/）
- 无 Emoji 图标；Modal/表单样式对齐 UI 规范（640px、maxHeight 滚动、design token）
- 未改后端、未加依赖、未改数据库、未改权限模型
- 未更新版本号（v2.0.0 保持）

### 下一步计划
1. 用户在浏览器验证：提案 Tab 新建（富文本描述）、提案详情页编辑（富文本回显一致）
2. 按《共用组件抽取与推广计划》继续 T4 项目信息编辑与创建表单统一（需与用户确认创建/编辑差异合并范围）
3. 继续其余项目模块开发（待用户指定方向）

---
