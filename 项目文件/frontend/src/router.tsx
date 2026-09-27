import { Spin } from 'antd';
import { Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthGuard from '@/components/AuthGuard';
import LockGuard from '@/components/LockGuard';
import LockPage from '@/pages/LockPage';
import Login from '@/pages/Login';
import ShareDownloadPage from '@/pages/public/ShareDownloadPage';
import Welcome from '@/pages/Welcome';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import { lazyChunk } from './utils/chunkGuard';
import { RouteErrorElement } from './components/ErrorBoundary';

// 用带 chunk 失效自愈能力的 lazy 替换 React.lazy：47 处懒加载路由零改动获得保护。
// 详见 utils/chunkGuard.ts（重新部署后旧标签页引用已下线哈希 chunk 的自动恢复）。
const lazy = lazyChunk;

const UserManagement = lazy(() => import('@/pages/settings/UserManagement'));
const ContentManagement = lazy(() => import('@/pages/content/ContentManagement'));
const FileSharePage = lazy(() => import('@/pages/file-share/FileSharePage'));
const StorageSettings = lazy(() => import('@/pages/settings/StorageSettings'));
const ResourceMonitor = lazy(() => import('@/pages/settings/ResourceMonitor'));
const TemplateManagement = lazy(() => import('@/pages/templates/TemplateManagement'));
const ProjectManagement = lazy(() => import('@/pages/projects/ProjectManagement'));
const SecretManagement = lazy(() => import('@/pages/secrets/SecretManagement'));
const SecretCategoryPage = lazy(() => import('@/pages/secrets/SecretCategoryPage'));
const ReminderManagement = lazy(() => import('@/pages/reminders/ReminderManagement'));
const BackupManagement = lazy(() => import('@/pages/settings/BackupManagement'));
const DataManagement = lazy(() => import('@/pages/settings/DataManagement'));
const CustomizationSettings = lazy(() => import('@/pages/settings/CustomizationSettings'));
const SiteSettings = lazy(() => import('@/pages/settings/SiteSettings'));
const UserPersonalization = lazy(() => import('@/pages/settings/UserPersonalization'));
const InventoryManagement = lazy(() => import('@/pages/inventory/InventoryManagement'));
const FinanceManagement = lazy(() => import('@/pages/finance/FinanceManagement'));
const TaskManagement = lazy(() => import('@/pages/tasks/TaskManagement'));
const ContactManagement = lazy(() => import('@/pages/contacts/ContactManagement'));
const CalendarPage = lazy(() => import('@/pages/calendar/CalendarPage'));
const VoteManagement = lazy(() => import('@/pages/votes/VoteManagement'));
const FormManagement = lazy(() => import('@/pages/forms/FormManagement'));
const FormFill = lazy(() => import('@/pages/forms/FormFill'));
const FormResponses = lazy(() => import('@/pages/forms/FormResponses'));
const MemberDirectory = lazy(() => import('@/pages/members/MemberDirectory'));
const MemberDetail = lazy(() => import('@/pages/members/MemberDetail'));
const AnnouncementManagement = lazy(() => import('@/pages/announcements/AnnouncementManagement'));
const NoteWorkspace = lazy(() => import('@/pages/notes/NoteWorkspace'));
const TagManagement = lazy(() => import('@/pages/settings/TagManagement'));
const Profile = lazy(() => import('@/pages/settings/Profile'));
const DevicesPage = lazy(() => import('@/pages/settings/DevicesPage'));
const NotificationsCenter = lazy(() => import('@/pages/notifications/NotificationsCenter'));
const UserNotificationConfig = lazy(() => import('@/pages/settings/UserNotificationConfig'));
const DebugModePage = lazy(() => import('@/pages/DebugModePage'));
const ProjectDetailPage = lazy(() => import('@/pages/projects/ProjectDetailPage'));
const ProposalDetailPage = lazy(() => import('@/pages/projects/ProposalDetailPage'));
const TodoDetailPage = lazy(() => import('@/pages/projects/TodoDetailPage'));
const MeetingDetailPage = lazy(() => import('@/pages/projects/MeetingDetailPage'));
const ChangeDetailPage = lazy(() => import('@/pages/projects/ChangeDetailPage'));
const EventDetailPage = lazy(() => import('@/pages/projects/EventDetailPage'));
const SecuritySettings = lazy(() => import('@/pages/settings/SecuritySettings'));
const SystemSettings = lazy(() => import('@/pages/settings/SystemSettings'));
const TopologyManagement = lazy(() => import('@/pages/topology/TopologyManagement'));
const StreamStudio = lazy(() => import('@/pages/streaming/StreamStudio'));
const StreamWatch = lazy(() => import('@/pages/streaming/StreamWatch'));
const RoomListPage = lazy(() => import('@/pages/streaming/RoomListPage'));
const ServerManagement = lazy(() => import('@/pages/servers/ServerManagement'));
const ServerSystemsPage = lazy(() => import('@/pages/servers/ServerSystemsPage'));
const SystemDetail = lazy(() => import('@/pages/servers/SystemDetail'));
const TestPage = lazy(() => import('@/pages/dev/TestPage'));
const MeetingList = lazy(() => import('@/pages/meetings/MeetingList'));
const MeetingRoom = lazy(() => import('@/pages/meetings/MeetingRoom'));
const ThirdPartyConfigPage = lazy(() => import('@/pages/settings/ThirdPartyConfigPage'));

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
    errorElement: <RouteErrorElement />,
  },
  {
    path: '/welcome',
    element: <Welcome />,
    errorElement: <RouteErrorElement />,
  },
  {
    path: '/lock',
    element: <LockPage />,
    errorElement: <RouteErrorElement />,
  },
  {
    path: '/debug-mode',
    element: <DebugModePage />,
    errorElement: <RouteErrorElement />,
  },
  {
    path: '/stream/watch/:roomId',
    element: (
      <LazyPage>
        <StreamWatch />
      </LazyPage>
    ),
    errorElement: <RouteErrorElement />,
  },
  {
    path: 'share/:code',
    element: <ShareDownloadPage />,
    errorElement: <RouteErrorElement />,
  },
  {
    path: 'forms/:id/fill',
    element: <FormFill />,
    errorElement: <RouteErrorElement />,
  },
  {
    element: <AuthGuard />,
    errorElement: <RouteErrorElement />,
    children: [
      {
        element: <LockGuard />,
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
                path: 'notifications',
                element: (
                  <LazyPage>
                    <NotificationsCenter />
                  </LazyPage>
                ),
              },
              {
                path: 'shares',
                element: (
                  <LazyPage>
                    <FileSharePage />
                  </LazyPage>
                ),
              },
              {
                path: 'content',
                element: (
                  <LazyPage>
                    <ContentManagement />
                  </LazyPage>
                ),
              },
              {
                path: 'projects',
                element: (
                  <LazyPage>
                    <ProjectManagement />
                  </LazyPage>
                ),
              },
              {
                path: 'projects/:id',
                element: (
                  <LazyPage>
                    <ProjectDetailPage />
                  </LazyPage>
                ),
              },
              {
                path: 'projects/:id/proposal/:proposalId',
                element: (
                  <LazyPage>
                    <ProposalDetailPage />
                  </LazyPage>
                ),
              },
              {
                path: 'projects/:id/todo/:todoId',
                element: (
                  <LazyPage>
                    <TodoDetailPage />
                  </LazyPage>
                ),
              },
              {
                path: 'projects/:id/meeting/:meetingId',
                element: (
                  <LazyPage>
                    <MeetingDetailPage />
                  </LazyPage>
                ),
              },
              {
                path: 'projects/:id/change/:changeId',
                element: (
                  <LazyPage>
                    <ChangeDetailPage />
                  </LazyPage>
                ),
              },
              {
                path: 'projects/:id/event/:eventId',
                element: (
                  <LazyPage>
                    <EventDetailPage />
                  </LazyPage>
                ),
              },
              {
                path: 'meetings',
                element: (
                  <LazyPage>
                    <MeetingList />
                  </LazyPage>
                ),
              },
              {
                path: 'meetings/:id',
                element: (
                  <LazyPage>
                    <MeetingRoom />
                  </LazyPage>
                ),
              },
              {
                path: 'inventory',
                element: (
                  <LazyPage>
                    <InventoryManagement />
                  </LazyPage>
                ),
              },
              {
                path: 'finance',
                element: (
                  <LazyPage>
                    <FinanceManagement />
                  </LazyPage>
                ),
              },
              {
                path: 'tasks',
                element: (
                  <LazyPage>
                    <TaskManagement />
                  </LazyPage>
                ),
              },
              {
                path: 'contacts',
                element: (
                  <LazyPage>
                    <ContactManagement />
                  </LazyPage>
                ),
              },
              {
                path: 'calendar',
                element: (
                  <LazyPage>
                    <CalendarPage />
                  </LazyPage>
                ),
              },
              {
                path: 'votes',
                element: (
                  <LazyPage>
                    <VoteManagement />
                  </LazyPage>
                ),
              },
              {
                path: 'forms',
                element: (
                  <LazyPage>
                    <FormManagement />
                  </LazyPage>
                ),
              },
              {
                path: 'forms/:id/responses',
                element: <FormResponses />,
              },
              {
                path: 'members',
                element: (
                  <LazyPage>
                    <MemberDirectory />
                  </LazyPage>
                ),
              },
              {
                path: 'members/:userId',
                element: (
                  <LazyPage>
                    <MemberDetail />
                  </LazyPage>
                ),
              },
              {
                path: 'announcements',
                element: (
                  <LazyPage>
                    <AnnouncementManagement />
                  </LazyPage>
                ),
              },
              {
                path: 'notes',
                element: (
                  <LazyPage>
                    <NoteWorkspace />
                  </LazyPage>
                ),
              },
              {
                path: 'settings/templates',
                element: (
                  <LazyPage>
                    <TemplateManagement />
                  </LazyPage>
                ),
              },
              {
                path: 'secrets',
                element: (
                  <LazyPage>
                    <SecretManagement />
                  </LazyPage>
                ),
              },
              {
                path: 'secrets/category/:categoryId',
                element: (
                  <LazyPage>
                    <SecretCategoryPage />
                  </LazyPage>
                ),
              },
              {
                path: 'reminders',
                element: (
                  <LazyPage>
                    <ReminderManagement />
                  </LazyPage>
                ),
              },
              {
                path: 'settings/personalization',
                element: (
                  <LazyPage>
                    <UserPersonalization />
                  </LazyPage>
                ),
              },
              {
                path: 'settings/notifications',
                element: (
                  <LazyPage>
                    <UserNotificationConfig />
                  </LazyPage>
                ),
              },
              {
                path: 'settings/security',
                element: (
                  <LazyPage>
                    <SecuritySettings />
                  </LazyPage>
                ),
              },
              {
                path: 'settings/devices',
                element: (
                  <LazyPage>
                    <DevicesPage />
                  </LazyPage>
                ),
              },
              {
                path: 'settings/users',
                element: (
                  <LazyPage>
                    <UserManagement />
                  </LazyPage>
                ),
              },
              {
                path: 'settings/backups',
                element: (
                  <LazyPage>
                    <BackupManagement />
                  </LazyPage>
                ),
              },
              {
                path: 'settings/transfer',
                element: (
                  <LazyPage>
                    <DataManagement />
                  </LazyPage>
                ),
              },
              {
                path: 'settings/customization',
                element: (
                  <LazyPage>
                    <CustomizationSettings />
                  </LazyPage>
                ),
              },
              {
                path: 'settings/site',
                element: (
                  <LazyPage>
                    <SiteSettings />
                  </LazyPage>
                ),
              },
              {
                path: 'settings/tags',
                element: (
                  <LazyPage>
                    <TagManagement />
                  </LazyPage>
                ),
              },
              {
                path: 'settings/system',
                element: (
                  <LazyPage>
                    <SystemSettings />
                  </LazyPage>
                ),
              },
              {
                path: 'settings/third-party',
                element: (
                  <LazyPage>
                    <ThirdPartyConfigPage />
                  </LazyPage>
                ),
              },
              {
                path: 'settings/storage',
                element: (
                  <LazyPage>
                    <StorageSettings />
                  </LazyPage>
                ),
              },
              {
                path: 'settings/monitor',
                element: (
                  <LazyPage>
                    <ResourceMonitor />
                  </LazyPage>
                ),
              },
              {
                path: 'profile',
                element: (
                  <LazyPage>
                    <Profile />
                  </LazyPage>
                ),
              },
              {
                path: 'topology',
                element: (
                  <LazyPage>
                    <TopologyManagement />
                  </LazyPage>
                ),
              },
              {
                path: 'servers',
                element: (
                  <LazyPage>
                    <ServerManagement />
                  </LazyPage>
                ),
              },
              {
                path: 'servers/:serverId',
                element: (
                  <LazyPage>
                    <ServerSystemsPage />
                  </LazyPage>
                ),
              },
              {
                path: 'servers/:serverId/systems/:systemId',
                element: (
                  <LazyPage>
                    <SystemDetail />
                  </LazyPage>
                ),
              },
              {
                path: 'streaming',
                children: [
                  {
                    index: true,
                    element: (
                      <LazyPage>
                        <RoomListPage />
                      </LazyPage>
                    ),
                  },
                  {
                    path: 'studio/:roomId',
                    element: (
                      <LazyPage>
                        <StreamStudio />
                      </LazyPage>
                    ),
                  },
                ],
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
          {
            path: '/dev/testpage',
            element: (
              <LazyPage>
                <TestPage />
              </LazyPage>
            ),
          },
          {
            path: '/dev/testpage/:key',
            element: (
              <LazyPage>
                <TestPage />
              </LazyPage>
            ),
          },
        ],
      },
    ],
  },
]);