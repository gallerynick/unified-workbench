import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { login } from '../api/auth';
import { setTokens, isAuthenticated } from '../utils/auth';
import { HttpError } from '../utils/request';
import { useCustomization } from '../hooks/useCustomization';
import type { LoginRequest } from '../types/user';
import styles from './Login.module.css';

const { Title, Text } = Typography;

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const customization = useCustomization();

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

  return (
    <div className={styles.container ?? ''}>
      <Card className={styles.card ?? ''} bordered={false}>
        <div className={styles.header ?? ''}>
          <Title level={3} className={styles.title ?? ''}>
            {customization.app.name}
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
