import { Navigate, Outlet } from 'react-router-dom';
import { useLockContext } from '../contexts/LockContext';

/** 锁屏守卫：工作台已锁定时所有受保护路由重定向到 /lock */
export default function LockGuard() {
  const { isLocked } = useLockContext();

  if (isLocked) {
    return <Navigate to="/lock" replace />;
  }

  return <Outlet />;
}
