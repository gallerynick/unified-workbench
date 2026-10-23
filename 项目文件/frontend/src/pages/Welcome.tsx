import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Steps, Input, Button, Typography, message, Space, Spin, ConfigProvider, Form } from 'antd';
import { RocketOutlined, UserOutlined, LockOutlined, IdcardOutlined, SettingOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useCustomization, saveAppSettings } from '../hooks/useCustomization';
import { getAntdThemeConfig } from '../contexts/ThemeContext';
import AftermathAnimationSection from './dev/TestPageAftermath';
import styles from './Welcome.module.css';

const { Title, Paragraph, Text } = Typography;

export default function Welcome() {
  const navigate = useNavigate();
  const customization = useCustomization();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [appName, setAppName] = useState(customization.app.name);
  const [creating, setCreating] = useState(false);
  const [checkingInit, setCheckingInit] = useState(true);
  const [showAnimation, setShowAnimation] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [isInit, setIsInit] = useState(false);

  // 初始化界面强制浅色主题（不允许深色模式）
  useEffect(() => {
    const root = document.documentElement;
    const prevTheme = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'light');
    return () => {
      root.setAttribute('data-theme', prevTheme || 'light');
    };
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/v1/auth/setup-status');
        const json = await res.json();
        if (json?.data?.complete === true) {
          setIsInit(true);
        }
      } catch { /* ok */ }
      setCheckingInit(false);
    };
    check();
  }, []);

  // 离开「创建管理员」步骤前就地校验表单（用户名 / 密码强度 / 确认密码一致）
  const handleNext = async () => {
    if (currentStep === 1) {
      try {
        await form.validateFields();
      } catch {
        return; // 校验失败：错误已就地显示在字段下方，停留在当前步骤
      }
    }
    setCurrentStep(currentStep + 1);
  };

  const handleComplete = async () => {
    try {
      await form.validateFields();
    } catch {
      message.warning('请先完善管理员账号信息');
      return;
    }
    const adminUser = form.getFieldValue('username') as string;
    const adminPass = form.getFieldValue('password') as string;
    const adminName = form.getFieldValue('nickname') as string | undefined;
    setCreating(true);
    try {
      const res = await fetch('/api/v1/auth/initial-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUser, password: adminPass, nickname: adminName || undefined }),
      });
      const json = await res.json();
      if (json.code === 0) {
        void saveAppSettings({ name: appName });
        message.success(`管理员 ${adminUser} 创建成功，即将跳转登录页...`);
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      } else {
        message.error(json.msg || json.detail || '初始化失败');
      }
    } catch { message.error('网络错误'); }
    finally { setCreating(false); }
  };

  const steps = [
    {
      title: '欢迎',
      icon: <RocketOutlined />,
      content: (
        <div className={styles.stepContent}>
          <Title level={3}>欢迎使用一站式工作台</Title>
          <Paragraph>系统尚未初始化，请完成以下设置开始使用。</Paragraph>
        </div>
      ),
    },
    {
      title: '创建管理员',
      icon: <UserOutlined />,
      content: (
        <div className={styles.stepContent}>
          <Title level={4}>创建管理员账号</Title>
          <Form
            form={form}
            layout="vertical"
            className={styles.form}
          >
            <Form.Item
              name="username"
              label="用户名"
              rules={[
                { required: true, message: '请输入管理员用户名' },
                { min: 3, message: '用户名长度至少 3 个字符' },
                { max: 50, message: '用户名长度不能超过 50 个字符' },
              ]}
            >
              <Input prefix={<UserOutlined />} placeholder="管理员用户名" maxLength={50} />
            </Form.Item>
            <Form.Item
              name="nickname"
              label="姓名"
            >
              <Input prefix={<IdcardOutlined />} placeholder="请输入您的姓名（可选）" maxLength={20} />
            </Form.Item>
            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 8, message: '密码长度至少 8 位' },
                { pattern: /^(?=.*[a-zA-Z])(?=.*\d).+$/, message: '密码必须包含字母和数字' },
              ]}
              extra="密码长度至少 8 位，必须包含字母和数字"
            >
              <Input.Password prefix={<LockOutlined />} placeholder="至少8位，包含字母和数字" />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="确认密码"
              dependencies={['password']}
              rules={[
                { required: true, message: '请再次输入密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="请再次输入密码" />
            </Form.Item>
          </Form>
        </div>
      ),
    },
    {
      title: '应用设置',
      icon: <SettingOutlined />,
      content: (
        <div className={styles.stepContent}>
          <Title level={4}>基本设置</Title>
          <div className={styles.formItem}>
            <Text strong>工作台名称</Text>
            <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="输入您的工作台名称" maxLength={20} />
          </div>
        </div>
      ),
    },
    {
      title: '完成',
      icon: <CheckCircleOutlined />,
      content: (
        <div className={styles.stepContent}>
          <Title level={3}>设置完成</Title>
          <Paragraph>管理员：<Text strong>{form.getFieldValue('username') || '未设置'}</Text></Paragraph>
          <Paragraph>工作台名称：<Text strong>{appName}</Text></Paragraph>
          <Paragraph type="secondary">点击"完成"创建管理员并进入登录页面。</Paragraph>
        </div>
      ),
    },
  ];

  if (checkingInit) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  }

  if (isInit) {
    return <div style={{ textAlign: 'center', padding: '40px' }}><Button type="primary" onClick={() => navigate('/login')}>系统已初始化，前往登录</Button></div>;
  }

  if (showAnimation) {
    return (
      <AftermathAnimationSection
        onComplete={() => {
          // 白屏后 0.5s，浮窗浮出（Windows OOBE 风格）
          setTimeout(() => {
            setShowAnimation(false);
            setRevealed(true);
          }, 500);
        }}
      />
    );
  }

  return (
    <ConfigProvider theme={getAntdThemeConfig(false)}>
    <div className={styles.container + (revealed ? ' ' + styles.reveal : '')}>
      <Card
        className={(revealed ? styles.cardReveal + ' ' : '') + (styles.card ?? '')}
        styles={{ body: { padding: 'var(--spacing-card-gap)' } }}
      >
        <Steps
          current={currentStep}
          items={steps.map((s) => ({ title: s.title, icon: s.icon }))}
          className={styles.steps ?? ''}
        />
        <div className={styles.content ?? ''}>
          {steps[currentStep]?.content}
        </div>
        <div className={styles.actions ?? ''}>
          <Space>
            {currentStep > 0 && (
              <Button onClick={() => setCurrentStep(currentStep - 1)}>
                上一步
              </Button>
            )}
            {currentStep < steps.length - 1 && (
              <Button type="primary" onClick={handleNext}>
                下一步
              </Button>
            )}
            {currentStep === steps.length - 1 && (
              <Button type="primary" onClick={handleComplete} loading={creating}>
                完成
              </Button>
            )}
          </Space>
        </div>
      </Card>
    </div>
    </ConfigProvider>
  );
}
