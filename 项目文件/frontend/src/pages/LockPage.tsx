import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Input, Typography, message } from 'antd';
import type { InputRef } from 'antd';
import { LockOutlined, UserOutlined, ArrowRightOutlined, SafetyOutlined } from '@ant-design/icons';
import { useUser } from '../contexts/UserContext';
import { useLockContext } from '../contexts/LockContext';
import { request, HttpError } from '../utils/request';
import { webauthnAuthStart, webauthnVerifyLock, listWebAuthnCredentials } from '../api/security';
import styles from './LockPage.module.css';

/** Base64url 编码辅助函数 */
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

const { Title, Text } = Typography;

export default function LockPage() {
  const { user, refreshUser } = useUser();
  const { unlock } = useLockContext();
  const [loading, setLoading] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [password, setPassword] = useState('');
    const [waLoading, setWaLoading] = useState(false);
  const [hasWaCredentials, setHasWaCredentials] = useState(false);

const passwordInputRef = useRef<InputRef>(null);
  const navigate = useNavigate();
    // 检查用户是否有 WebAuthn 凭据
  useEffect(() => {
    listWebAuthnCredentials()
      .then((res) => {
        setHasWaCredentials(res.code === 0 && res.data && res.data.length > 0);
      })
      .catch(() => setHasWaCredentials(false));
  }, [user]);

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
        }, 500);
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


  const handleWebAuthnUnlock = async () => {
    setWaLoading(true);
    try {
      // 获取认证配置
      const startRes = await webauthnAuthStart();
      if (startRes.code !== 0 || !startRes.data) {
        message.error(startRes.msg || '获取验证配置失败');
        return;
      }

      const opts = startRes.data;
      const challenge = Uint8Array.from(
        atob(opts.challenge.replace(/-/g, '+').replace(/_/g, '/')),
        c => c.charCodeAt(0)
      );

      const allowCredentials = opts.allow_credentials?.map((cid: string) => ({
        type: 'public-key' as const,
        id: Uint8Array.from(atob(cid.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
        transports: ['internal', 'usb', 'nfc'] as any,
      }));

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: opts.rp_id,
          timeout: opts.timeout,
          allowCredentials,
          userVerification: opts.user_verification as any,
        },
      }) as any;

      if (!assertion) {
        message.warning('用户取消了验证');
        return;
      }

      // 发送验证结果到后端
      const finishRes = await webauthnVerifyLock({
        credential_id: assertion.id,
        raw_id: b64url(new Uint8Array(assertion.rawId)),
        response: {
          authenticatorData: b64url(new Uint8Array(assertion.response.authenticatorData)),
          clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(assertion.response.clientDataJSON))),
          signature: b64url(new Uint8Array(assertion.response.signature)),
          userHandle: assertion.response.userHandle
            ? b64url(new Uint8Array(assertion.response.userHandle))
            : undefined,
        },
        client_json: new TextDecoder().decode(assertion.response.clientDataJSON),
      });

      if (finishRes.code === 0 && finishRes.data?.valid === true) {
        setExiting(true);
        setTimeout(() => {
          unlock();
          const returnPath = sessionStorage.getItem('workbench_lock_return') || '/';
          sessionStorage.setItem('workbench_just_unlocked', '1');
          navigate(returnPath, { replace: true });
        }, 500);
      } else {
        message.error(finishRes.msg || 'WebAuthn 验证失败');
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        message.warning('用户取消了验证');
      } else if (err.name === 'NotSupportedError') {
        message.warning('当前浏览器不支持 WebAuthn');
      } else {
        message.error('验证失败: ' + (err.message || '未知错误'));
      }
    } finally {
      setWaLoading(false);
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
      {showInput ? (
        <div className={styles.interactive ?? ''}>
          <div className={`${styles.inputRow ?? ''} ${styles.enterElement ?? ''}`}>
            <Input.Password
              ref={passwordInputRef}
              size="middle"
              prefix={<LockOutlined style={{ color: 'var(--text-secondary)' }} />}
              placeholder="请输入密码"
              aria-label="解锁密码"
              value={password}
              onChange={(e) => { setPassword(e.target.value); startIdleTimer(); }}
              onPressEnter={() => void handleUnlock()}
              className={styles.passwordInput ?? ''}
            />
            <button
              type="button"
              aria-label="解锁"
              disabled={loading}
              onClick={() => void handleUnlock()}
              className={styles.unlockCircle ?? ''}
            >
              <ArrowRightOutlined />
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.interactive ?? ''}>
          <button
            type="button"
            aria-label="解锁"
            onClick={() => { setShowInput(true); startIdleTimer(); }}
            className={`${styles.lockIcon ?? ''} ${styles.enterElement ?? ''}`}
          >
            <LockOutlined />
          </button>
          {hasWaCredentials && (
            <button
              type="button"
              aria-label="使用指纹解锁"
              disabled={waLoading}
              onClick={() => void handleWebAuthnUnlock()}
              className={`${styles.lockIcon ?? ''} ${styles.enterElement ?? ''}`}
              style={{ marginLeft: 16 }}
            >
              <SafetyOutlined />
            </button>
          )}
          <Text type="secondary" className={`${styles.subtitle ?? ''} ${styles.enterElement ?? ''}`}>
            已锁定
          </Text>
        </div>
      )}
    </div>
  );
}