export type WidgetType =
  | 'stats'
  | 'calendar'
  | 'announcements'
  | 'notifications'
  | 'todos'
  | 'quicklinks';

export interface WidgetItem {
  id: WidgetType;
  visible: boolean;
}

export interface WidgetLayout {
  widgets: WidgetItem[];
}

export const DEFAULT_WIDGET_LAYOUT: WidgetLayout = {
  widgets: [
    { id: 'stats', visible: true },
    { id: 'calendar', visible: true },
    { id: 'announcements', visible: true },
    { id: 'notifications', visible: true },
    { id: 'todos', visible: true },
    { id: 'quicklinks', visible: true },
  ],
};

export const WIDGET_META: Record<
  WidgetType,
  { label: string; description: string }
> = {
  stats: { label: '统计概览', description: '文件、内容、项目、成员数量统计' },
  calendar: { label: '日程日历', description: '即将到期的事项与日程' },
  announcements: { label: '最新公告', description: '团队近期公告动态' },
  notifications: { label: '通知提醒', description: '最近的系统通知' },
  todos: { label: '待办事项', description: '近期待办任务清单' },
  quicklinks: { label: '快捷入口', description: '常用功能快速导航' },
};
