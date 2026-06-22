# calendar-notes-ui-redesign - Planning Draft

## Status: plan-complete-awaiting-delivery
## Plan file: .omo/plans/calendar-notes-ui-redesign.md (已生成)

## User request
日历部分有点臃肿，增加不同的视图；笔记知识库改成树形结构。

## Design decisions (user-confirmed)
1. 日历 = FullCalendar（月/周/日多视图）
2. 笔记 = 真正层级树（后端 parent_id + DB 迁移）

## Metis gap analysis: COMPLETED
7 BLOCKING + 6 WARNING 全部 silently folded in:
- B1: page_size超限 → 新增 GET /notes/all 不分页端点
- B2: FullCalendar CSS导入 → Todo 4 明确 CSS import
- B3: create_note未传parent_id → Todo 3 明确修改 create_note
- B4: API未暴露parent_id参数 → Todo 3 明确 list_notes_endpoint 签名
- B5: FK缺ondelete → Todo 1 添加 ondelete="SET NULL"
- B6: 手动验证矛盾 → 移除"手动"措辞，改浏览器截图
- B7: locale未配置 → Todo 4 添加 locale: 'zh-cn'
- W1-W6: 拖拽回滚、@fullcalendar/core、events回调、CSS清理、create校验、vite build测试 全部融入

## Next step
CLEAR 路径交付：展示计划摘要，询问用户"立即开始执行还是先运行高精度 Momus 审查"
