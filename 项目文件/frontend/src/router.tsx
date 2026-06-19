import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import Login from '@/pages/Login';
import Welcome from '@/pages/Welcome';
import AuthGuard from '@/components/AuthGuard';

const UserManagement = lazy(() => import('@/pages/settings/UserManagement'));
const ContentManagement = lazy(() => import('@/pages/content/ContentManagement'));
const FileManagement = lazy(() => import('@/pages/files/FileManagement'));
const AuditLog = lazy(() => import('@/pages/audit/AuditLog'));
const TemplateManagement = lazy(() => import('@/pages/templates/TemplateManagement'));
const RecordManagement = lazy(() => import('@/pages/records/RecordManagement'));
const SecretManagement = lazy(() => import('@/pages/secrets/SecretManagement'));
const ReminderManagement = lazy(() => import('@/pages/reminders/ReminderManagement'));
const NotificationConfig = lazy(() => import('@/pages/settings/NotificationConfig'));
const BackupManagement = lazy(() => import('@/pages/settings/BackupManagement'));
const CustomizationSettings = lazy(() => import('@/pages/settings/CustomizationSettings'));
const SiteSettings = lazy(() => import('@/pages/settings/SiteSettings'));
const SidebarManagement = lazy(() => import('@/pages/settings/SidebarManagement'));
const DeviceManagement = lazy(() => import('@/pages/settings/DeviceManagement'));
const InventoryManagement = lazy(() => import('@/pages/inventory/InventoryManagement'));
const FinanceManagement = lazy(() => import('@/pages/finance/FinanceManagement'));
const Profile = lazy(() => import('@/pages/settings/Profile'));
const TestModePage = lazy(() => import('@/pages/TestModePage'));

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Spin size="large" style={{ display: 'block', margin: '100px auto' }} />}>
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/welcome',
    element: <Welcome />,
  },
  {
    path: '/test-mode',
    element: <TestModePage />,
  },
  {
    element: <AuthGuard />,
    children: [
      {
        path: '/',
        element: <MainLayout />,
        children: [
          {
            index: true,
            element: <Home />,
          },
          {
            path: 'files',
            element: <LazyPage><FileManagement /></LazyPage>,
          },
          {
            path: 'content',
            element: <LazyPage><ContentManagement /></LazyPage>,
          },
          {
            path: 'projects',
            element: <LazyPage><RecordManagement defaultType="project" /></LazyPage>,
          },
          {
            path: 'inventory',
            element: <LazyPage><InventoryManagement /></LazyPage>,
          },
          {
            path: 'finance',
            element: <LazyPage><FinanceManagement /></LazyPage>,
          },
          {
            path: 'records',
            element: <LazyPage><RecordManagement defaultType="record" /></LazyPage>,
          },
          {
            path: 'settings/templates',
            element: <LazyPage><TemplateManagement /></LazyPage>,
          },
          {
            path: 'secrets',
            element: <LazyPage><SecretManagement /></LazyPage>,
          },
          {
            path: 'audit',
            element: <LazyPage><AuditLog /></LazyPage>,
          },
          {
            path: 'reminders',
            element: <LazyPage><ReminderManagement /></LazyPage>,
          },
          {
            path: 'settings/users',
            element: <LazyPage><UserManagement /></LazyPage>,
          },
          {
            path: 'settings/notifications',
            element: <LazyPage><NotificationConfig /></LazyPage>,
          },
          {
            path: 'settings/backups',
            element: <LazyPage><BackupManagement /></LazyPage>,
          },
          {
            path: 'settings/customization',
            element: <LazyPage><CustomizationSettings /></LazyPage>,
          },
          {
            path: 'settings/site',
            element: <LazyPage><SiteSettings /></LazyPage>,
          },
          {
            path: 'settings/sidebar',
            element: <LazyPage><SidebarManagement /></LazyPage>,
          },
          {
            path: 'settings/devices',
            element: <LazyPage><DeviceManagement /></LazyPage>,
          },
          {
            path: 'profile',
            element: <LazyPage><Profile /></LazyPage>,
          },
          {
            path: '404',
            element: <NotFound />,
          },
          {
            path: '*',
            element: <Navigate to="/404" replace />,
          },
        ],
      },
    ],
  },
]);
