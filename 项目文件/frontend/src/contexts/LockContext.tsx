import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

/** 锁屏状态持久化 key（sessionStorage，刷新不丢） */
const LOCK_KEY = 'workbench_locked';

interface LockContextValue {
  isLocked: boolean;
  locking: boolean;
  lock: () => void;
  unlock: () => void;
}

const LockContext = createContext<LockContextValue>({
  isLocked: false,
  locking: false,
  lock: () => {},
  unlock: () => {},
});

export function useLockContext() {
  return useContext(LockContext);
}

export function LockProvider({ children }: { children: ReactNode }) {
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(LOCK_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [locking, setLocking] = useState(false);

  const lock = useCallback(() => {
    try {
      sessionStorage.setItem(LOCK_KEY, '1');
    } catch {
      // sessionStorage 不可用时仅内存态生效
    }
    setLocking(true);
  }, []);

  // 模糊动画 600ms 后真正进入锁定态，触发跳转锁屏页
  useEffect(() => {
    if (!locking) return;
    const timer = setTimeout(() => {
      setLocking(false);
      setIsLocked(true);
    }, 600);
    return () => clearTimeout(timer);
  }, [locking]);

  const unlock = useCallback(() => {
    try {
      sessionStorage.removeItem(LOCK_KEY);
    } catch {
      // 忽略存储异常
    }
    setIsLocked(false);
    setLocking(false);
  }, []);

  return (
    <LockContext.Provider value={{ isLocked, locking, lock, unlock }}>
      {children}
    </LockContext.Provider>
  );
}
