import { useEffect, useRef, useCallback } from 'react';
import { clearTokens } from '../utils/auth';
import { request } from '../utils/request';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟

/** 模块级暂停标志：直播推流或手动锁定时可暂停空闲计时 */
let idlePaused = false;

export function pauseIdleTimer() { idlePaused = true; }
export function resumeIdleTimer() { idlePaused = false; }
export function isIdlePaused() { return idlePaused; }

export function useIdleTimer() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(Date.now());

  const handleLogout = useCallback(async () => {
    if (idlePaused) return;
    clearTokens();
    sessionStorage.clear();
    try {
      await request('/auth/logout', { method: 'POST' }).catch(() => {});
    } finally {
      window.location.replace('/login');
    }
  }, []);

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
        handleLogout();
      }
    }, IDLE_TIMEOUT_MS);
  }, [handleLogout]);

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
