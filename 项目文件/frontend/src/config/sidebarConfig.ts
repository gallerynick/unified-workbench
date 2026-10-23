/**
 * 侧边栏业务菜单的领域分类定义。
 *
 * 背景：21 项业务菜单平铺会让侧栏臃肿。改为按领域分组，每组以一条「淡横线 +
 * 类别名」作为分隔头，点击类别头可折叠该组。
 *
 * 约束：
 * - 组 key 一律用 `group:` 前缀，绝不可与真实路由重合，否则 antd Menu 的
 *   selectedKeys 与 openKeys 会把组头误判为可选中/可展开项。
 * - 个人区 5 项与管理员「系统设置」不在此定义内，仍由 MainLayout 构建。
 */

export interface SidebarItem {
  key: string;
  label: string;
  icon: string;
}

export interface SidebarCategory {
  /** 组标识，形如 group:collab，不参与路由 */
  key: string;
  /** 分隔横线上显示的类别名 */
  label: string;
  items: SidebarItem[];
}

/**
 * 顶部常驻项：不属于任何类别，直接平铺在侧栏最上方、不显示类别头。
 * 首页是导航锚点，不允许被隐藏（见 MANDATORY_ITEM_KEYS）。
 */
export const TOP_LEVEL_ITEMS: SidebarItem[] = [
  { key: '/', label: '首页', icon: 'HomeOutlined' },
  { key: '/notifications', label: '通知中心', icon: 'BellOutlined' },
  { key: '/tasks', label: '任务中心', icon: 'CheckSquareOutlined' },
  { key: '/calendar', label: '日程日历', icon: 'CalendarOutlined' },
];

/**
 * 强制显示的项：不受「侧栏显示项」勾选影响，始终出现。
 * 首页是用户回到工作台起点的唯一入口，被隐藏后只能靠地址栏返回。
 */
export const MANDATORY_ITEM_KEYS: string[] = ['/'];

export const SIDEBAR_CATEGORIES: SidebarCategory[] = [
  {
    key: 'group:collab',
    label: '协作办公',
    items: [
      { key: '/announcements', label: '公告通知', icon: 'SoundOutlined' },
      { key: '/members', label: '成员目录', icon: 'TeamOutlined' },
      { key: '/contacts', label: '联系人管理', icon: 'ContactsOutlined' },
      { key: '/votes', label: '投票决策', icon: 'LikeOutlined' },
      { key: '/forms', label: '表单收集', icon: 'FormOutlined' },
      { key: '/meetings', label: '会议记录', icon: 'SoundOutlined' },
    ],
  },
  {
    key: 'group:content',
    label: '内容知识',
    items: [
      { key: '/notes', label: '笔记知识库', icon: 'BookOutlined' },
      { key: '/content', label: '内容编辑', icon: 'FileTextOutlined' },
      { key: '/shares', label: '文件共享', icon: 'FileOutlined' },
    ],
  },
  {
    key: 'group:project',
    label: '项目管理',
    items: [
      { key: '/projects', label: '项目管理', icon: 'ProjectOutlined' },
      { key: '/secrets', label: '密钥保险箱', icon: 'KeyOutlined' },
      { key: '/reminders', label: '提醒事项', icon: 'BellOutlined' },
    ],
  },
  {
    key: 'group:ops',
    label: '资产运维',
    items: [
      { key: '/inventory', label: '物品管理', icon: 'AppstoreOutlined' },
      { key: '/finance', label: '财务中心', icon: 'MoneyCollectOutlined' },
      { key: '/topology', label: '拓扑结构', icon: 'ApartmentOutlined' },
      { key: '/servers', label: '服务器管理', icon: 'CloudServerOutlined' },
      { key: '/streaming', label: '直播工作室', icon: 'VideoCameraOutlined' },
    ],
  },
];

/** 全部业务菜单项 key（顶部常驻在前，类别项在后，与侧栏展示顺序一致） */
export const ALL_SIDEBAR_ITEM_KEYS: string[] = [
  ...TOP_LEVEL_ITEMS.map((i) => i.key),
  ...SIDEBAR_CATEGORIES.flatMap((c) => c.items.map((i) => i.key)),
];

/** key → 中文名，供个性化页与提示文案复用 */
export const SIDEBAR_ITEM_LABEL: Record<string, string> = Object.fromEntries(
  [...TOP_LEVEL_ITEMS, ...SIDEBAR_CATEGORIES.flatMap((c) => c.items)].map((i) => [
    i.key,
    i.label,
  ]),
);

/**
 * 侧栏展开状态的 localStorage 键。
 * 存「已折叠的类别 key 数组」而非展开数组：新增类别默认展开，无需迁移旧值。
 */
export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'workbench_sidebar_collapsed_groups';

/**
 * 全部类别 key。首次访问时全部默认折叠：
 * 顶部常驻项已平铺展示，类别若再全展开，17 项会把侧栏拉得很长。
 */
export const ALL_CATEGORY_KEYS: string[] = SIDEBAR_CATEGORIES.map((c) => c.key);

/** 默认密度：舒适 */
export type SidebarDensity = 'compact' | 'comfortable';
