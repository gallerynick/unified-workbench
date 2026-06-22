---
slug: project-document-redesign
status: awaiting-approval
intent: clear
pending-action: write .omo/plans/project-document-redesign.md
approach: 重新设计项目文档Tab架构，实现文档列表+分类+编辑+模板套用
---

# Draft: project-document-redesign

## Components (topology ledger)
| id | outcome | status | evidence path |
|----|---------|--------|---------------|
| C1 | 重构 ProjectDocumentTab 组件 | active | frontend/src/pages/projects/tabs/ProjectDocumentTab.tsx |
| C2 | 添加文档分类功能 | active | 集成到 ProjectDocumentTab |
| C3 | 实现文档编辑模式 | active | 集成到 ProjectDocumentTab |
| C4 | 实现模板套用功能 | active | 集成到 ProjectDocumentTab |

## Open assumptions (announced defaults)
| assumption | adopted default | rationale | reversible? |
|------------|-----------------|-----------|-------------|
| 文档分类 | 使用简单的字符串分类（如"会议记录"、"需求文档"等） | 简单灵活 | 是 |
| 默认分类 | "未分类" | 保持向后兼容 | 是 |
| 编辑模式 | 点击文档进入编辑，显示返回按钮 | 直观易用 | 是 |

## Findings (cited - path:lines)
- ProjectDocumentTab.tsx:28-34 - 当前 ProjectDocument 接口定义
- ProjectDocumentTab.tsx:46-80 - 当前组件状态管理
- ProjectDocumentTab.tsx:107-120 - 创建新文档逻辑
- ContentEditor.tsx:82-255 - Tiptap 编辑器组件
- TemplateSelector.tsx:1-50 - 模板选择器（当前为占位版本）

## Decisions (with rationale)
1. **文档列表+编辑模式**: 左侧显示文档列表，点击文档进入编辑模式
2. **文档分类**: 在文档列表上方添加分类筛选，创建文档时可选择分类
3. **模板套用**: 编辑模式下显示"套用模板"按钮，点击后打开模板选择器
4. **返回按钮**: 编辑模式下显示返回按钮，回到文档列表

## Scope IN
- 重构 ProjectDocumentTab 为两层结构：文档列表 + 编辑模式
- 添加文档分类功能（创建时选择，列表时筛选）
- 实现文档编辑模式（点击文档进入编辑）
- 实现模板套用功能（编辑模式下可选择模板）
- 保持现有数据结构兼容

## Scope OUT (Must NOT have)
- 不实现复杂的文档权限管理
- 不实现文档版本控制
- 不实现多人协作编辑

## Open questions
无

## Approval gate
status: approved
