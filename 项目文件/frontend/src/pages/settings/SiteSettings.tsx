import { useState, useEffect } from 'react';
import { Card, Form, Switch, Button, Typography, message, Space, Result } from 'antd';
import { SaveOutlined, SafetyOutlined, LockOutlined } from '@ant-design/icons';
import { isAdmin } from '../../utils/auth';
import { request } from '../../utils/request';
import styles from './SiteSettings.module.css';

const { Title } = Typography;

const SITE_CONFIG_API = '/system/site-config';

interface SiteConfig {
  debug_mode: boolean;
  maintenance_mode: boolean;
}

const DEFAULT_CONFIG: SiteConfig = {
  debug_mode: false,
  maintenance_mode: false,
};

/** 从后端读取站点开关（全站统一） */
async function fetchSiteConfig(): Promise<SiteConfig> {
  try {
    const res = await request<SiteConfig>(SITE_CONFIG_API);
    if (res.code === 0 && res.data) {
      return {
        debug_mode: Boolean(res.data.debug_mode),
        maintenance_mode: Boolean(res.data.maintenance_mode),
      };
    }
  } catch { /* 后端不可用时回退默认 */ }
  return DEFAULT_CONFIG;
}

/** 保存站点开关到后端（管理员，全站统一生效） */
async function saveSiteConfig(config: SiteConfig): Promise<{ code: number; msg?: string }> {
  try {
    const res = await request<null>(SITE_CONFIG_API, { method: 'PUT', body: config });
    return { code: res.code, msg: res.msg };
  } catch (e) {
    return { code: 1, msg: e instanceof Error ? e.message : '保存失败' };
  }
}

let cachedSiteConfig: SiteConfig | null = null;

/** 调试模式是否开启（后端全站统一，带缓存） */
export async function isDebugModeEnabled(): Promise<boolean> {
  if (!cachedSiteConfig) {
    cachedSiteConfig = await fetchSiteConfig();
  }
  return cachedSiteConfig.debug_mode;
}

/** 维护模式是否开启（后端全站统一，带缓存） */
export async function isMaintenanceModeEnabled(): Promise<boolean> {
  if (!cachedSiteConfig) {
    cachedSiteConfig = await fetchSiteConfig();
  }
  return cachedSiteConfig.maintenance_mode;
}

/** 刷新站点开关缓存（保存后调用） */
export function refreshSiteConfigCache(config: SiteConfig): void {
  cachedSiteConfig = config;
}

export default function SiteSettings() {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const config = await fetchSiteConfig();
      refreshSiteConfigCache(config);
      form.setFieldsValue(config);
    })();
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
      const config: SiteConfig = {
        debug_mode: Boolean(values.debug_mode),
        maintenance_mode: Boolean(values.maintenance_mode),
      };
      const res = await saveSiteConfig(config);
      if (res.code === 0) {
        refreshSiteConfigCache(config);
        window.dispatchEvent(new Event('site-config-changed'));
        message.success('站点配置已保存，全站统一生效');
      } else {
        message.error(res.msg || '保存失败');
      }
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