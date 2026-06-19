import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, theme, Avatar, Dropdown, Space, Drawer, Button } from 'antd';
import {
  HomeOutlined,
  FileOutlined,
  FileTextOutlined,
  ProjectOutlined,
  FormOutlined,
  KeyOutlined,
  AuditOutlined,
  SettingOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MenuOutlined,
  BellOutlined,
  NotificationOutlined,
  CloudServerOutlined,
  TeamOutlined,
  SkinOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useWebSocket } from '../hooks/useWebSocket';
import { useResponsive } from '../hooks/useBreakpoint';
import { useCustomization } from '../hooks/useCustomization';
import { clearTokens } from '../utils/auth';
import NotificationBell from '../components/NotificationBell';
import NotificationDrawer from '../components/NotificationDrawer';

const { Header, Sider, Content } = Layout;

const menuItems: MenuProps['items'] = [
  {
    key: '/',
    icon: <HomeOutlined />,
    label: '首页',
  },
  {
    key: '/files',
    icon: <FileOutlined />,
    label: '文件管理',
  },
  {
    key: '/content',
    icon: <FileTextOutlined />,
    label: '内容管理',
  },
  {
    key: '/projects',
    icon: <ProjectOutlined />,
    label: '项目管理',
  },
  {
    key: '/secrets',
    icon: <KeyOutlined />,
    label: '密钥管理',
  },
  {
    type: 'divider',
  },
  {
    key: '/audit',
    icon: <AuditOutlined />,
    label: '审计日志',
  },
  {
    key: '/reminders',
    icon: <BellOutlined />,
    label: '提醒管理',
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: '系统设置与管理',
    children: [
      { key: '/settings/users', label: '用户管理', icon: <TeamOutlined /> },
      { key: '/settings/templates', label: '模板管理', icon: <FormOutlined /> },
      { key: '/settings/notifications', label: '通知配置', icon: <NotificationOutlined /> },
      { key: '/settings/backups', label: '备份管理', icon: <CloudServerOutlined /> },
      { key: '/settings/customization', label: '品牌配置', icon: <SkinOutlined /> },
    ],
  },
];

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
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useWebSocket();
  const { isMobile } = useResponsive();
  const customization = useCustomization();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          trigger={null}
          theme="light"
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            borderRight: '1px solid rgba(0, 0, 0, 0.06)',
          }}
        >
          <div
            style={{
              height: 64,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
              gap: 2,
            }}
          >
            {collapsed ? (
              customization.branding.displayMode !== 'text' && customization.branding.logoCollapsed ? (
                <img src={customization.branding.logoCollapsed} alt="Logo" style={{ height: 28 }} />
              ) : (
                <span style={{ fontSize: 20, fontWeight: 'bold' }}>{customization.app.shortName}</span>
              )
            ) : (
              <>
                {customization.branding.displayMode !== 'text' && customization.branding.logoExpanded && (
                  <img src={customization.branding.logoExpanded} alt="Logo" style={{ height: 28 }} />
                )}
                {customization.branding.displayMode !== 'icon' && (
                  <span style={{ fontSize: customization.branding.displayMode === 'both' ? 12 : 16, fontWeight: 'bold' }}>
                    {customization.app.name}
                  </span>
                )}
              </>
            )}
          </div>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems ?? []}
            onClick={({ key }) => navigate(key)}
            style={{ borderRight: 0 }}
          />
        </Sider>
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
              borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
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
            items={menuItems ?? []}
            onClick={({ key }) => {
              navigate(key);
              setMenuDrawerOpen(false);
            }}
            style={{ borderRight: 0 }}
          />
        </Drawer>
      )}

      <Layout style={{ marginLeft: isMobile ? 0 : (collapsed ? 80 : 200), transition: 'margin-left 0.2s' }}>
        <Header
          style={{
            padding: isMobile ? '0 16px' : '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
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
                }}
              >
                {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              </button>
            )}
          </Space>
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
                <Avatar icon={<UserOutlined />} />
                {!isMobile && <span>管理员</span>}
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
      </Layout>
    </Layout>
  );
}
