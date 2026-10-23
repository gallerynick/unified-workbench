import {
  ApartmentOutlined,
  AppstoreOutlined,
  BellOutlined,
  BgColorsOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  ContactsOutlined,
  DatabaseOutlined,
  DashboardOutlined,
  DesktopOutlined,
  DownOutlined,
  SafetyOutlined,
  FileOutlined,
  FileTextOutlined,
  FormOutlined,
  GlobalOutlined,
  HomeOutlined,
  KeyOutlined,
  LikeOutlined,
  LockOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  MoneyCollectOutlined,
  PauseCircleOutlined,
  ProjectOutlined,
  SettingOutlined,
  SkinOutlined,
  SoundOutlined,
  SwapOutlined,
  TagOutlined,
  TeamOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import {
  Avatar,
  Button,
  ConfigProvider,
  Drawer,
  Dropdown,
  Layout,
  Menu,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import DebugModeOverlay from '../components/DebugModeOverlay';
import NotificationBell from '../components/NotificationBell';
import NotificationDrawer from '../components/NotificationDrawer';
import StatusIndicator from '../components/StatusIndicator';
import VotePopup from '../components/VotePopup';
import { getRouteTitle } from '../config/routeTitles';
import {
  ALL_CATEGORY_KEYS,
  ALL_SIDEBAR_ITEM_KEYS,
  MANDATORY_ITEM_KEYS,
  SIDEBAR_CATEGORIES,
  TOP_LEVEL_ITEMS,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  type SidebarDensity,
  type SidebarItem,
} from '../config/sidebarConfig';
import { useLockContext } from '../contexts/LockContext';
import { TagProvider } from '../contexts/TagContext';
import { useTheme, type ThemeMode } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { getUserPreferences } from '../api/user-preferences';
import { useResponsive } from '../hooks/useBreakpoint';
import { useCustomization } from '../hooks/useCustomization';
import { usePageZoom } from '../hooks/usePageZoom';
import { pauseIdleTimer, resumeIdleTimer, useIdleTimer } from '../hooks/useIdleTimer';
import { useStatusProbes } from '../hooks/useStatusProbes';
import { useWebSocket } from '../hooks/useWebSocket';
import { isAdmin, logout } from '../utils/auth';
import styles from './MainLayout.module.css';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const ICON_MAP: Record<string, React.ReactNode> = {
  HomeOutlined: <HomeOutlined />,
  FileOutlined: <FileOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  ProjectOutlined: <ProjectOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
  MoneyCollectOutlined: <MoneyCollectOutlined />,
  KeyOutlined: <KeyOutlined />,
  BellOutlined: <BellOutlined />,
  CheckSquareOutlined: <CheckSquareOutlined />,
  ContactsOutlined: <ContactsOutlined />,
  CalendarOutlined: <CalendarOutlined />,
  LikeOutlined: <LikeOutlined />,
  FormOutlined: <FormOutlined />,
  TeamOutlined: <TeamOutlined />,
  SoundOutlined: <SoundOutlined />,
  BookOutlined: <BookOutlined />,
  SettingOutlined: <SettingOutlined />,
  ApartmentOutlined: <ApartmentOutlined />,
  VideoCameraOutlined: <VideoCameraOutlined />,
  CloudServerOutlined: <CloudServerOutlined />,
  DatabaseOutlined: <DatabaseOutlined />,
  DashboardOutlined: <DashboardOutlined />,
};

/** 个人区菜单项（位于业务领域分类之后、系统设置之前） */
const PERSONAL_ITEM_KEYS = [
  '/profile',
  '/settings/personalization',
  '/settings/notifications',
  '/settings/devices',
  '/settings/security',
];

/**
 * 一级菜单 key 集合（业务项 + 个人区 + 系统设置入口）。
 * 「自动折叠模块栏」只对一级项生效——分组后菜单层级变深，
 * 若点击二级项也收起侧栏，用户每次都要重新展开才能继续找同级模块。
 */
const LEVEL_ONE_KEYS = new Set<string>([
  ...ALL_SIDEBAR_ITEM_KEYS,
  ...PERSONAL_ITEM_KEYS,
  '/settings',
]);

/** 业务菜单项 → antd Menu items（图标在 ICON_MAP 中解析） */
function toMenuItems(items: SidebarItem[]): MenuProps['items'] {
  return items.map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon ? (ICON_MAP[item.icon] ?? null) : null,
  }));
}

