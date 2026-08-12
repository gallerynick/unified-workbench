import { useState, useEffect } from 'react';
import { Card, Form, Switch, Button, Typography, message, Alert, Space, Result } from 'antd';
import { SaveOutlined, SafetyOutlined, LockOutlined } from '@ant-design/icons';
import { isAdmin } from '../../utils/auth';
import styles from './SiteSettings.module.css';

const { Title } = Typography;

const SITE_CONFIG_KEY = 'site_config';

interface SiteConfig {
  debug_mode: boolean;
  maintenance_mode: boolean;
}

const DEFAULT_CONFIG: SiteConfig = {
  debug_mode: false,
  maintenance_mode: false,
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
  window.dispatchEvent(new Event('site-config-changed'));
}

export function isDebugModeEnabled(): boolean {
  return getSiteConfig().debug_mode;
}

export function isMaintenanceModeEnabled(): boolean {
  return getSiteConfig().maintenance_mode;
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
        debug_mode: values.debug_mode,
        maintenance_mode: values.maintenance_mode,
      });
      message.success('站点配置已保存');
    } catch {
      message.error('请检查输入');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>站点配置</Title>
      </div>
      <Alert
        message="管理员专属"
        description="这些配置影响整个站点的访问方式。修改后可能需要重启服务才能生效。"
        type="warning"
        showIcon
        style={{ marginBottom: "var(--spacing-lg)" }}
      />

      <Form form={form} layout="vertical">
        <Card title={<><SafetyOutlined /> 维护模式</>} style={{ marginBottom: "var(--spacing-lg)" }}>
          <Form.Item
            label="开启维护模式"
            name="maintenance_mode"
            valuePropName="checked"
            extra="开启后，普通成员访问系统将显示维护提示页，无法进入系统。只有管理员可以正常访问。"
          >
            <Switch />
          </Form.Item>
        </Card>

        <Card title={<><SafetyOutlined /> 调试模式</>} style={{ marginBottom: "var(--spacing-lg)" }}>
          <Form.Item
            label="开启调试模式"
            name="debug_mode"
            valuePropName="checked"
            extra="开启后，工作台右下角显示调试面板，可查看界面元素信息并复制元素选择器。仅供管理员开发调试使用，不影响普通成员访问。"
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
