import { useState, useRef, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, theme, Avatar, Dropdown, Space, Drawer, Button, Typography } from 'antd';
import {
  AuditOutlined,
  SettingOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MenuOutlined,
  NotificationOutlined,
  CloudServerOutlined,
  TeamOutlined,
  SkinOutlined,
  GlobalOutlined,
  LayoutOutlined,
  DesktopOutlined,
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
  LikeOutlined,
  SoundOutlined,
  BookOutlined,
  TagOutlined,
  BgColorsOutlined,
  ApartmentOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useWebSocket } from '../hooks/useWebSocket';
import { useResponsive } from '../hooks/useBreakpoint';
import { useCustomization } from '../hooks/useCustomization';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { clearTokens, isAdmin } from '../utils/auth';
import { getVisibleSidebarItems } from '../pages/settings/SidebarManagement';
import { TagProvider } from '../contexts/TagContext';
import NotificationBell from '../components/NotificationBell';
import NotificationDrawer from '../components/NotificationDrawer';
import VotePopup from '../components/VotePopup';
import { getRouteTitle } from '../config/routeTitles';

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
  AuditOutlined: <AuditOutlined />,
  ApartmentOutlined: <ApartmentOutlined />,
  VideoCameraOutlined: <VideoCameraOutlined />,
};

function getMenuItems(): MenuProps['items'] {
  const sidebarItems = getVisibleSidebarItems();
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
  );

  if (isAdmin()) {
    items.push(
      {
        key: '/audit',
        icon: <AuditOutlined />,
        label: '审计',
      },
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
          { key: '/settings/sidebar', label: '侧边栏配置', icon: <LayoutOutlined /> },
          { key: '/settings/devices', label: '设备终端', icon: <DesktopOutlined /> },
          { key: '/settings/notifications', label: '通知配置', icon: <NotificationOutlined /> },
          { key: '/settings/backups', label: '数据备份', icon: <CloudServerOutlined /> },
          { key: '/settings/customization', label: '应用配置', icon: <SkinOutlined /> },
          { key: '/settings/system', label: '系统更新', icon: <CloudServerOutlined /> },
          { key: '/settings/stream', label: '推流配置', icon: <VideoCameraOutlined /> },
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
  const siderRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, colorBgLayout, borderRadiusLG },
  } = theme.useToken();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useWebSocket();
  const { isMobile } = useResponsive();
  const customization = useCustomization();
  const { isDark } = useTheme();
  const { user } = useUser();

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
      <Layout style={{ minHeight: '100vh', background: colorBgLayout }}>
        {!isMobile && (
        <div className="sider-scroll-container" style={{ height: '100vh', position: 'fixed', left: 0, top: 0, bottom: 0, width: collapsed ? 80 : 240, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              height: 64,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
              gap: 2,
              flexShrink: 0,
            }}
          >
            {collapsed ? (
              customization.branding.displayMode !== 'text' && customization.branding.logoCollapsed ? (
                <img src={customization.branding.logoCollapsed} alt="Logo" style={{ height: 28 }} />
              ) : (
                <span style={{ fontSize: 20, fontWeight: 'bold', color: isDark ? '#fff' : undefined }}>{customization.app.shortName}</span>
              )
            ) : (
              <>
                {customization.branding.displayMode !== 'text' && customization.branding.logoExpanded && (
                  <img src={customization.branding.logoExpanded} alt="Logo" style={{ height: 28 }} />
                )}
                {customization.branding.displayMode !== 'icon' && (
                  <span style={{ fontSize: customization.branding.displayMode === 'both' ? 12 : 16, fontWeight: 'bold', color: isDark ? '#fff' : undefined }}>
                    {customization.app.name}
                  </span>
                )}
              </>
            )}
          </div>
          <div ref={siderRef} className="sider-menu-scroll" style={{ flex: 1, overflow: 'auto' }}>
          <Sider
            width={240}
            collapsible
            collapsed={collapsed}
            onCollapse={setCollapsed}
            trigger={null}
            theme={isDark ? 'dark' : 'light'}
            style={{
              height: 'auto',
              borderRight: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
            }}
          >
            <Menu
              mode="inline"
              selectedKeys={[location.pathname]}
              items={getMenuItems() ?? []}
              onClick={({ key }) => navigate(key)}
              onOpenChange={handleMenuOpenChange}
              style={{ borderRight: 0 }}
            />
          </Sider>
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
              borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
              gap: 2,
            }}
          >
            {customization.branding.displayMode !== 'text' && customization.branding.logoExpanded && (
              <img src={customization.branding.logoExpanded} alt="Logo" style={{ height: 28 }} />
            )}
            {customization.branding.displayMode !== 'icon' && (
              <span style={{ fontSize: customization.branding.displayMode === 'both' ? 12 : 16, fontWeight: 'bold' }}>
                {customization.app.name}
              </span>
            )}
          </div>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
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

      <Layout style={{ marginLeft: isMobile ? 0 : (collapsed ? 80 : 240), transition: 'margin-left 0.2s', background: colorBgLayout }}>
        <Header
          style={{
            padding: isMobile ? '0 16px' : '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <Space>
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setMenuDrawerOpen(true)}
                style={{ fontSize: 18 }}
              />
            )}
            {!isMobile && (
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                style={{
                  fontSize: 18,
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  lineHeight: 1,
                  color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.88)',
                }}
              >
                {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              </button>
            )}
          </Space>
          <Text strong style={{ fontSize: 16, marginLeft: 8, flex: 1, textAlign: 'center' }}>
            {getRouteTitle(location.pathname)}
          </Text>
          <Space size="middle">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              onOpenDrawer={() => setDrawerOpen(true)}
            />
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
          style={{
            margin: isMobile ? 8 : 24,
            padding: isMobile ? 8 : 24,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            minHeight: 280,
          }}
        >
          <Outlet />
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
