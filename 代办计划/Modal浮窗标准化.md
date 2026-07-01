# Modal 浮窗标准化计划

## 背景

项目中有 14 处 Modal / Drawer 使用了不同的 `width` 值（320~960px），无统一标准。部分浮窗内容过长时出现横向滚动条，影响体验。需要：
1. 定义大/中/小三种标准尺寸，统一所有浮窗宽度
2. 统一浮窗滚动行为：允许纵向滚动，禁止横向滚动

---

## 一、现有尺寸分布分析

| 宽度 | 数量 | 使用场景 |
|------|------|---------|
| 960 | 1 | ContentForm 内容编辑器（Tiptap 富文本） |
| 860 | 1 | TemplateManagement 新建/编辑文档 |
| 800 | 1 | RecordForm 记录表单 |
| 640 | 1 | NoteManagement 新建/编辑笔记 |
| 600 | 1 | FormManagement 新建表单 |
| 560 | 2 | CalendarPage 事件编辑、StreamStudio 推流设置 |
| 520 | 2 | FolderSettingsModal、StreamStudio 测速 |
| 500 | 1 | ContentManagement 新建内容 |
| 480 | 1 | VotePopup 投票弹窗 |
| 420 | 1 | PasswordVerifyModal 首次验证 |
| 400 | 1 | NotificationDrawer 通知抽屉 |
| 320 | 1 | FormManagement 二维码分享 |

---

## 二、推荐三种标准尺寸

### 小（S）：420px

**适用场景**：简单表单、确认对话框、二维码展示、通知

| 现有浮窗 | 当前宽度 | 是否有宽度定义 | 说明 |
|---------|---------|----------------|------|
| FormManagement 二维码 | 320 | 有 | → 改小 420 |
| PasswordVerifyModal | 420 | 有 | 已正确，不变 |
| NotificationDrawer | 400 | 有 | → 改小 420 |
| VotePopup | 480 | 有 | → 改小 420 |

### 中（M）：560px

**适用场景**：标准 CRUD 操作、设置弹窗、数据表格编辑

| 现有浮窗 | 当前宽度 | 说明 |
|---------|---------|------|
| CalendarPage 事件 | 560 | 已正确，不变 |
| StreamStudio 设置 | 560 | 已正确，不变 |
| StreamStudio 测速 | 520 | → 改中 560 |
| FolderSettingsModal | 520 | → 改中 560 |
| ContentManagement 新建 | 500 | → 改中 560 |
| FormManagement 新建 | 600 | → 改中 560 |
| NoteManagement 编辑 | 640 | → 改中 560 |

### 大（L）：800px

**适用场景**：富文本编辑器、复杂表单（多字段）、记录详情

| 现有浮窗 | 当前宽度 | 说明 |
|---------|---------|------|
| ContentForm 编辑器 | 960 | → 改大 800 |
| TemplateManagement 编辑 | 860 | → 改大 800 |
| RecordForm 记录表单 | 800 | 已正确，不变 |

---

## 三、涉及修改的文件

### 需修改（10 个文件）

| 文件 | 当前宽度 | 目标宽度 | 改幅 |
|------|---------|---------|------|
| `pages/forms/FormManagement.tsx:149` | 320 | 420 | +100 |
| `components/VotePopup.tsx:84` | 480 | 420 | -60 |
| `components/NotificationDrawer.tsx:25` | 400 | 420 | +20 |
| `pages/content/ContentManagement.tsx:318` | 500 | 560 | +60 |
| `pages/forms/FormManagement.tsx:118` | 600 | 560 | -40 |
| `pages/notes/NoteManagement.tsx:316` | 640 | 560 | -80 |
| `pages/files/FolderSettingsModal.tsx:92` | 520 | 560 | +40 |
| `pages/streaming/StreamStudio.tsx:1386` | 520 | 560 | +40 |
| `pages/content/ContentForm.tsx:198` | 960 | 800 | -160 |
| `pages/templates/TemplateManagement.tsx:302` | 860 | 800 | -60 |

### 无需修改（4 个）

| 文件 | 宽度 | 原因 |
|------|------|------|
| `pages/streaming/StreamStudio.tsx:1249` | 560 | 已是中 |
| `pages/calendar/CalendarPage.tsx:227` | 560 | 已是中 |
| `pages/records/RecordForm.tsx:332` | 800 | 已是大 |
| `pages/secrets/PasswordVerifyModal.tsx:110` | 560/420 | 动态宽度，已是中/小 |

---

## 四、浮窗滚动行为规范

