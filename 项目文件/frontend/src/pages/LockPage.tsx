import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button, Form, Input, Typography, message } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useUser } from '../contexts/UserContext';
import { useLockContext } from '../contexts/LockContext';
import { request, HttpError } from '../utils/request';
import styles from './LockPage.module.css';

const { Title, Text } = Typography;

interface LockFormValues {
  password: string;
}

export default function LockPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useUser();
  const { unlock } = useLockContext();
  const [loading, setLoading] = useState(false);
  const [dissolving, setDissolving] = useState(false);

  useEffect(() => {
    // 直接刷新到 /lock 时 user 可能尚未加载，主动拉取一次
    if (!user) {
      void refreshUser();
    }
  }, [user, refreshUser]);

  const handleUnlock = async (values: LockFormValues) => {
    setLoading(true);
    try {
      const res = await request<{ valid: boolean }>('/auth/verify-password', {
        method: 'POST',
        body: { password: values.password },
      });
      if (res.code === 0 && res.data?.valid === true) {
        // 溶解动画 400ms 后解锁，同时传信号给 MainLayout 播放反向模糊进场
        setDissolving(true);
        setTimeout(() => {
          sessionStorage.setItem('workbench_just_unlocked', '1');
          unlock();
          const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
          if (idx > 0) {
            navigate(-1);
          } else {
            navigate('/', { replace: true });
          }
        }, 350);
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
      if (!dissolving) setLoading(false);
    }
  };

  const displayName = user?.nickname || user?.username || '未知用户';

  return (
    <div className={`${styles.container ?? ''} ${dissolving ? (styles.dissolving ?? '') : ''}`}>
      <Avatar
        size={80}
        src={user?.avatar || undefined}
        icon={!user?.avatar ? <UserOutlined /> : undefined}
        className={`${styles.avatar ?? ''} ${styles.enterElement ?? ''}`}
      />
      <Title level={4} className={`${styles.title ?? ''} ${styles.enterElement ?? ''}`}>
        {displayName}
      </Title>
      <Text type="secondary" className={`${styles.subtitle ?? ''} ${styles.enterElement ?? ''}`}>
        工作台已锁定，请输入密码解锁
      </Text>
      <Form<LockFormValues>
        name="lock"
        size="large"
        onFinish={handleUnlock}
        className={`${styles.form ?? ''} ${styles.enterElement ?? ''}`}
      >
        <Form.Item
          name="password"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请输入密码"
            aria-label="解锁密码"
            autoFocus
          />
        </Form.Item>
        <Form.Item className={styles.submitItem ?? ''}>
          <Button type="primary" htmlType="submit" loading={loading} block>
            解锁
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
