export const ROUTE_TITLES: Record<string, string> = {
  '/': '首页',
  '/tasks': '任务中心',
  '/contacts': '联系人管理',
  '/calendar': '日程日历',
  '/votes': '投票决策',
  '/forms': '表单收集',
  '/members': '成员目录',
  '/announcements': '公告通知',
  '/notes': '笔记知识库',
  '/files': '文件中心',
  '/content': '内容编辑',
  '/projects': '项目看板',
  '/inventory': '库存盘点',
  '/finance': '财务中心',
  '/secrets': '密钥保险箱',
  '/reminders': '提醒事项',
  '/topology': '网络拓扑',
  '/stream': '直播工作室',
  '/records': '记录管理',
  '/settings/personalization': '用户个性化',
  '/audit': '审计日志',
  '/settings': '系统设置',
  '/settings/users': '用户账号',
  '/settings/tags': '标签分类',
  '/settings/templates': '模板库',
  '/settings/site': '站点配置',
  '/settings/sidebar': '侧边栏配置',
  '/settings/devices': '设备终端',
  '/settings/notifications': '通知配置',
  '/settings/backups': '数据备份',
  '/settings/customization': '应用配置',
  '/settings/system': '系统更新',
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