**规则**：所有 Modal 内容区允许纵向滚动（`overflow-y: auto`），禁止横向滚动（`overflow-x: hidden`）。

**实现方式**：给每个 `<Modal>` 添加 `style` 或通过 `bodyStyle` 控制：

```tsx
<Modal
  width={560}
  styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
>
```

**涉及范围**：所有含 `<Modal>` 的页面（约 20+ 个文件），逐一检查并添加溢出控制。

**需排查的文件**（grep `<Modal` 结果）：

| 文件 | 当前 Modal | 是否需要修复 |
|------|-----------|------------|
| `pages/streaming/StreamStudio.tsx` | 3 个 Modal | 测速浮窗内容可能溢出，需加 |
| `pages/forms/FormManagement.tsx` | 2 个 Modal | 需加 |
| `pages/forms/FormFill.tsx` | 1 个 Modal | 需加 |
| `pages/forms/FormResponses.tsx` | 1 个 Modal | 需加 |
| `pages/templates/TemplateManagement.tsx` | 2 个 Modal | 需加 |
| `pages/content/ContentManagement.tsx` | 1 个 Modal | 需加 |
| `pages/content/ContentForm.tsx` | 1 个 Modal | 需加 |
| `pages/calendar/CalendarPage.tsx` | 1 个 Modal | 需加 |
| `pages/notes/NoteManagement.tsx` | 1 个 Modal | 需加 |
| `pages/votes/VoteManagement.tsx` | 1 个 Modal | 需加 |
| `pages/tasks/TaskManagement.tsx` | 1 个 Modal | 需加 |
| `pages/inventory/InventoryManagement.tsx` | 1 个 Modal | 需加 |
| `pages/contacts/ContactManagement.tsx` | 1 个 Modal | 需加 |
| `pages/secrets/SecretManagement.tsx` | 多个 Modal | 需加 |
| `pages/files/FolderSettingsModal.tsx` | 1 个 Modal | 需加 |
| `pages/records/RecordForm.tsx` | 1 个 Modal | 需加 |
| `pages/topology/TopologyManagement.tsx` | 1 个 Modal | 需加 |
| `settings/*` 各页面 | 各 1 个 Modal | 需加 |

## 五、浮窗内容自适应规范

**规则**：浮窗内所有组件必须随浮窗宽度自适应，不得出现以下情况：
- 组件宽度超出浮窗边界
- 组件宽度明显小于浮窗宽度（不协调留白）
- 文字被遮挡或截断
- 横向滚动条由浮窗自身内容引起

**检查要点**：

| 组件类型 | 注意事项 |
|---------|---------|
| Table | 列宽总和不应超出浮窗宽度；列数多时启用 `scroll.x` |
| Form | Form.Item 使用百分比宽度或 `flex` 布局，避免固定宽超出 |
| Input / InputNumber | 设置 `style={{ width: '100%' }}` 而非固定 px |
| TextArea | 设置 `style={{ width: '100%' }}` 或使用 `rows` 控制高度 |
| Select | 同上 |
| Tag 列表 | 使用 `flex-wrap: wrap` 换行 |
| 代码块 / JSON | 添加 `overflow-x: auto` + `white-space: pre-wrap` |
| Space / flex 容器 | 添加 `flex-wrap: wrap` 防止溢出 |

**排查方式**：打开每个 Modal 页面，逐项检查组件边界是否与浮窗对齐，文字是否完整可见。

---

## 六、执行步骤

1. **定义规范**：在 `项目基定/UI设计规范与术语定义.md` 第5章补充：
   - Modal 尺寸规范（S=420, M=560, L=800）
   - Modal 滚动规范（`overflow-y: auto; overflow-x: hidden`）
   - Modal 内容自适应规范
2. **尺寸统一**：修改 10 个文件，将 `width` 替换为标准尺寸
3. **滚动控制**：给所有 Modal（约 20+ 个）添加 `styles.body` 溢出控制
4. **内容自适应**：逐页检查组件宽度、文字溢出、表格列宽等，修正不协调项
5. **构建验证**：`npm run build` 确认无编译错误
6. **视觉验证**：逐个打开涉及页面，确认浮窗尺寸正常、无横向滚动条、组件不溢出
7. **日志记录**：更新项目开发日志

---

## 七、备注

- 宽度直接使用数字，不定义 CSS 变量
- 宽度为建议值，个别页面如有特殊需求（如 Tiptap 编辑器）可微调
- `styles.body` 是 Ant Design 5 的 API（非 `bodyStyle`），需确认版本兼容
- 此计划待确认后执行，**当前不修改任何代码**
