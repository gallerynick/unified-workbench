import { useState, useEffect, useCallback } from 'react';
import { getSetupStatus, markSetupComplete } from '../api/system_config';
import { isAuthenticated } from '../utils/auth';

const SETUP_KEY = 'setup_complete';

export function useSetupStatus() {
  const [isComplete, setIsComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    if (!isAuthenticated()) {
      setIsComplete(false);
      setLoading(false);
      return;
    }

    try {
      const response = await getSetupStatus();
      if (response.code === 0 && response.data) {
        const complete = response.data.complete === true;
        if (complete) {
          setIsComplete(true);
          localStorage.setItem(SETUP_KEY, 'true');
          document.cookie = `${SETUP_KEY}=true; path=/; max-age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
        } else {
          // 防御 POST /auth/setup-complete 静默失败：本地已标记完成时信任本地状态
          const localComplete = localStorage.getItem(SETUP_KEY) === 'true';
          const cookieComplete = document.cookie.split(';').some(c => c.trim() === `${SETUP_KEY}=true`);
          setIsComplete(localComplete || cookieComplete);
        }
      } else {
        setIsComplete(false);
      }
    } catch (err) {
      console.warn('[useSetupStatus] 获取设置状态失败，回退到本地存储:', err);
      const localComplete = localStorage.getItem(SETUP_KEY) === 'true';
      const cookieComplete = document.cookie.split(';').some(c => c.trim() === `${SETUP_KEY}=true`);
      setIsComplete(localComplete || cookieComplete);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const markComplete = useCallback(async () => {
    setIsComplete(true);
    localStorage.setItem(SETUP_KEY, 'true');
    document.cookie = `${SETUP_KEY}=true; path=/; max-age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;

    try {
      await markSetupComplete();
    } catch (err) {
      console.warn('[useSetupStatus] 后端标记设置完成失败，本地状态已生效:', err);
    }
  }, []);

  return { isComplete, loading, markComplete, recheck: checkStatus };
}