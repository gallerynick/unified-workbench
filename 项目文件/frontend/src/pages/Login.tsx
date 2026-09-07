import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message, Segmented } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { login } from '../api/auth';
import { verify2fa, webauthnVerifyLogin } from '../api/security';
import { setTokens, isAuthenticated } from '../utils/auth';
import { HttpError } from '../utils/request';
import { useCustomization } from '../hooks/useCustomization';
import { useUser } from '../contexts/UserContext';
import type { LoginRequest, LoginResponse, TokenResponse } from '../types/user';
import styles from './Login.module.css';

const { Title, Text } = Typography;

const OTP_LENGTH = 6;

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [codeMode, setCodeMode] = useState<'totp' | 'recovery' | 'webauthn'>('totp');
  const [code, setCode] = useState('');
  const customization = useCustomization();
  const { refreshUser } = useUser();

  // ── OTP 6 输入框 ──
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));

  const setDigit = (index: number, val: string) => {
    const next = [...otpDigits];
    next[index] = val;
    setOtpDigits(next);
    setCode(next.join(''));
    if (next.every((d) => d !== '')) void handleVerify2fa(next.join(''));
  };

  const handleOtpChange = (index: number, value: string) => {
    const clean = value.replace(/[^0-9]/g, '').slice(0, 1);
    setDigit(index, clean);
    if (clean && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
      setDigit(index - 1, '');
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleVerify2fa(otpDigits.join('').trim());
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setOtpDigits(next);
    setCode(next.join(''));
    otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
    if (next.every((d) => d !== '')) void handleVerify2fa(next.join(''));
  };

  useEffect(() => {
    fetch('/api/v1/auth/setup-status')
      .then((r) => r.json())
      .then((json) => {
        if (json?.data?.complete === false) {
          navigate('/welcome', { replace: true });
        }
      })
      .catch(() => {});
    if (isAuthenticated()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const finishLogin = async (data: LoginResponse) => {
    setTokens(data as TokenResponse);
    await refreshUser();
    message.success('登录成功');
    setTransitioning(true);
    setTimeout(() => navigate('/', { replace: true }), 500);
  };

  const handleSubmit = async (values: LoginRequest) => {
    setLoading(true);
    try {
      const response = await login(values);
      if (response.code === 0) {
        if (response.data.pending_2fa && response.data.pending_token) {
          setPendingToken(response.data.pending_token);
          setCode('');
          setOtpDigits(Array(OTP_LENGTH).fill(''));
          setCodeMode('totp');
        } else if (response.data.access_token && response.data.refresh_token) {
          await finishLogin(response.data);
        } else {
          message.error('登录响应异常');
        }
      } else {
        message.error('用户名或密码有误');
      }
    } catch (err: unknown) {
      if (err instanceof HttpError) {
        if (err.status === 401) {
          message.error('用户名或密码有误');
        } else if (err.status === 429) {
          message.error('登录尝试过于频繁，请稍后再试');
        } else {
          message.error('服务器错误，请稍后再试');
        }
      } else {
        message.error('网络错误，请检查网络连接');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2fa = async (codeValue?: string) => {
    const codeToUse = codeValue ?? code;
    if (!pendingToken) return;
    if (codeToUse.trim().length < 6) {
      message.warning(codeMode === 'totp' ? '请输入 6 位动态码' : '请输入恢复码');
      return;
    }
    setLoading(true);
    try {
      const response = await verify2fa(pendingToken, codeToUse.trim());
      if (response.code === 0 && response.data.access_token && response.data.refresh_token) {
        await finishLogin(response.data);
      } else {
        message.error(response.msg || '动态码或恢复码错误');
      }
    } catch (err: unknown) {
      if (err instanceof HttpError) {
        if (err.status === 401) {
          message.error('动态码或恢复码错误');
        } else {
          message.error(err.message || '验证失败，请重试');
        }
      } else {
        message.error('网络错误，请检查网络连接');
      }
    } finally {
      setLoading(false);
    }
  };

  // WebAuthn 验证
  const handleWebAuthnVerify = async () => {
    if (!pendingToken) return;
    setLoading(true);
    try {
      // 调用浏览器 WebAuthn API
      // 先获取认证配置
      const authStartRes = await fetch('/api/v1/auth/webauthn/authenticate/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const authStart = await authStartRes.json();
      
      if (authStart.code !== 0 || !authStart.data) {
        message.error(authStart.msg || '获取验证配置失败');
        return;
      }
      
      const opts = authStart.data;
      const challenge = Uint8Array.from(
        atob(opts.challenge.replace(/-/g, '+').replace(/_/g, '/')),
        c => c.charCodeAt(0)
      );
      
      const allowCredentials = opts.allow_credentials.map((cid: string) => ({
        type: 'public-key',
        id: Uint8Array.from(atob(cid.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
        transports: ['internal', 'usb', 'nfc'],
      }));
      
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: opts.rp_id,
          timeout: opts.timeout,
          allowCredentials,
          userVerification: opts.user_verification,
        },
      }) as any;
      
      if (!assertion) {
        message.warning('用户取消了验证');
        return;
      }
      
      // 发送验证结果到后端
      const finishRes = await webauthnVerifyLogin({
        pending_token: pendingToken,
        credential_id: assertion.id,
        raw_id: btoa(String.fromCharCode(...new Uint8Array(assertion.rawId))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
        response: {
          authenticatorData: btoa(String.fromCharCode(...new Uint8Array(assertion.response.authenticatorData))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
          clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(assertion.response.clientDataJSON))),
          signature: btoa(String.fromCharCode(...new Uint8Array(assertion.response.signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
          userHandle: assertion.response.userHandle 
            ? btoa(String.fromCharCode(...new Uint8Array(assertion.response.userHandle))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
            : undefined,
        },
        client_json: JSON.stringify(JSON.parse(btoa(String.fromCharCode(...new Uint8Array(assertion.response.clientDataJSON))))),
      });
      
      if (finishRes.code === 0 && finishRes.data && (finishRes.data as any).access_token && (finishRes.data as any).refresh_token) {
        await finishLogin(finishRes.data as any);
      } else {
        message.error(finishRes.msg || 'WebAuthn 验证失败');
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        message.warning('用户取消了验证或浏览器不支持');
      } else if (err.name === 'NotSupportedError') {
        message.warning('当前浏览器不支持 WebAuthn');
      } else if (err.name === 'NoInteractiveUserError') {
        message.warning('无法检测到用户交互，请重试');
      } else {
        message.error('验证失败: ' + (err.message || '未知错误'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setPendingToken(null);
    setCode('');
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    setCodeMode('totp');
  };

  return (
    <div className={'login-page ' + (styles.container ?? '') + (transitioning ? ' ' + (styles.containerLeaving ?? '') : '')}>
      <Card className={(styles.card ?? '') + (transitioning ? ' ' + (styles.cardLeaving ?? '') : '')} bordered={false}>
        <div className={styles.header ?? ''}>
          <Title level={2} className={styles.title ?? ''}>
            {customization.app.name}
          </Title>
          <Text type="secondary">{pendingToken ? '二次验证' : '请登录以继续'}</Text>
        </div>

        {!pendingToken ? (
          <Form<LoginRequest>
            name="login"
            size="large"
            onFinish={handleSubmit}
            autoComplete="off"
            className={styles.form ?? ''}
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="用户名"
                aria-label="用户名"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
                aria-label="密码"
              />
            </Form.Item>

            <Form.Item className={styles.submitItem ?? ''}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
              >
                登录
              </Button>
            </Form.Item>
          </Form>
        ) : (
          <div className={styles.form2fa ?? ''}>
            <div className={styles.otpIconWrap ?? ''}>
              {(customization.branding.logoCollapsed || customization.branding.logoExpanded || '/favicon.svg') ? (
                <img
                  src={customization.branding.logoCollapsed || customization.branding.logoExpanded || '/favicon.svg'}
                  alt={customization.app.name}
                  className={styles.otpLogo ?? ''}
                />
              ) : (
                <SafetyOutlined className={styles.otpIcon ?? ''} />
              )}
            </div>
            <Text className={styles.otpLabel ?? ''} type="secondary">
              {codeMode === 'totp'
                ? '请输入认证器 App 中显示的 6 位动态码'
                : codeMode === 'recovery'
                ? '请输入您在开启双因素认证时生成并保存的恢复码'
                : '点击按钮使用指纹/面容快速验证'}
            </Text>

            <Segmented
              className={styles.otpSegmented ?? ''}
              block
              value={codeMode}
              onChange={(v) => {
                setCodeMode(v as 'totp' | 'recovery' | 'webauthn');
                setCode('');
                setOtpDigits(Array(OTP_LENGTH).fill(''));
              }}
              options={[
                { label: '动态码', value: 'totp' },
                { label: '恢复码', value: 'recovery' },
                { label: '指纹', value: 'webauthn', icon: <SafetyOutlined /> },
              ]}
            />

            {codeMode === 'totp' ? (
              <div className={styles.otpRow ?? ''}>
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={handleOtpPaste}
                    className={styles.otpBox ?? ''}
                    autoFocus={i === 0}
                    disabled={loading}
                  />
                ))}
              </div>
            ) : codeMode === 'recovery' ? (
              <Input
                size="large"
                autoFocus
                maxLength={20}
                placeholder="恢复码（如 XXXX-XXXX-XXXX）"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onPressEnter={() => void handleVerify2fa()}
                className={styles.recoveryInput ?? ''}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <SafetyOutlined style={{ fontSize: 48, color: 'var(--color-primary)' }} />
                <p style={{ marginTop: 12, color: 'var(--text-secondary)' }}>
                  点击下方按钮，浏览器将弹出系统验证窗口
                </p>
              </div>
            )}

            <Button
              type="primary"
              block
              className={styles.verifyBtn ?? ''}
              loading={loading}
              onClick={() => {
                if (codeMode === 'webauthn') {
                  void handleWebAuthnVerify();
                } else {
                  void handleVerify2fa();
                }
              }}
            >{codeMode === 'webauthn' ? '使用指纹/面容验证' : '验证'}</Button>

            <Button
              type="link"
              block
              className={styles.backLink ?? ''}
              onClick={handleBackToLogin}
            >返回上一步</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
