import { useEffect, useRef, useCallback } from 'react';
import { useLockContext } from '../contexts/LockContext';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟

/** 模块级暂停标志：直播推流或手动暂停时可暂停空闲计时 */
let idlePaused = false;
/** 模块级最近活跃时间，供状态指示读取「距下次自动锁定的剩余时间」 */
let lastActivityAt = Date.now();

export function pauseIdleTimer() { idlePaused = true; }
export function resumeIdleTimer() { idlePaused = false; }
export function isIdlePaused() { return idlePaused; }

/** 距下次自动锁定的剩余毫秒数；计时器暂停时返回 null（暂停状态下不会触发锁定） */
export function getIdleMsLeft(): number | null {
  if (idlePaused) return null;
  return Math.max(0, IDLE_TIMEOUT_MS - (Date.now() - lastActivityAt));
}

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
    lastActivityAt = Date.now();
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
