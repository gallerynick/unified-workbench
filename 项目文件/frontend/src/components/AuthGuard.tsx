import { useState, useEffect } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { Result, Button } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { isAuthenticated, isAdmin, clearTokens } from '@/utils/auth';
import { isTestModeEnabled } from '@/pages/settings/SiteSettings';

export default function AuthGuard() {
  const navigate = useNavigate();
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

  // 测试模式且非管理员 → 403 禁止访问
  if (isTestModeEnabled() && !isAdmin()) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'var(--canvas)',
      }}>
        <Result
          status="403"
          title={<span style={{ color: 'var(--ink)' }}>访问被拒绝</span>}
          subTitle={<span style={{ color: 'var(--text-secondary)' }}>系统当前处于测试模式，仅管理员可以访问。</span>}
          icon={<LockOutlined style={{ fontSize: 72, color: 'var(--color-info)' }} />}
          extra={
            <Button type="primary" onClick={() => { clearTokens(); navigate('/login', { replace: true }); }}>
              退出登录
            </Button>
          }
        />
      </div>
    );
  }

  return <Outlet />;
}
