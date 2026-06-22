# sync-page-titles - Draft

## Status: awaiting-approval
## Pending action: write .omo/plans/sync-page-titles.md (DONE)
## Approach: 创建共享 routeTitles.ts + MainLayout Header 添加同步标题

## Decisions
- 标题放在 Header 左侧（折叠按钮之后），不新建独立标题栏
- 不删除各页面内部 Title（避免大规模改动）
- 动态路由用 startsWith 匹配

## Approval gate
用户确认后执行
