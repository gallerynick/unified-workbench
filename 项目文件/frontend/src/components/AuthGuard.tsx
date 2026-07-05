import { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated, isAdmin } from '@/utils/auth';
import { isTestModeEnabled } from '@/pages/settings/SiteSettings';

export default function AuthGuard() {
  const [setupStatus, setSetupStatus] = useState<{ loading: boolean; complete: boolean | null }>({
    loading: true,
    complete: null,
  });

  useEffect(() => {
    fetch('/api/v1/auth/setup-status')
      .then((r) => r.json())
      .then((json) => setSetupStatus({
        loading: false,
        complete: json?.data?.complete === true,
      }))
      .catch(() => setSetupStatus({ loading: false, complete: null }));
  }, []);

  // 加载中
  if (setupStatus.loading) return null;

  // 系统未初始化 → 欢迎页（不需要登录）
  if (setupStatus.complete === false) {
    return <Navigate to="/welcome" replace />;
  }

  // 已初始化但未登录 → 登录页
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (isTestModeEnabled() && !isAdmin()) {
    return <Navigate to="/test-mode" replace />;
  }

  return <Outlet />;
}
