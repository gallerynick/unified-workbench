import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated, isAdmin } from '@/utils/auth';
import { useSetupStatus } from '@/hooks/useSetupStatus';
import { isTestModeEnabled } from '@/pages/settings/SiteSettings';

export default function AuthGuard() {
  const { isComplete, loading } = useSetupStatus();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  if (loading) {
    return null;
  }
  if (isComplete === false) {
    return <Navigate to="/welcome" replace />;
  }
  if (isTestModeEnabled() && !isAdmin()) {
    return <Navigate to="/test-mode" replace />;
  }
  return <Outlet />;
}
