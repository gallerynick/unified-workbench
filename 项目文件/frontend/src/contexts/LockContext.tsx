import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/** 锁屏状态持久化 key（sessionStorage，刷新不丢） */
const LOCK_KEY = 'workbench_locked';

interface LockContextValue {
  isLocked: boolean;
  lock: () => void;
  unlock: () => void;
}

const LockContext = createContext<LockContextValue>({
  isLocked: false,
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

  const lock = useCallback(() => {
    try {
      sessionStorage.setItem(LOCK_KEY, '1');
    } catch {
      // sessionStorage 不可用时仅内存态生效
    }
    setIsLocked(true);
  }, []);

  const unlock = useCallback(() => {
    try {
      sessionStorage.removeItem(LOCK_KEY);
    } catch {
      // 忽略存储异常
    }
    setIsLocked(false);
  }, []);

  return (
    <LockContext.Provider value={{ isLocked, lock, unlock }}>
      {children}
    </LockContext.Provider>
  );
}
