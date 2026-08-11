import { useEffect, useRef, useCallback } from 'react';
import { useLockContext } from '../contexts/LockContext';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟

/** 模块级暂停标志：直播推流或手动暂停时可暂停空闲计时 */
let idlePaused = false;

export function pauseIdleTimer() { idlePaused = true; }
export function resumeIdleTimer() { idlePaused = false; }
export function isIdlePaused() { return idlePaused; }

export function useIdleTimer() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(Date.now());
  const { lock } = useLockContext();

  const handleLock = useCallback(() => {
    if (idlePaused) return;
    // 不再清除 token / 退出登录，改为锁定工作台（token 保留供解锁验证）
    lock();
  }, [lock]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (idlePaused) {
        resetTimer();
        return;
      }
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= IDLE_TIMEOUT_MS) {
        handleLock();
      }
    }, IDLE_TIMEOUT_MS);
  }, [handleLock]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    for (const e of events) {
      window.addEventListener(e, resetTimer, { passive: true });
    }
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const e of events) {
        window.removeEventListener(e, resetTimer);
      }
    };
  }, [resetTimer]);
}