/**
 * 系统设置二级子菜单项。
 * 单一数据源：菜单渲染与「路由进入子页时自动展开」的判定都读这里，
 * 避免两处清单各写一份而漂移。
 */
const SETTINGS_SUBMENU_ENTRIES: { key: string; label: string; icon: React.ReactNode }[] = [
  { key: '/settings/users', label: '用户账号', icon: <TeamOutlined /> },
  { key: '/settings/tags', label: '用户标签分类', icon: <TagOutlined /> },
  { key: '/settings/templates', label: '模板库', icon: <FormOutlined /> },
  { key: '/settings/site', label: '站点配置', icon: <GlobalOutlined /> },
  { key: '/settings/third-party', label: '第三方服务', icon: <SoundOutlined /> },
  { key: '/settings/backups', label: '数据备份', icon: <CloudServerOutlined /> },
  { key: '/settings/transfer', label: '数据迁转', icon: <SwapOutlined /> },
  { key: '/settings/customization', label: '应用配置', icon: <SkinOutlined /> },
  { key: '/settings/system', label: '系统更新', icon: <CloudServerOutlined /> },
  { key: '/settings/storage', label: '存储设置', icon: <DatabaseOutlined /> },
  { key: '/settings/monitor', label: '资源监视', icon: <DashboardOutlined /> },
];

const SETTINGS_SUBMENU_CHILDREN: MenuProps['items'] = SETTINGS_SUBMENU_ENTRIES;

const SETTINGS_SUBMENU_CHILD_KEYS = SETTINGS_SUBMENU_ENTRIES.map((entry) => entry.key);

/** 底部区块：个人区 5 项 + 管理员「系统设置」二级菜单 */
function getSettingsMenuItems(): MenuProps['items'] {
  const items: MenuProps['items'] = [];

  items.push(
    { type: 'divider' },
    {
      key: '/profile',
      icon: <UserOutlined />,
      label: '个人资料',
    },
    {
      key: '/settings/personalization',
      icon: <BgColorsOutlined />,
      label: '用户个性化',
    },
    {
      key: '/settings/notifications',
      icon: <BellOutlined />,
      label: '通知配置',
    },
    {
      key: '/settings/devices',
      icon: <DesktopOutlined />,
      label: '设备终端',
    },
    {
      key: '/settings/security',
      icon: <SafetyOutlined />,
      label: '安全设置',
    },
  );

  if (isAdmin()) {
    items.push({
      key: '/settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      'data-menu-id': '/settings',
      children: SETTINGS_SUBMENU_CHILDREN,
    });
  }

  return items;
}


/**
 * 飞入动画的统一选择器：菜单项 + 类别头。
 * 类别头（[data-cat-header]）必须与菜单项走同一条时间轴，否则会出现
 * 「类别名已就位、菜单项还在飞」的脱节感。
 */
const MENU_ANIM_SELECTOR =
  '.ant-menu-item, .ant-menu-submenu > .ant-menu-submenu-title, [data-cat-header], [data-rail-divider]';

/** 按 DOM 顺序为所有菜单项与类别头分配飞入动画延迟（40ms 递增） */
function assignMenuAnimDelays(container: HTMLElement): void {
  const items = container.querySelectorAll(MENU_ANIM_SELECTOR);
  items.forEach((el, i) => {
    const delay = i * 40 + 'ms';
    (el as HTMLElement).style.animationDelay = delay;
  });
}

/** 清除内联动画延迟（动画完成后恢复干净状态） */
function clearMenuAnimDelays(container: HTMLElement): void {
  const items = container.querySelectorAll(MENU_ANIM_SELECTOR);
  items.forEach((el) => {
    (el as HTMLElement).style.animationDelay = '';
  });
}

