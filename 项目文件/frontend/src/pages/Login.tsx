import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { login } from '../api/auth';
import { setTokens, isAuthenticated } from '../utils/auth';
import type { LoginRequest } from '../types/user';
import styles from './Login.module.css';

const { Title, Text } = Typography;

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // 已登录则直接跳转首页
  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (values: LoginRequest) => {
    setLoading(true);
    try {
      const response = await login(values);
      if (response.code === 0) {
        setTokens(response.data);
        message.success('登录成功');
        navigate('/', { replace: true });
      } else {
        message.error(response.msg || '登录失败');
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : '登录失败，请稍后重试';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container ?? ''}>
      <Card className={styles.card ?? ''} bordered={false}>
        <div className={styles.header ?? ''}>
          <Title level={3} className={styles.title ?? ''}>
            一站式工作台
          </Title>
          <Text type="secondary">请登录以继续</Text>
        </div>

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
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
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
      </Card>
    </div>
  );
}
