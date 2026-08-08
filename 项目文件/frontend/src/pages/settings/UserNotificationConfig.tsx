import { useEffect, useState } from 'react';
import { Card, Input, Switch, Button, Typography, message, Space, Form, Alert } from 'antd';
import { SaveOutlined, SendOutlined } from '@ant-design/icons';
import { getNotificationConfig, updateNotificationConfig } from '../../api/auth';
import { DEFAULT_CHANNELS } from '../../constants/channels';
import { request } from '../../utils/request';
import type { UserNotificationConfig as UserNotificationConfigType } from '../../types/user';
import styles from './UserNotificationConfig.module.css';

const { Title, Text } = Typography;

const FEISHU_CHANNEL = 'feishu';
const WECOM_CHANNEL = 'wecom';
const EMAIL_CHANNEL = 'email';

export default function UserNotificationConfig() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await getNotificationConfig();
      if (res.code === 0) {
        const value = res.data;
        const enabledIds = value.enabled_channels ?? [];
        form.setFieldsValue({
          feishu_enabled: enabledIds.includes(FEISHU_CHANNEL),
          feishu_webhook_url: value.feishu_webhook_url ?? '',
          wecom_enabled: enabledIds.includes(WECOM_CHANNEL),
          wecom_webhook_url: value.wecom_webhook_url ?? '',
          email_enabled: value.email_enabled,
          smtp_host: value.smtp_host ?? '',
          smtp_port: value.smtp_port ?? 587,
          smtp_user: value.smtp_user ?? '',
          smtp_password: value.smtp_password ?? '',
          smtp_use_tls: value.smtp_use_tls,
        });
      }
    } catch {
      // 静默失败，使用默认值
    } finally {
      setLoading(false);
    }
  };

  const testChannel = async (channel: string) => {
    try {
      const res = await request<{ code: number; msg: string }>('/system/test-notification', {
        method: 'POST',
        body: { channel },
      });
      if (res.code === 0) {
        message.success(res.msg || `${channel} 测试成功`);
      } else {
        message.error(res.msg || `${channel} 测试失败`);
      }
    } catch {
      message.error(`${channel} 测试请求失败`);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const enabledChannels: string[] = [...DEFAULT_CHANNELS];
      if (values.feishu_enabled) enabledChannels.push(FEISHU_CHANNEL);
      if (values.wecom_enabled) enabledChannels.push(WECOM_CHANNEL);
      if (values.email_enabled) enabledChannels.push(EMAIL_CHANNEL);

      const configValue: Partial<UserNotificationConfigType> = {
        enabled_channels: enabledChannels,
        feishu_webhook_url: (values.feishu_webhook_url as string) || null,
        wecom_webhook_url: (values.wecom_webhook_url as string) || null,
        email_enabled: values.email_enabled as boolean,
        smtp_host: (values.smtp_host as string) || null,
        smtp_port: values.smtp_port ? Number(values.smtp_port) : null,
        smtp_user: (values.smtp_user as string) || null,
        smtp_password: (values.smtp_password as string) || null,
        smtp_use_tls: values.smtp_use_tls as boolean,
      };

      const res = await updateNotificationConfig(configValue);
      if (res.code === 0) {
        message.success('通知配置已保存');
      } else {
        message.error(res.msg || '保存失败');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>
          通知配置
        </Title>
      </div>

      <Alert
        message="站内通知始终启用，无需配置。下方渠道开启后，提醒和通知将通过所选渠道推送给您。"
        type="info"
        showIcon
      />

      <Form
        form={form}
        layout="vertical"
        className={styles.form ?? ''}
        initialValues={{
          feishu_enabled: false,
          feishu_webhook_url: '',
          wecom_enabled: false,
          wecom_webhook_url: '',
          email_enabled: false,
          smtp_host: '',
          smtp_port: 587,
          smtp_user: '',
          smtp_password: '',
          smtp_use_tls: true,
        }}
      >
        <Card loading={loading} className={styles.card ?? ''}>
          <div className={styles.channelSection ?? ''}>
            <div className={styles.channelHeader ?? ''}>
              <Text strong>飞书通知</Text>
              <div className={styles.headerActions ?? ''}>
                <Form.Item name="feishu_enabled" valuePropName="checked" noStyle>
                  <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                </Form.Item>
                <Button size="small" icon={<SendOutlined />} onClick={() => testChannel(FEISHU_CHANNEL)}>
                  测试
                </Button>
              </div>
            </div>
            <Form.Item
              name="feishu_webhook_url"
              label="Webhook URL"
              rules={[{ type: 'url', message: '请输入有效的 URL' }]}
            >
              <Input placeholder="请输入飞书 Webhook URL" />
            </Form.Item>
          </div>
        </Card>

        <Card loading={loading} className={styles.card ?? ''}>
          <div className={styles.channelSection ?? ''}>
            <div className={styles.channelHeader ?? ''}>
              <Text strong>企业微信通知</Text>
              <div className={styles.headerActions ?? ''}>
                <Form.Item name="wecom_enabled" valuePropName="checked" noStyle>
                  <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                </Form.Item>
                <Button size="small" icon={<SendOutlined />} onClick={() => testChannel(WECOM_CHANNEL)}>
                  测试
                </Button>
              </div>
            </div>
            <Form.Item
              name="wecom_webhook_url"
              label="Webhook URL"
              rules={[{ type: 'url', message: '请输入有效的 URL' }]}
            >
              <Input placeholder="请输入企业微信 Webhook URL" />
            </Form.Item>
          </div>
        </Card>

        <Card loading={loading} className={styles.card ?? ''}>
          <div className={styles.channelSection ?? ''}>
            <div className={styles.channelHeader ?? ''}>
              <Text strong>邮件通知</Text>
              <div className={styles.headerActions ?? ''}>
                <Form.Item name="email_enabled" valuePropName="checked" noStyle>
                  <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                </Form.Item>
                <Button size="small" icon={<SendOutlined />} onClick={() => testChannel(EMAIL_CHANNEL)}>
                  测试
                </Button>
              </div>
            </div>
            <Form.Item name="smtp_host" label="SMTP 服务器">
              <Input placeholder="请输入 SMTP 服务器地址" />
            </Form.Item>
            <Form.Item name="smtp_port" label="端口">
              <Input type="number" placeholder="587" />
            </Form.Item>
            <Form.Item name="smtp_user" label="用户名">
              <Input placeholder="请输入 SMTP 用户名" />
            </Form.Item>
            <Form.Item name="smtp_password" label="密码">
              <Input.Password placeholder="请输入 SMTP 密码" />
            </Form.Item>
            <Form.Item name="smtp_use_tls" label="使用 TLS" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </Card>

        <div className={styles.footer ?? ''}>
          <Space>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
              保存配置
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );
}