const userMenuItems: MenuProps['items'] = [
  {
    key: 'profile',
    label: '个人资料',
  },
  {
    key: 'logout',
    label: '退出登录',
  },
];

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [autoCollapseSidebar, setAutoCollapseSidebar] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    // 从 localStorage 恢复菜单展开状态
    const stored = localStorage.getItem('workbench_menu_open_keys');
    return stored ? JSON.parse(stored) : [];
  });
  /** 用户勾选要显示的侧栏项；null = 全部显示（默认，含新增项自动出现） */
  const [visibleItemKeys, setVisibleItemKeys] = useState<string[] | null>(null);
  const [density, setDensity] = useState<SidebarDensity>('comfortable');
  /**
   * 已折叠的类别 key（存 localStorage，设备级）。
   * 存「已折叠」而非「已展开」：将来新增类别默认展开，无需迁移旧值。
   */
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as string[];
      }
    } catch {
      // 解析失败按首次访问处理
    }
    // 首次访问：全部类别折叠。顶部常驻项已平铺，类别再全展开会让侧栏过长
    return [...ALL_CATEGORY_KEYS];
  });
  const [idlePaused, setIdlePaused] = useState(() => {
    const stored = sessionStorage.getItem('workbench_idle_paused') === 'true';
    // 双向对齐而非只处理 'true'：模块级的暂停原因集合存活在整个单页应用期间，
    // 若 sessionStorage 已被清空而集合仍残留 'manual'，就会出现
    // 「顶栏显示未暂停、实际永不锁定」的反向不一致（安全洞）。
    if (stored) {
      pauseIdleTimer('manual');
    } else {
      resumeIdleTimer('manual');
    }
    return stored;
  });
  const [sidebarEntered, setSidebarEntered] = useState(false);
  /**
   * 进场动画是否已播完。
   * 播完后不再给新挂载的节点加动画：否则每次「收起 / 展开侧栏」都会重挂载
   * 整批菜单节点，导致侧栏宽度是平滑滑动的、而里面的图标却在重新逐个飞入，
   * 两种节奏打架。进场动画只应发生一次。
   */
  const [entryAnimDone, setEntryAnimDone] = useState(false);
  const siderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSidebarEntered(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // 侧边栏动画：按 DOM 顺序动态分配延迟（新增菜单项自动包含，无需维护 nth-child 规则）
  useEffect(() => {
    if (!sidebarEntered || !siderRef.current) return;
    const container = siderRef.current;
    assignMenuAnimDelays(container);
    // 动画完成后清理内联延迟，避免后续残留。
    // 超时不能写死 1500ms：延迟是 40ms × DOM 顺序递增，分组后节点数上升，
    // 40ms × 42 ≈ 1680ms 已越过固定值，末尾几项会在动画开始前被清掉 delay
    // （表现为「跳出来」而不是飞入）。按实际节点数推导并留 400ms 动画余量。
    const nodeCount = container.querySelectorAll(MENU_ANIM_SELECTOR).length;
    const cleanupDelay = Math.max(1500, nodeCount * 40 + 400);
    const cleanup = setTimeout(() => {
      clearMenuAnimDelays(container);
      // 动画播完后关闭后续节点的入场动画（CSS 侧由 sidebar-entry-done 控制）。
      // 只在 timeout 回调里置位，不在 cleanup 里——StrictMode 的立即 cleanup
      // 会让状态提前变 true，导致进场动画被跳过。
      setEntryAnimDone(true);
    }, cleanupDelay);
    return () => clearTimeout(cleanup);
    // 只依赖进场时机：折叠态 / 密度 / 类别折叠的变化不应重播进场动画
  }, [sidebarEntered]);

  // 系统设置的子项是「展开时才挂载」的新节点：主延迟分配只覆盖进组那一刻，
  // 因此它们会整块同时冒出、完全没有错峰。
  // 这里在展开时为子项单独补一段组内 40ms 步进——从 0 起算而不是沿用全局序号，
  // 否则排在第 30 多位的子项要等 1 秒以上才出现。
  useEffect(() => {
    const container = siderRef.current;
    // 进场动画结束后不再有 animation，补延迟已无意义
    if (!container || collapsed || entryAnimDone) return;
    const subItems = container.querySelectorAll('.ant-menu-sub .ant-menu-item');
    subItems.forEach((el, i) => {
      (el as HTMLElement).style.animationDelay = `${i * 40}ms`;
    });
  }, [openKeys, collapsed, entryAnimDone]);
  const navigate = useNavigate();
  const location = useLocation();
  const selectedKey = useMemo(() => {
    // 只对业务项做前缀匹配：组 key（group:xxx）不是路由，个人区/系统设置项
    // 靠末尾的 pathname 兜底即可，避免组头被误判为选中。
    const keys = [...ALL_SIDEBAR_ITEM_KEYS].sort((a, b) => b.length - a.length);
    if (ALL_SIDEBAR_ITEM_KEYS.includes(location.pathname)) return location.pathname;
    for (const key of keys) {
      if (location.pathname.startsWith(key + '/') || location.pathname.startsWith(key + '?')) {
        return key;
      }
    }
    // 直播观看页不在侧栏中，但属于「直播工作室」的子页面，高亮父项
    if (location.pathname.startsWith('/stream/watch/')) return '/streaming';
    return location.pathname;
  }, [location.pathname]);

  // 当前路由所属类别自动展开：否则默认折叠后，选中项藏在收起的组里看不见。
  // 不写 localStorage——用户手动收起当前组时不应被立刻弹开，下次换页再展开一次即可。
  useEffect(() => {
    const owner = SIDEBAR_CATEGORIES.find((cat) =>
      cat.items.some((item) => item.key === selectedKey),
    );
    if (!owner) return;
    setCollapsedGroups((prev) =>
      prev.includes(owner.key) ? prev.filter((key) => key !== owner.key) : prev,
    );
  }, [selectedKey]);

  /** 勾选集合；未设置时视为全部勾选。强制项（首页）无论偏好如何都并入。 */
  const visibleSet = useMemo(() => {
    const set = new Set(visibleItemKeys ?? ALL_SIDEBAR_ITEM_KEYS);
    for (const key of MANDATORY_ITEM_KEYS) set.add(key);
    return set;
  }, [visibleItemKeys]);

  /** 顶部常驻项（无类别头，平铺在最上方） */
  const visibleTopItems = useMemo(
    () => TOP_LEVEL_ITEMS.filter((item) => visibleSet.has(item.key)),
    [visibleSet],
  );

  /** 需要渲染的类别：剔除空组（该组项目全部未勾选时整组不出现） */
  const visibleCategories = useMemo(
    () =>
      SIDEBAR_CATEGORIES.map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => visibleSet.has(item.key)),
      })).filter((cat) => cat.items.length > 0),
    [visibleSet],
  );

  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = prev.includes(groupKey)
        ? prev.filter((k) => k !== groupKey)
        : [...prev, groupKey];
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  /** 菜单点击：导航；「自动折叠模块栏」只对一级项生效 */
  const handleMenuItemClick = useCallback(
    ({ key }: { key: string }) => {
      navigate(key);
      if (autoCollapseSidebar && LEVEL_ONE_KEYS.has(key)) setCollapsed(true);
    },
    [navigate, autoCollapseSidebar],
  );

  // 路由变化时自动展开对应菜单，并持久化到 localStorage。
  // 折叠状态下跳过：受控 openKeys 若含子菜单 key，antd 5 在 inline-collapsed 下
  // 会让子菜单弹出层保持打开（表现为二级菜单收纳后仍常驻）。
  // 路由进入「系统设置」的某个子页时，自动展开该二级菜单一次。
  //
  // 刻意不把 openKeys 放进依赖：旧写法依赖 openKeys，用户手动收起后 effect
  // 会立刻把 '/settings' 推回去，表现为「在设置页里系统设置怎么都收不起来」。
  // 另外只认真正的子页 key——'/settings/personalization' 等个人区路由不属于
  // 该子菜单，不应触发它的展开。
  useEffect(() => {
    if (collapsed) return;
    const inSettingsChild = SETTINGS_SUBMENU_CHILD_KEYS.some(
      (key) => location.pathname === key || location.pathname.startsWith(key + '/'),
    );
    if (!inSettingsChild) return;
    setOpenKeys((prev) => (prev.includes('/settings') ? prev : [...prev, '/settings']));
  }, [location.pathname, collapsed]);
  const { notifications, unreadCount, connected, markAsRead, markAllAsRead } = useWebSocket();
  // 暂停/恢复是副作用，必须放在 setState 更新函数之外——React 在 StrictMode
  // 下会重复调用更新函数，副作用写在里面会被执行两次。
  const toggleIdlePause = useCallback(() => {
    const next = !idlePaused;
    if (next) {
      pauseIdleTimer('manual');
    } else {
      resumeIdleTimer('manual');
    }
    sessionStorage.setItem('workbench_idle_paused', String(next));
    setIdlePaused(next);
  }, [idlePaused]);
  const { isMobile } = useResponsive();
  const customization = useCustomization();
  const { isDark, setTheme } = useTheme();
  const { user } = useUser();
  const { isLocked, locking, lock } = useLockContext();
  useIdleTimer();
  // 状态指示：登录后启用服务级探测（C3/C4/C5）与实时通道、锁定预警（A3/E1）
  const statusIssues = useStatusProbes({ authed: user !== null, wsConnected: connected });

  // 页面缩放：在 documentElement 上应用 CSS zoom（见 hooks/usePageZoom.ts）
  usePageZoom();

  // 主题（从用户偏好加载）
  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const res = await getUserPreferences();
        if (res.code === 0 && res.data) {
          const prefs = res.data;
          if (prefs.theme_mode) setTheme(prefs.theme_mode as ThemeMode);
          // 「自动折叠模块栏」偏好：开启后点击模块即收起侧边栏
          setAutoCollapseSidebar(prefs.auto_collapse_sidebar ?? false);
          // 侧栏显示项：null = 从未设置（全部显示）；空数组合法（用户全部取消勾选）
          setVisibleItemKeys(
            Array.isArray(prefs.sidebar_visible_items) ? prefs.sidebar_visible_items : null,
          );
          setDensity(prefs.sidebar_density === 'compact' ? 'compact' : 'comfortable');
        }
      } catch {
        // 忽略错误
      }
    })();
  }, [user, setTheme]);

  useEffect(() => {
    const themeHandler = (e: CustomEvent<string>) => setTheme(e.detail as ThemeMode);
    window.addEventListener('theme-changed', themeHandler as EventListener);
    return () => {
      window.removeEventListener('theme-changed', themeHandler as EventListener);
    };
  }, [setTheme]);

  // 「自动折叠模块栏」偏好变更：个性化页保存后即时同步，无需刷新
  useEffect(() => {
    const collapseHandler = (e: CustomEvent<boolean>) => setAutoCollapseSidebar(e.detail);
    window.addEventListener('auto-collapse-changed', collapseHandler as EventListener);
    return () => {
      window.removeEventListener('auto-collapse-changed', collapseHandler as EventListener);
    };
  }, []);

  // 侧栏个性化（显示项 / 折叠未显示 / 密度）保存后即时同步，无需刷新
  useEffect(() => {
    type SidebarPrefsEvent = CustomEvent<{
      visible_items?: string[] | null;
      density?: SidebarDensity;
    }>;
    const handler = (e: SidebarPrefsEvent) => {
      const detail = e.detail ?? {};
      if ('visible_items' in detail) setVisibleItemKeys(detail.visible_items ?? null);
      if (detail.density === 'compact' || detail.density === 'comfortable') {
        setDensity(detail.density);
      }
    };
    window.addEventListener('sidebar-prefs-changed', handler as EventListener);
    return () => {
      window.removeEventListener('sidebar-prefs-changed', handler as EventListener);
    };
  }, []);

  const [loggingOut, setLoggingOut] = useState(false);

  // 解锁溶回：LockPage 通过 sessionStorage 传信号，MainLayout 播放反向模糊进场
  const [welcoming, setWelcoming] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem('workbench_just_unlocked') === '1') {
      sessionStorage.removeItem('workbench_just_unlocked');
      setWelcoming(true);
      const timer = setTimeout(() => setWelcoming(false), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  // 工作台被锁定时跳转到锁屏页
  useEffect(() => {
    if (isLocked) {
      navigate('/lock');
    }
  }, [isLocked, navigate]);

  const handleMenuOpenChange = useCallback((newOpenKeys: string[]) => {
    setOpenKeys(newOpenKeys);
    localStorage.setItem('workbench_menu_open_keys', JSON.stringify(newOpenKeys));
    
    if (newOpenKeys.includes('/settings')) {
      setTimeout(() => {
        const settingsItem = document.querySelector('[data-menu-id="/settings"]');
        if (settingsItem) {
          settingsItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 350);
    }
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
      }}
    >
      <TagProvider>
        <Layout
          className={[
            locking || loggingOut ? styles.locking ?? '' : '',
            welcoming ? styles.welcoming ?? '' : '',
          ].filter(Boolean).join(' ')}
          style={{
            height: '100%',
            background: 'var(--canvas-parchment)',
            transition: 'filter 0.5s ease',
            display: 'flex',
          }}
        >
          {!isMobile && (
            <div
              className={`sider-scroll-container${sidebarEntered ? ' sidebar-entered' : ''}${
                entryAnimDone ? ' sidebar-entry-done' : ''
              }`}
              style={{
                height: '100%',
                position: 'absolute',
                left: 0,
                top: 0,
                width: collapsed ? 'var(--sider-collapsed-width)' : 'var(--sider-width)',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                background: 'var(--sider-bg)',
              }}
            >
            <div
              style={{
                height: 64,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottom: 'var(--sider-border)',
                gap: 2,
                flexShrink: 0,
              }}
            >
              {collapsed ? (
                customization.branding.displayMode !== 'text' &&
                customization.branding.logoCollapsed ? (
                  <img
                    src={customization.branding.logoCollapsed}
                    alt="Logo"
                    style={{ height: 28 }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: 'var(--text-heading-3-size)',
                      fontWeight: 'bold',
                      color: 'var(--ink)',
                    }}
                  >
                    {customization.app.shortName}
                  </span>
                )
              ) : (
                <>
                  {customization.branding.displayMode !== 'text' &&
                    customization.branding.logoExpanded && (
                      <img
                        src={customization.branding.logoExpanded}
                        alt="Logo"
                        style={{ height: 28 }}
                      />
                    )}
                  {customization.branding.displayMode !== 'icon' && (
                    <span
                      style={{
                        fontSize:
                          customization.branding.displayMode === 'both'
                            ? 'var(--text-body-xs-size)'
                            : 'var(--text-heading-4-size)',
                        fontWeight: 'bold',
                        color: 'var(--ink)',
                      }}
                    >
                      {customization.app.name}
                    </span>
                  )}
                </>
              )}
            </div>
            <div
              ref={siderRef}
              className="sider-menu-scroll"
              style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
            >
              <ConfigProvider
                theme={{
                  components: {
                    Menu: {
                      itemHeight: density === 'compact' ? 30 : 36,
                      itemPaddingInline: 16,
                      itemBorderRadius: 8,
                      fontSize: 14,
                      activeBarBorderWidth: collapsed ? 3 : 0,
                      itemActiveBg: 'var(--sider-menu-item-active-bg)',
                      itemSelectedBg: 'var(--sider-menu-item-active-bg)',
                      itemSelectedColor: 'var(--sider-menu-item-active-text)',
                      itemHoverBg: 'var(--sider-menu-item-hover-bg)',
                      subMenuItemBg: 'transparent',
                    },
                  },
                }}
              >
                <Sider
                  width="var(--sider-width)"
                  collapsedWidth="var(--sider-collapsed-width)"
                  collapsible
                  collapsed={collapsed}
                  onCollapse={setCollapsed}
                  trigger={null}
                  theme={isDark ? 'dark' : 'light'}
                  style={{
                    height: '100%',
                    borderRight: 'var(--sider-border)',
                    background: 'var(--sider-bg)',
                  }}
                >
                  {/* 业务菜单按领域分块。
                      折叠成图标栏时不显示类别名（80px 放不下），但仍在类别之间
                      保留一条居中的短横线——否则整条栏是一串无差别图标，难以定位。 */}
                  {collapsed ? (
                    /* 顶部常驻项平铺在栏首，其后每个类别之间用居中短横线分隔。
                       遵守展开态的类别折叠状态：已收起的类别在图标栏里同样不出现，
                       不能被收栏动作「重新摊开」。 */
                    <>
                      {visibleTopItems.length > 0 && (
                        <div className={styles.siderMenuRail}>
                          <Menu
                            mode="inline"
                            selectedKeys={[selectedKey]}
                            items={toMenuItems(visibleTopItems) ?? []}
                            onClick={handleMenuItemClick}
                            style={{ borderRight: 0 }}
                          />
                        </div>
                      )}
                      {visibleCategories
                        .filter((cat) => !collapsedGroups.includes(cat.key))
                        .map((cat) => (
                          <div key={cat.key} className={styles.siderMenuRail}>
                            <div
                              className={styles.railDivider}
                              data-rail-divider=""
                              aria-hidden="true"
                            />
                            <Menu
                              mode="inline"
                              selectedKeys={[selectedKey]}
                              items={toMenuItems(cat.items) ?? []}
                              onClick={handleMenuItemClick}
                              style={{ borderRight: 0 }}
                            />
                          </div>
                        ))}
                    </>
                  ) : (
                    <>
                      {/* 顶部常驻项：无类别头，直接平铺 */}
                      {visibleTopItems.length > 0 && (
                        <div className={styles.categorySection}>
                          <Menu
                            mode="inline"
                            selectedKeys={[selectedKey]}
                            items={toMenuItems(visibleTopItems) ?? []}
                            onClick={handleMenuItemClick}
                            style={{ borderRight: 0 }}
                          />
                        </div>
                      )}
                      {visibleCategories.map((cat) => {
                      const groupCollapsed = collapsedGroups.includes(cat.key);
                      return (
                        <div key={cat.key} className={styles.categorySection}>
                          <button
                            type="button"
                            data-cat-header=""
                            className={styles.categoryHeader}
                            aria-expanded={!groupCollapsed}
                            onClick={() => toggleGroup(cat.key)}
                          >
                            <span className={styles.categoryLabel}>{cat.label}</span>
                            <DownOutlined
                              className={`${styles.categoryCaret}${
                                groupCollapsed ? ` ${styles.categoryCaretCollapsed} ${styles.categoryCaretShown ?? ''}` : ''
                              }`}
                            />
                            {/* 分组标记：类别名之后延伸的细线，读作「标题」而非「分隔线」 */}
                            <span className={styles.categoryRule} aria-hidden="true" />
                          </button>
                          {!groupCollapsed && (
                            <Menu
                              mode="inline"
                              selectedKeys={[selectedKey]}
                              items={toMenuItems(cat.items) ?? []}
                              onClick={handleMenuItemClick}
                              style={{ borderRight: 0 }}
                            />
                          )}
                        </div>
                      );
                    })}
                    </>
                  )}

                  {/* 底部区块：个人区 + 系统设置；首项是加深的分隔线。
                      图标栏状态下该线收窄为与类别短横线同宽，视觉语言统一。 */}
                  <div
                    className={`${styles.settingsSection ?? ''}${
                      collapsed ? ` ${styles.settingsSectionRail ?? ''}` : ''
                    }`}
                  >
                    <Menu
                      mode="inline"
                      selectedKeys={[selectedKey]}
                      {...(collapsed ? {} : { openKeys })}
                      items={getSettingsMenuItems() ?? []}
                      onClick={handleMenuItemClick}
                      onOpenChange={handleMenuOpenChange}
                      style={{ borderRight: 0 }}
                    />
                  </div>
                </Sider>
              </ConfigProvider>
            </div>
          </div>
        )}

        {isMobile && (
          <Drawer
            open={menuDrawerOpen}
            onClose={() => setMenuDrawerOpen(false)}
            placement="left"
            width={250}
            styles={{ body: { padding: 0 } }}
          >
            <div
              style={{
                height: 64,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottom: 'var(--sider-border)',
                gap: 2,
              }}
            >
              {customization.branding.displayMode !== 'text' &&
                customization.branding.logoExpanded && (
                  <img
                    src={customization.branding.logoExpanded}
                    alt="Logo"
                    style={{ height: 28 }}
                  />
                )}
              {customization.branding.displayMode !== 'icon' && (
                <span
                  style={{
                    fontSize:
                      customization.branding.displayMode === 'both'
                        ? 'var(--text-body-xs-size)'
                        : 'var(--text-heading-4-size)',
                    fontWeight: 'bold',
                  }}
                >
                  {customization.app.name}
                </span>
              )}
            </div>
            <div style={{ maxHeight: 'calc(100vh - 64px)', overflowY: 'auto' }}>
              {/* 移动端与桌面共用同一套类别分块与折叠状态，保证两端一致 */}
              {visibleCategories.map((cat) => {
                const groupCollapsed = collapsedGroups.includes(cat.key);
                return (
                  <div key={cat.key} className={styles.categorySection}>
                    <button
                      type="button"
                      data-cat-header=""
                      className={styles.categoryHeader}
                      aria-expanded={!groupCollapsed}
                      onClick={() => toggleGroup(cat.key)}
                    >
                      <span className={styles.categoryLabel}>{cat.label}</span>
                      <DownOutlined
                        className={`${styles.categoryCaret}${
                          groupCollapsed ? ` ${styles.categoryCaretCollapsed} ${styles.categoryCaretShown ?? ''}` : ''
                        }`}
                      />
                      <span className={styles.categoryRule} aria-hidden="true" />
                    </button>
                    {!groupCollapsed && (
                      <Menu
                        mode="inline"
                        selectedKeys={[selectedKey]}
                        items={toMenuItems(cat.items) ?? []}
                        onClick={({ key }) => {
                          navigate(key);
                          setMenuDrawerOpen(false);
                        }}
                        style={{ borderRight: 0 }}
                      />
                    )}
                  </div>
                );
              })}

              <div className={styles.settingsSection}>
                <Menu
                  mode="inline"
                  selectedKeys={[selectedKey]}
                  openKeys={openKeys}
                  items={getSettingsMenuItems() ?? []}
                  onClick={({ key }) => {
                    navigate(key);
                    setMenuDrawerOpen(false);
                  }}
                  onOpenChange={handleMenuOpenChange}
                  style={{ borderRight: 0 }}
                />
              </div>
            </div>
          </Drawer>
        )}

        <Layout
          className={`${styles.appLayout}${sidebarEntered ? ` ${styles.appEntered}` : ''}`}
          style={{
            marginLeft: isMobile
              ? 0
              : collapsed
                ? 'var(--sider-collapsed-width)'
                : 'var(--sider-width)',
            transition: 'margin-left 0.2s',
            background: 'var(--canvas-parchment)',
            height: '100%',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          <Header
            style={{
              padding: isMobile ? '0 16px' : '0 24px',
              background: 'var(--header-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: 'var(--header-border)',
              position: 'sticky',
              top: 0,
              zIndex: 'var(--z-sticky)',
              height: 64,
            }}
          >
            <Space>
              {isMobile && (
                <Button
                  type="text"
                  icon={<MenuOutlined />}
                  aria-label="打开导航菜单"
                  onClick={() => setMenuDrawerOpen(true)}
                  style={{ fontSize: 'var(--text-button-large-size)' }}
                />
              )}
              {!isMobile && (
                <button
                  type="button"
                  aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
                  onClick={() => setCollapsed(!collapsed)}
                  style={{
                    fontSize: 'var(--text-button-large-size)',
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    lineHeight: 1,
                    color: 'var(--ink)',
                  }}
                >
                  {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                </button>
              )}
            </Space>
            <Text
              strong
              style={{
                fontSize: 'var(--text-heading-4-size)',
                marginLeft: 8,
                flex: 1,
                textAlign: 'center',
              }}
            >
              {getRouteTitle(location.pathname)}
            </Text>
            <StatusIndicator issues={statusIssues} layout="inline" />
            <div className={styles.headerActions}>
              <Tooltip title="手动锁定工作台">
                <Button
                  type="text"
                  className={styles.headerIconButton ?? ''}
                  icon={
                    <LockOutlined style={{ fontSize: 'var(--header-icon-size)' }} />
                  }
                  aria-label="手动锁定工作台"
                  onClick={lock}
                />
              </Tooltip>
              <Tooltip title={idlePaused ? '自动锁定已暂停' : '空闲 5 分钟自动锁定'}>
                <Button
                  type="text"
                  className={styles.headerIconButton ?? ''}
                  icon={
                    idlePaused ? (
                      <PauseCircleOutlined style={{ fontSize: 'var(--header-icon-size)' }} />
                    ) : (
                      <ClockCircleOutlined style={{ fontSize: 'var(--header-icon-size)' }} />
                    )
                  }
                  aria-label={idlePaused ? '恢复自动锁定' : '暂停自动锁定'}
                  onClick={toggleIdlePause}
                  style={{
                    color: idlePaused ? 'var(--color-warning)' : undefined,
                  }}
                />
              </Tooltip>
              <NotificationBell
                buttonClassName={styles.headerIconButton ?? ''}
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAsRead={markAsRead}
                onMarkAllAsRead={markAllAsRead}
              />
              <Dropdown
                menu={{
                  items: userMenuItems ?? [],
                  onClick: ({ key }) => {
                    if (key === 'profile') navigate('/profile');
                    if (key === 'logout') {
                      setLoggingOut(true);
                      // 先撤销服务端会话再跳转：否则本次会话仍被计入
                      // 「其他在线会话」，其他设备上的并发登录提示不会消失。
                      void logout().then(() => navigate('/login'));
                    }
                  },
                }}
                placement="bottomRight"
              >
                <div className={styles.headerUser}>
                  <Avatar
                    size="default"
                    src={user?.avatar || undefined}
                    icon={!user?.avatar ? <UserOutlined /> : undefined}
                  />
                  {!isMobile && <span>{user?.nickname || '管理员'}</span>}
                </div>
              </Dropdown>
            </div>
          </Header>
          <Content
            className={styles.content}
            style={{
              margin: isMobile ? 8 : 24,
              padding: 24,
              background: 'var(--canvas)',
              borderRadius: 'var(--rounded-sm)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'auto',
            }}
          >
            <div
              key={location.pathname}
              className={styles.transitionWrapper}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              <Outlet />
            </div>
          </Content>
          <NotificationDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            notifications={notifications}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
          />
          <VotePopup />
          {(locking || loggingOut) && <div className={styles.lockOverlay ?? ''} />}
          <DebugModeOverlay />
        </Layout>
      </Layout>
    </TagProvider>
    </div>
  );
}