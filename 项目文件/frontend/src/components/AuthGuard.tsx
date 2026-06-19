import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated, isAdmin } from '@/utils/auth';
import { isSetupComplete } from '@/pages/Welcome';
import { isTestModeEnabled } from '@/pages/settings/SiteSettings';

export default function AuthGuard() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  if (!isSetupComplete()) {
    return <Navigate to="/welcome" replace />;
  }
  if (isTestModeEnabled() && !isAdmin()) {
    return <Navigate to="/test-mode" replace />;
  }
  return <Outlet />;
}
