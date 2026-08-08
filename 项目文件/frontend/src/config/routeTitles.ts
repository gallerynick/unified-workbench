export const ROUTE_TITLES: Record<string, string> = {
  '/': '首页',
  '/notifications': '通知中心',
  '/tasks': '任务中心',
  '/contacts': '联系人管理',
  '/calendar': '日程日历',
  '/votes': '投票决策',
  '/forms': '表单收集',
  '/forms/:id/responses': '回复查看',
  '/forms/:id/fill': '表单填写',
  '/members': '成员目录',
  '/announcements': '公告通知',
  '/notes': '笔记知识库',
  '/shares': '文件共享',
  '/content': '内容编辑',
  '/projects': '项目管理',
  '/inventory': '物品管理',
  '/finance': '财务中心',
  '/secrets': '密钥保险箱',
  '/reminders': '提醒事项',
  '/topology': '拓扑结构',
  '/servers': '服务器管理',
  '/stream': '直播工作室',
  '/settings/personalization': '用户个性化',
  '/settings': '系统设置',
  '/settings/users': '用户账号',
  '/settings/tags': '标签分类',
  '/settings/templates': '模板库',
  '/settings/site': '站点配置',
  '/settings/notifications': '通知配置',
  '/settings/backups': '数据备份',
  '/data': '数据导入导出',
  '/settings/customization': '应用配置',
  '/settings/system': '系统更新',
  '/settings/storage': '存储设置',
  '/profile': '个人资料',
  '/me/notifications': '通知配置',
  '/devices': '设备终端',
};

export function getRouteTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) {
    return ROUTE_TITLES[pathname];
  }
  if (pathname.startsWith('/projects/')) {
    return '项目详情';
  }
  if (pathname.startsWith('/servers/')) {
    if (pathname.includes('/systems/')) {
      return '系统详情';
    }
    return '服务器详情';
  }
  if (pathname.startsWith('/secrets/category/')) {
    return '密钥分类';
  }
  if (pathname.startsWith('/share/')) {
    return '文件下载';
  }
  if (pathname.startsWith('/data')) {
    return '数据导入导出';
  }
  return '';
}
