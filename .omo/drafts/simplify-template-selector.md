---
slug: simplify-template-selector
status: awaiting-approval
intent: clear
pending-action: write .omo/plans/simplify-template-selector.md
approach: 简化模板选择器UI，移除分类选择，添加模板位置字段用于限定显示
---

# Draft: simplify-template-selector

## Components (topology ledger)
| id | outcome | status | evidence path |
|----|---------|--------|---------------|
| C1 | 简化 TemplateSelector 组件 | active | frontend/src/pages/projects/TemplateSelector.tsx |
| C2 | 添加模板位置字段到 Template 模型 | active | backend/app/models/template.py |
| C3 | 更新 Template schema 和 API | active | backend/app/schemas/template.py |
| C4 | 更新 TemplateEditor 支持位置字段 | active | frontend/src/pages/templates/TemplateEditor.tsx |
| C5 | 更新 TemplateManagement 显示位置字段 | active | frontend/src/pages/templates/TemplateManagement.tsx |

## Open assumptions (announced defaults)
| assumption | adopted default | rationale | reversible? |
|------------|-----------------|-----------|-------------|
| 位置字段 | 使用枚举类型，如 "project", "record", "global" | 简单明确，易于扩展 | 是 |
| 默认位置 | "global" | 保持向后兼容 | 是 |

## Findings (cited - path:lines)
- TemplateSelector.tsx:28-35 - 当前有分类选择器 CATEGORY_OPTIONS
- TemplateSelector.tsx:130-138 - Select 组件用于分类筛选
- TemplateManagement.tsx:33-40 - 分类筛选选项
- backend/app/models/template.py:27-29 - category 字段定义

## Decisions (with rationale)
1. **移除分类选择器**: 用户明确要求不要有分类选择
2. **添加位置字段**: 用于限定模板在哪些位置显示（项目、记录、全局）
3. **简化UI**: 一列显示模板列表，最上面是搜索栏

## Scope IN
- 简化 TemplateSelector 组件，移除分类选择
- 添加模板位置字段（project, record, global）
- 更新模板编辑器支持设置位置
- 更新模板管理页面显示位置信息
- TemplateSelector 根据位置过滤模板

## Scope OUT (Must NOT have)
- 不修改现有模板数据（保持向后兼容）
- 不实现复杂的位置管理逻辑

## Open questions
无

## Approval gate
status: approved
