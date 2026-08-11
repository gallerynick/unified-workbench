import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, ConfigProvider, Avatar, Dropdown, Space, Drawer, Button, Typography, Tooltip } from 'antd';
import {
  SettingOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MenuOutlined,
  CloudServerOutlined,
  TeamOutlined,
  SkinOutlined,
  GlobalOutlined,
  FormOutlined,
  HomeOutlined,
  FileOutlined,
  FileTextOutlined,
  ProjectOutlined,
  AppstoreOutlined,
  MoneyCollectOutlined,
  KeyOutlined,
  BellOutlined,
  CheckSquareOutlined,
  ContactsOutlined,
  CalendarOutlined,
  DatabaseOutlined,
  LikeOutlined,
  SoundOutlined,
  BookOutlined,
  TagOutlined,
  BgColorsOutlined,
  ApartmentOutlined,
  VideoCameraOutlined,
  DesktopOutlined,
  SwapOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useWebSocket } from '../hooks/useWebSocket';
import { useIdleTimer, pauseIdleTimer, resumeIdleTimer } from '../hooks/useIdleTimer';
import { useResponsive } from '../hooks/useBreakpoint';
import { useCustomization } from '../hooks/useCustomization';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { useLockContext } from '../contexts/LockContext';
import { clearTokens, isAdmin } from '../utils/auth';
import { TagProvider } from '../contexts/TagContext';
import NotificationBell from '../components/NotificationBell';
import NotificationDrawer from '../components/NotificationDrawer';
import VotePopup from '../components/VotePopup';
import { getRouteTitle } from '../config/routeTitles';
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
};

interface SidebarItem {
  key: string;
  label: string;
  icon: string;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { key: '/', label: '首页', icon: 'HomeOutlined' },
  { key: '/notifications', label: '通知中心', icon: 'BellOutlined' },
  { key: '/announcements', label: '公告通知', icon: 'SoundOutlined' },
  { key: '/tasks', label: '任务中心', icon: 'CheckSquareOutlined' },
  { key: '/contacts', label: '联系人管理', icon: 'ContactsOutlined' },
  { key: '/calendar', label: '日程日历', icon: 'CalendarOutlined' },
  { key: '/votes', label: '投票决策', icon: 'LikeOutlined' },
  { key: '/forms', label: '表单收集', icon: 'FormOutlined' },
  { key: '/notes', label: '笔记知识库', icon: 'BookOutlined' },
  { key: '/shares', label: '文件共享', icon: 'FileOutlined' },
  { key: '/content', label: '内容编辑', icon: 'FileTextOutlined' },
  { key: '/projects', label: '项目管理', icon: 'ProjectOutlined' },
  { key: '/inventory', label: '物品管理', icon: 'AppstoreOutlined' },
  { key: '/finance', label: '财务中心', icon: 'MoneyCollectOutlined' },
  { key: '/secrets', label: '密钥保险箱', icon: 'KeyOutlined' },
  { key: '/reminders', label: '提醒事项', icon: 'BellOutlined' },
  { key: '/topology', label: '拓扑结构', icon: 'ApartmentOutlined' },
  { key: '/servers', label: '服务器管理', icon: 'CloudServerOutlined' },
  { key: '/members', label: '成员目录', icon: 'TeamOutlined' },
  { key: '/streaming', label: '直播工作室', icon: 'VideoCameraOutlined' },
];

