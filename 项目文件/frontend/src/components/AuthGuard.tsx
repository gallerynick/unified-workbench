import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated } from '@/utils/auth';
import { isSetupComplete } from '@/pages/Welcome';

export default function AuthGuard() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  if (!isSetupComplete()) {
    return <Navigate to="/welcome" replace />;
  }
  return <Outlet />;
}
