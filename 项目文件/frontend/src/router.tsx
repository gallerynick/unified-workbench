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
const SecretCategoryPage = lazy(() => import('@/pages/secrets/SecretCategoryPage'));
const ReminderManagement = lazy(() => import('@/pages/reminders/ReminderManagement'));
const NotificationConfig = lazy(() => import('@/pages/settings/NotificationConfig'));
const BackupManagement = lazy(() => import('@/pages/settings/BackupManagement'));
const CustomizationSettings = lazy(() => import('@/pages/settings/CustomizationSettings'));
const SiteSettings = lazy(() => import('@/pages/settings/SiteSettings'));
const SidebarManagement = lazy(() => import('@/pages/settings/SidebarManagement'));
const DeviceManagement = lazy(() => import('@/pages/settings/DeviceManagement'));
const UserPersonalization = lazy(() => import('@/pages/settings/UserPersonalization'));
const InventoryManagement = lazy(() => import('@/pages/inventory/InventoryManagement'));
const FinanceManagement = lazy(() => import('@/pages/finance/FinanceManagement'));
const TaskManagement = lazy(() => import('@/pages/tasks/TaskManagement'));
const ContactManagement = lazy(() => import('@/pages/contacts/ContactManagement'));
const CalendarPage = lazy(() => import('@/pages/calendar/CalendarPage'));
const VoteManagement = lazy(() => import('@/pages/votes/VoteManagement'));
const FormManagement = lazy(() => import('@/pages/forms/FormManagement'));
const MemberDirectory = lazy(() => import('@/pages/members/MemberDirectory'));
const AnnouncementManagement = lazy(() => import('@/pages/announcements/AnnouncementManagement'));
const NoteManagement = lazy(() => import('@/pages/notes/NoteManagement'));
const TagManagement = lazy(() => import('@/pages/settings/TagManagement'));
const Profile = lazy(() => import('@/pages/settings/Profile'));
const TestModePage = lazy(() => import('@/pages/TestModePage'));
const ProjectDetailPage = lazy(() => import('@/pages/projects/ProjectDetailPage'));
const SystemSettings = lazy(() => import('@/pages/settings/SystemSettings'));
const TopologyManagement = lazy(() => import('@/pages/topology/TopologyManagement'));
const StreamStudio = lazy(() => import('@/pages/streaming/StreamStudio'));
const StreamWatch = lazy(() => import('@/pages/streaming/StreamWatch'));

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
    path: '/stream/watch/:key',
    element: <LazyPage><StreamWatch /></LazyPage>,
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
            path: 'projects/:id',
            element: <LazyPage><ProjectDetailPage /></LazyPage>,
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
            path: 'tasks',
            element: <LazyPage><TaskManagement /></LazyPage>,
          },
          {
            path: 'contacts',
            element: <LazyPage><ContactManagement /></LazyPage>,
          },
          {
            path: 'calendar',
            element: <LazyPage><CalendarPage /></LazyPage>,
          },
          {
            path: 'votes',
            element: <LazyPage><VoteManagement /></LazyPage>,
          },
          {
            path: 'forms',
            element: <LazyPage><FormManagement /></LazyPage>,
          },
          {
            path: 'members',
            element: <LazyPage><MemberDirectory /></LazyPage>,
          },
          {
            path: 'announcements',
            element: <LazyPage><AnnouncementManagement /></LazyPage>,
          },
          {
            path: 'notes',
            element: <LazyPage><NoteManagement /></LazyPage>,
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
            path: 'secrets/category/:categoryId',
            element: <LazyPage><SecretCategoryPage /></LazyPage>,
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
            path: 'settings/personalization',
            element: <LazyPage><UserPersonalization /></LazyPage>,
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
            path: 'settings/tags',
            element: <LazyPage><TagManagement /></LazyPage>,
          },
          {
            path: 'settings/devices',
            element: <LazyPage><DeviceManagement /></LazyPage>,
          },
          {
            path: 'settings/system',
            element: <LazyPage><SystemSettings /></LazyPage>,
          },
          {
            path: 'profile',
            element: <LazyPage><Profile /></LazyPage>,
          },
          {
            path: 'topology',
            element: <LazyPage><TopologyManagement /></LazyPage>,
          },
          {
            path: 'stream',
            element: <LazyPage><StreamStudio /></LazyPage>,
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
