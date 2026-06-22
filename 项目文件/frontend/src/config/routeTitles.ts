export const ROUTE_TITLES: Record<string, string> = {
  '/': '首页',
  '/tasks': '任务管理',
  '/contacts': '客户管理',
  '/calendar': '日历',
  '/votes': '投票决策',
  '/forms': '表单收集',
  '/members': '成员目录',
  '/announcements': '公告中心',
  '/notes': '笔记知识库',
  '/files': '文件管理',
  '/content': '内容管理',
  '/projects': '项目管理',
  '/inventory': '物品管理',
  '/finance': '财务管理',
  '/secrets': '密钥管理',
  '/reminders': '提醒管理',
  '/records': '记录管理',
  '/settings/personalization': '用户个性化',
  '/audit': '审计日志',
  '/settings': '系统设置与管理',
  '/settings/users': '用户管理',
  '/settings/tags': '标签管理',
  '/settings/templates': '模板管理',
  '/settings/site': '站点配置',
  '/settings/sidebar': '侧边栏管理',
  '/settings/devices': '设备管理',
  '/settings/notifications': '通知配置',
  '/settings/backups': '备份管理',
  '/settings/customization': '应用配置',
  '/profile': '个人资料',
};

export function getRouteTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) {
    return ROUTE_TITLES[pathname];
  }
  if (pathname.startsWith('/projects/')) {
    return '项目详情';
  }
  if (pathname.startsWith('/secrets/category/')) {
    return '密钥分类';
  }
  return '';
}
