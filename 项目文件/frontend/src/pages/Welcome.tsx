import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Steps, Input, Button, Typography, message, Space, Spin } from 'antd';
import { RocketOutlined, UserOutlined, LockOutlined, SettingOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useCustomization, saveAppSettings } from '../hooks/useCustomization';
import styles from './Welcome.module.css';

const { Title, Paragraph, Text } = Typography;

export default function Welcome() {
  const navigate = useNavigate();
  const customization = useCustomization();
  const [currentStep, setCurrentStep] = useState(0);
  const [appName, setAppName] = useState(customization.app.name);
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [creating, setCreating] = useState(false);
  const [checkingInit, setCheckingInit] = useState(true);
  const [isInit, setIsInit] = useState(false);

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

  const handleComplete = async () => {
    if (!adminUser || !adminPass) { message.warning('请设置管理员账号和密码'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/v1/auth/initial-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUser, password: adminPass }),
      });
      const json = await res.json();
      if (json.code === 0) {
        saveAppSettings({ name: appName });
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
          <div className={styles.formItem}>
            <Text strong>用户名</Text>
            <Input prefix={<UserOutlined />} value={adminUser} onChange={(e) => setAdminUser(e.target.value)} placeholder="管理员用户名" maxLength={50} />
          </div>
          <div className={styles.formItem}>
            <Text strong>密码</Text>
            <Input.Password prefix={<LockOutlined />} value={adminPass} onChange={(e) => setAdminPass(e.target.value)} placeholder="至少8位，包含字母和数字" />
          </div>
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
          <Paragraph>管理员：<Text strong>{adminUser || '未设置'}</Text></Paragraph>
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

  return (
    <div className={styles.container}>
      <Card className={styles.card ?? ''}>
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
              <Button type="primary" onClick={() => setCurrentStep(currentStep + 1)}>
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
  );
}
