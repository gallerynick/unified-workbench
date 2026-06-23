import { useState, useEffect } from 'react';
import { Card, Form, Input, Switch, Button, Typography, message, Alert, Space } from 'antd';
import { SaveOutlined, GlobalOutlined, SafetyOutlined, LockOutlined } from '@ant-design/icons';
import { isAdmin } from '../../utils/auth';
import { Result } from 'antd';

const { Title } = Typography;

const SITE_CONFIG_KEY = 'site_config';

interface SiteConfig {
  site_port: string;
  site_ip: string;
  test_mode: boolean;
}

const DEFAULT_CONFIG: SiteConfig = {
  site_port: '80',
  site_ip: 'localhost',
  test_mode: false,
};

function getSiteConfig(): SiteConfig {
  try {
    const stored = localStorage.getItem(SITE_CONFIG_KEY);
    return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveSiteConfig(config: SiteConfig): void {
  localStorage.setItem(SITE_CONFIG_KEY, JSON.stringify(config));
}

export function isTestModeEnabled(): boolean {
  return getSiteConfig().test_mode;
}

export default function SiteSettings() {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const config = getSiteConfig();
    form.setFieldsValue(config);
  }, [form]);

  if (!isAdmin()) {
    return (
      <Result
        status="403"
        title="权限不足"
        subTitle="只有管理员可以访问站点配置"
        icon={<LockOutlined />}
      />
    );
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      saveSiteConfig({
        site_port: values.site_port,
        site_ip: values.site_ip,
        test_mode: values.test_mode,
      });
      message.success('站点配置已保存');
    } catch {
      message.error('请检查输入');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <Title level={4} style={{ margin: 0 }}>站点访问配置</Title>
      <Alert
        message="管理员专属"
        description="这些配置影响整个站点的访问方式。修改后可能需要重启服务才能生效。"
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form form={form} layout="vertical">
        <Card title={<><GlobalOutlined /> 访问配置</>} style={{ marginBottom: 24 }}>
          <Form.Item label="站点端口" name="site_port">
            <Input placeholder="80" />
          </Form.Item>
          <Form.Item label="站点 IP/域名" name="site_ip">
            <Input placeholder="localhost" />
          </Form.Item>
        </Card>

        <Card title={<><SafetyOutlined /> 测试模式</>} style={{ marginBottom: 24 }}>
          <Form.Item
            label="开启测试模式"
            name="test_mode"
            valuePropName="checked"
            extra="开启后，普通成员访问系统将显示测试提示页，无法进入系统。只有管理员可以正常访问。"
          >
            <Switch />
          </Form.Item>
        </Card>

        <Space>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            保存配置
          </Button>
        </Space>
      </Form>
    </div>
  );
}
