import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message, Segmented } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { login } from '../api/auth';
import { verify2fa } from '../api/security';
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
  const [codeMode, setCodeMode] = useState<'totp' | 'recovery'>('totp');
  const [code, setCode] = useState('');
  const customization = useCustomization();
  const { refreshUser } = useUser();

  // ── OTP 输入框 refs ──
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));

  // ── 二次验证时同步 otpDigits → code ──
  const handleOtpChange = (index: number, value: string) => {
    // 只允许数字
    const clean = value.replace(/[^0-9]/g, '');
    if (!clean) return;

    const next = [...otpDigits];
    next[index] = clean.charAt(0); // 每格只取1位
    setOtpDigits(next);
    setCode(next.join(''));

    // 输入后跳到下一格
    if (clean.length > 0 && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }

    // 6 位填满后自动提交
    if (next.every((d) => d !== '')) {
      void handleVerify2fa();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace 空输入时跳回上一格
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
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

    // 聚焦到最后一位输入的下一格
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    otpRefs.current[focusIndex]?.focus();

    // 填满自动提交
    if (next.every((d) => d !== '')) {
      void handleVerify2fa();
    }
  };

  useEffect(() => {
    // 检查系统初始化状态
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
          // 进入二次验证步骤
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

  const handleVerify2fa = async () => {
    if (!pendingToken) return;
    if (code.trim().length < 6) {
      message.warning(codeMode === 'totp' ? '请输入 6 位动态码' : '请输入恢复码');
      return;
    }
    setLoading(true);
    try {
      const response = await verify2fa(pendingToken, code.trim());
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
              <SafetyOutlined className={styles.otpIcon ?? ''} />
            </div>
            <Text className={styles.otpLabel ?? ''} type="secondary">
              {codeMode === 'totp'
                ? '请输入认证器 App 中显示的 6 位动态码'
                : '请输入您在开启双因素认证时生成并保存的恢复码'}
            </Text>

            <Segmented
              className={styles.otpSegmented ?? ''}
              block
              value={codeMode}
              onChange={(v) => {
                setCodeMode(v as 'totp' | 'recovery');
                setCode('');
                setOtpDigits(Array(OTP_LENGTH).fill(''));
              }}
              options={[
                { label: '动态码', value: 'totp' },
                { label: '恢复码', value: 'recovery' },
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
                    aria-label={'验证码第 ' + (i + 1) + ' 位'}
                    autoFocus={i === 0}
                    disabled={loading}
                  />
                ))}
              </div>
            ) : (
              <Input
                size="large"
                autoFocus
                maxLength={20}
                placeholder="恢复码（如 XXXX-XXXX-XXXX）"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onPressEnter={handleVerify2fa}
                className={styles.recoveryInput ?? ''}
              />
            )}

            <Button
              type="primary"
              block
              className={styles.verifyBtn ?? ''}
              loading={loading}
              onClick={handleVerify2fa}
            >验证</Button>

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
