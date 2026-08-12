import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button, Input, Typography, message } from 'antd';
import type { InputRef } from 'antd';
import { LockOutlined, UserOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useUser } from '../contexts/UserContext';
import { useLockContext } from '../contexts/LockContext';
import { request, HttpError } from '../utils/request';
import styles from './LockPage.module.css';

const { Title, Text } = Typography;

export default function LockPage() {
  const { user, refreshUser } = useUser();
  const { unlock } = useLockContext();
  const [loading, setLoading] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [password, setPassword] = useState('');
  const passwordInputRef = useRef<InputRef>(null);
  const navigate = useNavigate();
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const IDLE_TIMEOUT = 60_000;

  const startIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setShowInput(false);
      setPassword('');
    }, IDLE_TIMEOUT);
  }, []);

  // 键盘任意键自动展开输入区并重置 1 分钟无操作计时
  useEffect(() => {
    const onKeyDown = () => {
      setShowInput(true);
      startIdleTimer();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [startIdleTimer]);

  // 展开后启动计时 / 收起时清理
  useEffect(() => {
    if (showInput) {
      startIdleTimer();
    }
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [showInput, startIdleTimer]);

  useEffect(() => {
    // 直接刷新到 /lock 时 user 可能尚未加载，主动拉取一次
    if (!user) {
      void refreshUser();
    }
  }, [user, refreshUser]);

  // 输入区展开后聚焦密码框
  useEffect(() => {
    if (showInput) {
      passwordInputRef.current?.focus();
    }
  }, [showInput]);

  const handleUnlock = async () => {
    if (!password) {
      message.warning('请输入密码');
      return;
    }
    setLoading(true);
    try {
      const res = await request<{ valid: boolean }>('/auth/verify-password', {
        method: 'POST',
        body: { password },
      });
      if (res.code === 0 && res.data?.valid === true) {
        setLoading(false);
        setExiting(true);
        setTimeout(() => {
          unlock();
          const returnPath = sessionStorage.getItem('workbench_lock_return') || '/';
          sessionStorage.setItem('workbench_just_unlocked', '1');
          navigate(returnPath, { replace: true });
        }, 700);
      } else {
        message.error('密码错误');
      }
    } catch (err: unknown) {
      if (err instanceof HttpError && err.status === 401) {
        message.error('密码错误');
      } else {
        message.error('解锁失败，请重试');
      }
    } finally {
      if (!exiting) setLoading(false);
    }
  };

  const displayName = user?.nickname || user?.username || '未知用户';

  return (
    <div className={`${styles.container ?? ''} ${exiting ? (styles.exiting ?? '') : ''}`}>
      <Avatar
        size={80}
        src={user?.avatar || undefined}
        icon={!user?.avatar ? <UserOutlined /> : undefined}
        className={`${styles.avatar ?? ''} ${styles.enterElement ?? ''}`}
      />
      <Title level={4} className={`${styles.title ?? ''} ${styles.enterElement ?? ''}`}>
        {displayName}
      </Title>
      <button
        type="button"
        aria-label="解锁"
        onClick={() => { setShowInput(true); startIdleTimer(); }}
        className={`${styles.lockIcon ?? ''} ${styles.enterElement ?? ''}`}
      >
        <LockOutlined />
      </button>
      {showInput ? (
        <div className={`${styles.inputRow ?? ''} ${styles.enterElement ?? ''}`}>
          <Input.Password
            ref={passwordInputRef}
            size="large"
            prefix={<LockOutlined />}
            placeholder="请输入密码"
            aria-label="解锁密码"
            value={password}
            onChange={(e) => { setPassword(e.target.value); startIdleTimer(); }}
            onPressEnter={() => void handleUnlock()}
            className={styles.passwordInput ?? ''}
          />
          <Button
            type="primary"
            loading={loading}
            className={styles.unlockCircle ?? ''}
            aria-label="解锁"
            onClick={() => void handleUnlock()}
            icon={<ArrowRightOutlined />}
          />
        </div>
      ) : (
        <Text type="secondary" className={`${styles.subtitle ?? ''} ${styles.enterElement ?? ''}`}>
          已锁定
        </Text>
      )}
    </div>
  );
}
