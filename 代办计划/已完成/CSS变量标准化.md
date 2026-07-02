# CSS 变量标准化计划

## 背景

全量扫描 47 个 CSS Module，发现：无全局主题变量层，每个页面的 CSS 变量各自定义，存在值不一致、重复定义、无深色模式等问题。

---

## 一、现状

### 已定义 CSS 变量的页面（8 个）
FileManagement、FolderTree、NoteManagement、GraphView、StreamStudio、TopologyManagement、CalendarPage、Home

### 完全没有深色模式支持的页面（9 个）
ContentEditor(32处硬编码)、AuditLog(12处)、SecretManagement(5处)、SecretFormModal(4处)、AnnouncementManagement、NotificationConfig、Welcome、FileManagement图标、FolderTree图标

---

## 二、需修复的跨文件不一致

| 属性 | 页面A | 页面B | 问题 |
|------|------|------|------|
| 次要文字(浅色) | StreamStudio `#666` | Home `#8c8c8c` | 值不同 |
| 次要文字(深色) | StreamStudio `#999` | Home `#a6a6a6` | 值不同 |
| 边框(深色) | 大部分 `#303030` | NoteManagement `#334155` | 混用两套调色板 |
| 选中高亮(浅色) | StreamStudio `#e6f7ff` | Calendar `#e6f4ff` | 细微差异 |
| StreamStudio vs Topology | 7组变量名不同但值相同 | — | 重复定义，应提取共享变量 |

---

## 三、执行计划

| 优先级 | 任务 | 涉及文件 |
|--------|------|---------|
| P0 | ContentEditor 添加深色模式 | ContentEditor.module.css |
| P0 | AuditLog 添加深色模式 | AuditLog.module.css |
| P1 | 创建全局 theme.css | 新建 `src/styles/theme.css` |
| P1 | 统一 `--text-secondary` 值 | global.css |
| P2 | 迁移重复变量到全局 | StreamStudio/Topology/NoteManagement |
| P2 | SecretManagement/Welcome 等添加深色模式 | 6个文件 |
| P3 | 图标颜色添加 data-theme 覆盖 | FileManagement/FolderTree |
