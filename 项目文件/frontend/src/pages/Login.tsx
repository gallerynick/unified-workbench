import { useEffect, useState } from 'react';
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

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [codeMode, setCodeMode] = useState<'totp' | 'recovery'>('totp');
  const [code, setCode] = useState('');
  const customization = useCustomization();
  const { refreshUser } = useUser();

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

  return (
    <div className={`login-page ${styles.container ?? ''} ${transitioning ? styles.containerLeaving : ''}`}>
      <Card className={`${styles.card ?? ''} ${transitioning ? styles.cardLeaving : ''}`} bordered={false}>
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
          <div className={styles.form ?? ''}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <SafetyOutlined style={{ fontSize: 40, color: 'var(--color-primary)' }} />
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                请输入认证器中的 6 位动态码
              </Text>
            </div>
            <Segmented
              block
              style={{ marginBottom: 12 }}
              value={codeMode}
              onChange={(v) => setCodeMode(v as 'totp' | 'recovery')}
              options={[
                { label: '动态码', value: 'totp' },
                { label: '恢复码', value: 'recovery' },
              ]}
            />
            <Input
              size="large"
              autoFocus
              maxLength={codeMode === 'totp' ? 6 : 20}
              placeholder={codeMode === 'totp' ? '6 位动态码' : '恢复码（如 XXXX-XXXX-XXXX）'}
              value={code}
              onChange={(e) => {
                const v = e.target.value;
                setCode(codeMode === 'totp' ? v.replace(/[^0-9]/g, '') : v);
              }}
              onPressEnter={handleVerify2fa}
            />
            <Button
              type="primary"
              block
              style={{ marginTop: 12 }}
              loading={loading}
              onClick={handleVerify2fa}
            >验证</Button>
            <Button
              type="link"
              block
              style={{ marginTop: 8 }}
              onClick={() => setPendingToken(null)}
            >返回上一步</Button>
          </div>
        )}
      </Card>
    </div>
  );
}