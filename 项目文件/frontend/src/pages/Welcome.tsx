import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Steps, Input, Button, Typography, message, Space } from 'antd';
import { RocketOutlined, SettingOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useCustomization, saveAppSettings } from '../hooks/useCustomization';
import styles from './Welcome.module.css';

const { Title, Paragraph, Text } = Typography;

const STORAGE_KEY = 'setup_complete';

export function isSetupComplete(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function markSetupComplete(): void {
  localStorage.setItem(STORAGE_KEY, 'true');
}

export default function Welcome() {
  const navigate = useNavigate();
  const customization = useCustomization();
  const [currentStep, setCurrentStep] = useState(0);
  const [appName, setAppName] = useState(customization.app.name);
  const [appDescription, setAppDescription] = useState(customization.app.description);

  useEffect(() => {
    if (isSetupComplete()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleComplete = () => {
    saveAppSettings({ name: appName, description: appDescription });
    markSetupComplete();
    message.success('设置完成，欢迎使用！');
    navigate('/', { replace: true });
  };

  const handleSkip = () => {
    markSetupComplete();
    navigate('/', { replace: true });
  };

  const steps = [
    {
      title: '欢迎',
      icon: <RocketOutlined />,
      content: (
        <div className={styles.stepContent}>
          <Title level={3}>欢迎使用一站式工作台</Title>
          <Paragraph>
            这是您首次登录系统。让我们花一点时间完成基本设置，
            让工作台更符合您的团队需求。
          </Paragraph>
          <Paragraph type="secondary">
            您也可以点击"跳过"直接使用默认设置。
          </Paragraph>
        </div>
      ),
    },
    {
      title: '基本设置',
      icon: <SettingOutlined />,
      content: (
        <div className={styles.stepContent}>
          <Title level={4}>基本设置</Title>
          <div className={styles.formItem}>
            <Text strong>工作台名称</Text>
            <Input
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="输入您的工作台名称"
              maxLength={20}
            />
          </div>
          <div className={styles.formItem}>
            <Text strong>描述</Text>
            <Input.TextArea
              value={appDescription}
              onChange={(e) => setAppDescription(e.target.value)}
              placeholder="输入工作台描述"
              rows={3}
              maxLength={100}
            />
          </div>
        </div>
      ),
    },
    {
      title: '完成',
      icon: <CheckCircleOutlined />,
      content: (
        <div className={styles.stepContent}>
          <Title level={3}>设置完成！</Title>
          <Paragraph>
            工作台名称：<Text strong>{appName}</Text>
          </Paragraph>
          <Paragraph>
            描述：<Text type="secondary">{appDescription}</Text>
          </Paragraph>
          <Paragraph type="secondary">
            点击"完成"进入工作台。您可以随时在系统设置中修改这些配置。
          </Paragraph>
        </div>
      ),
    },
  ];

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
              <>
                <Button type="primary" onClick={() => setCurrentStep(currentStep + 1)}>
                  下一步
                </Button>
                <Button onClick={handleSkip}>
                  跳过
                </Button>
              </>
            )}
            {currentStep === steps.length - 1 && (
              <Button type="primary" onClick={handleComplete}>
                完成
              </Button>
            )}
          </Space>
        </div>
      </Card>
    </div>
  );
}