function getMenuItems(): MenuProps['items'] {
  const sidebarItems = SIDEBAR_ITEMS;
  const items: MenuProps['items'] = sidebarItems.map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon ? (ICON_MAP[item.icon] ?? null) : null,
  }));

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
  );

  if (isAdmin()) {
    items.push(
      {
        key: '/settings',
        icon: <SettingOutlined />,
        label: '系统设置',
        'data-menu-id': '/settings',
        children: [
          { key: '/settings/users', label: '用户账号', icon: <TeamOutlined /> },
          { key: '/settings/tags', label: '标签分类', icon: <TagOutlined /> },
          { key: '/settings/templates', label: '模板库', icon: <FormOutlined /> },
          { key: '/settings/site', label: '站点配置', icon: <GlobalOutlined /> },
          { key: '/settings/backups', label: '数据备份', icon: <CloudServerOutlined /> },
          { key: '/settings/transfer', icon: <SwapOutlined />, label: '数据迁转' },
          { key: '/settings/customization', label: '应用配置', icon: <SkinOutlined /> },
          { key: '/settings/system', label: '系统更新', icon: <CloudServerOutlined /> },
          { key: '/settings/storage', label: '存储设置', icon: <DatabaseOutlined /> },
        ],
      },
    );
  }

  return items;
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [idlePaused, setIdlePaused] = useState(() => {
    const stored = sessionStorage.getItem('workbench_idle_paused');
    if (stored === 'true') { pauseIdleTimer(); return true; }
    return false;
  });
  const [sidebarEntered, setSidebarEntered] = useState(false);
  const siderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSidebarEntered(true), 100);
    return () => clearTimeout(timer);
  }, []);
  const navigate = useNavigate();
  const location = useLocation();
  const selectedKey = useMemo(() => {
    const keys = SIDEBAR_ITEMS.map((i) => i.key);
    if (keys.includes(location.pathname)) return location.pathname;
    for (const key of keys.sort((a, b) => b.length - a.length)) {
      if (location.pathname.startsWith(key + '/') || location.pathname.startsWith(key + '?')) {
        return key;
      }
    }
    return location.pathname;
  }, [location.pathname]);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useWebSocket();
  const toggleIdlePause = useCallback(() => {
    setIdlePaused((prev) => {
      const next = !prev;
      if (next) { pauseIdleTimer(); } else { resumeIdleTimer(); }
      sessionStorage.setItem('workbench_idle_paused', String(next));
      return next;
    });
  }, []);
  const { isMobile } = useResponsive();
  const customization = useCustomization();
  const { isDark } = useTheme();
  const { user } = useUser();
  const { isLocked, lock } = useLockContext();
  useIdleTimer();

  // 工作台被锁定时跳转到锁屏页
  useEffect(() => {
    if (isLocked) {
      navigate('/lock');
    }
  }, [isLocked, navigate]);

  const handleMenuOpenChange = useCallback((openKeys: string[]) => {
    if (openKeys.includes('/settings')) {
      setTimeout(() => {
        const settingsItem = document.querySelector('[data-menu-id="/settings"]');
        if (settingsItem) {
          settingsItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 350);
    }
  }, []);

  return (
    <TagProvider>
      <Layout style={{ minHeight: '100vh', background: 'var(--canvas-parchment)' }}>
        {!isMobile && (
        <div className={`sider-scroll-container${sidebarEntered ? ' sidebar-entered' : ''}`} style={{ height: '100vh', position: 'fixed', left: 0, top: 0, bottom: 0, width: collapsed ? 'var(--sider-collapsed-width)' : 'var(--sider-width)', display: 'flex', flexDirection: 'column' }}>
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
              customization.branding.displayMode !== 'text' && customization.branding.logoCollapsed ? (
                <img src={customization.branding.logoCollapsed} alt="Logo" style={{ height: 28 }} />
              ) : (
                <span style={{ fontSize: 'var(--text-heading-3-size)', fontWeight: 'bold', color: 'var(--ink)' }}>{customization.app.shortName}</span>
              )
            ) : (
              <>
                {customization.branding.displayMode !== 'text' && customization.branding.logoExpanded && (
                  <img src={customization.branding.logoExpanded} alt="Logo" style={{ height: 28 }} />
                )}
                {customization.branding.displayMode !== 'icon' && (
                  <span style={{ fontSize: customization.branding.displayMode === 'both' ? 'var(--text-body-xs-size)' : 'var(--text-heading-4-size)', fontWeight: 'bold', color: 'var(--ink)' }}>
                    {customization.app.name}
                  </span>
                )}
              </>
            )}
          </div>
          <div ref={siderRef} className="sider-menu-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <ConfigProvider
            theme={{
              components: {
                Menu: {
                  itemHeight: 40,
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
              height: 'auto',
              borderRight: 'var(--sider-border)',
              background: 'var(--sider-bg)',
            }}
          >
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              items={getMenuItems() ?? []}
              onClick={({ key }) => navigate(key)}
              onOpenChange={handleMenuOpenChange}
              style={{ borderRight: 0 }}
            />
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
            {customization.branding.displayMode !== 'text' && customization.branding.logoExpanded && (
              <img src={customization.branding.logoExpanded} alt="Logo" style={{ height: 28 }} />
            )}
            {customization.branding.displayMode !== 'icon' && (
              <span style={{ fontSize: customization.branding.displayMode === 'both' ? 'var(--text-body-xs-size)' : 'var(--text-heading-4-size)', fontWeight: 'bold' }}>
                {customization.app.name}
              </span>
            )}
          </div>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={getMenuItems() ?? []}
            onClick={({ key }) => {
              navigate(key);
              setMenuDrawerOpen(false);
            }}
            onOpenChange={handleMenuOpenChange}
            style={{ borderRight: 0 }}
          />
        </Drawer>
      )}

      <Layout className={`${styles.appLayout}${sidebarEntered ? ` ${styles.appEntered}` : ''}`} style={{ marginLeft: isMobile ? 0 : (collapsed ? 'var(--sider-collapsed-width)' : 'var(--sider-width)'), transition: 'margin-left 0.2s', background: 'var(--canvas-parchment)', height: '100vh', overflowY: 'auto' }}>
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
          <Text strong style={{ fontSize: 'var(--text-heading-4-size)', marginLeft: 8, flex: 1, textAlign: 'center' }}>
            {getRouteTitle(location.pathname)}
          </Text>
          <Space size="middle">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
            />
            <Tooltip title="手动锁定工作台">
              <Button
                type="text"
                size="small"
                icon={<LockOutlined />}
                aria-label="手动锁定工作台"
                onClick={lock}
              />
            </Tooltip>
            <Tooltip title={idlePaused ? '已暂停自动锁定' : '空闲 5 分钟自动锁定'}>
              <Button
                type="text"
                size="small"
                icon={idlePaused ? <LockOutlined /> : <UnlockOutlined />}
                aria-label={idlePaused ? '恢复自动锁定' : '暂停自动锁定'}
                onClick={toggleIdlePause}
                style={{ color: idlePaused ? 'var(--color-warning)' : undefined }}
              />
            </Tooltip>
            <Dropdown menu={{ items: userMenuItems ?? [], onClick: ({ key }) => {
              if (key === 'profile') navigate('/profile');
              if (key === 'logout') { clearTokens(); navigate('/login'); }
            } }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar src={user?.avatar || undefined} icon={!user?.avatar ? <UserOutlined /> : undefined} />
                {!isMobile && <span>{user?.nickname || '管理员'}</span>}
              </Space>
            </Dropdown>
          </Space>
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
           <div key={location.pathname} className={styles.transitionWrapper} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
      </Layout>
      </Layout>
    </TagProvider>
  );
}
