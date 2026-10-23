import { useEffect, useRef, useCallback } from 'react';
import { useLockContext } from '../contexts/LockContext';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟

/**
 * 暂停原因。多个来源可能同时需要暂停空闲计时（顶栏开关、直播推流、会议录音），
 * 因此按「原因集合」计数而非单一布尔：任一方恢复只移除自己的原因，
 * 不会把其他来源的暂停一并解除。
 */
export type IdlePauseReason = 'manual' | 'stream-studio' | 'stream-watch' | 'meeting-recording';

const pauseReasons = new Set<IdlePauseReason>();
/** 模块级最近活跃时间，供状态指示读取「距下次自动锁定的剩余时间」 */
let lastActivityAt = Date.now();

/**
 * 暂停空闲计时。
 * 'manual' 优先级最高：只允许顶栏开关自己添加与移除，任何页面的卸载清理
 * 都不得触碰它——否则用户手动暂停后进一次直播工作室再出来，暂停即被解除。
 */
export function pauseIdleTimer(reason: IdlePauseReason) { pauseReasons.add(reason); }
export function resumeIdleTimer(reason: IdlePauseReason) { pauseReasons.delete(reason); }
export function isIdlePaused() { return pauseReasons.size > 0; }

/** 距下次自动锁定的剩余毫秒数；计时器暂停时返回 null（暂停状态下不会触发锁定） */
export function getIdleMsLeft(): number | null {
  if (isIdlePaused()) return null;
  return Math.max(0, IDLE_TIMEOUT_MS - (Date.now() - lastActivityAt));
}

export function useIdleTimer() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(Date.now());
  const { lock } = useLockContext();

  const handleLock = useCallback(() => {
    if (isIdlePaused()) return;
    // 不再清除 token / 退出登录，改为锁定工作台（token 保留供解锁验证）
    lock();
  }, [lock]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    lastActivityAt = Date.now();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (isIdlePaused()) {
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
