import { useEffect, useState } from 'react';
import { Form, Input, Switch, Button, Typography, Card, message, Space } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { getConfig, updateConfig } from '../../api/system_config';
import type { NotificationConfig as NotificationConfigType } from '../../types/system_config';
import styles from './NotificationConfig.module.css';

const { Title, Text } = Typography;

export default function NotificationConfig() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await getConfig('notification');
        if (res.code === 0) {
          const value = res.data.value as unknown as NotificationConfigType;
          form.setFieldsValue({
            feishu_webhook_url: value.feishu_webhook_url ?? '',
            dingtalk_webhook_url: value.dingtalk_webhook_url ?? '',
            feishu_enabled: value.enabled_channels?.includes('feishu') ?? false,
            dingtalk_enabled: value.enabled_channels?.includes('dingtalk') ?? false,
            email_enabled: value.enabled_channels?.includes('email') ?? false,
            smtp_host: value.smtp_host ?? '',
            smtp_port: value.smtp_port ?? 587,
            smtp_user: value.smtp_user ?? '',
            smtp_password: value.smtp_password ?? '',
            smtp_use_tls: value.smtp_use_tls ?? true,
            wecom_enabled: value.enabled_channels?.includes('wecom') ?? false,
            wecom_webhook_url: value.wecom_webhook_url ?? '',
          });
        }
    } catch {
      // 静默失败，使用默认值
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const enabledChannels: string[] = ['websocket'];
      if (values.feishu_enabled) enabledChannels.push('feishu');
      if (values.dingtalk_enabled) enabledChannels.push('dingtalk');
      if (values.email_enabled) enabledChannels.push('email');
      if (values.wecom_enabled) enabledChannels.push('wecom');

      const configValue: NotificationConfigType = {
        feishu_webhook_url: values.feishu_webhook_url as string,
        dingtalk_webhook_url: values.dingtalk_webhook_url as string,
        enabled_channels: enabledChannels,
        smtp_host: values.smtp_host as string,
        smtp_port: values.smtp_port as number,
        smtp_user: values.smtp_user as string,
        smtp_password: values.smtp_password as string,
        smtp_use_tls: values.smtp_use_tls as boolean,
        wecom_webhook_url: values.wecom_webhook_url as string,
      };

      const res = await updateConfig('notification', configValue as unknown as Record<string, unknown>);
      if (res.code === 0) {
        message.success('通知配置保存成功');
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

      <Form
        form={form}
        layout="vertical"
        className={styles.form ?? ''}
        initialValues={{
          feishu_webhook_url: '',
          dingtalk_webhook_url: '',
          feishu_enabled: false,
          dingtalk_enabled: false,
          email_enabled: false,
          smtp_host: '',
          smtp_port: 587,
          smtp_user: '',
          smtp_password: '',
          smtp_use_tls: true,
          wecom_enabled: false,
          wecom_webhook_url: '',
        }}
      >
        <Card loading={loading} className={styles.card ?? ''}>
          <div className={styles.channelSection ?? ''}>
            <div className={styles.channelHeader ?? ''}>
              <Text strong>飞书通知</Text>
              <Form.Item name="feishu_enabled" valuePropName="checked" noStyle>
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
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
              <Text strong>钉钉通知</Text>
              <Form.Item name="dingtalk_enabled" valuePropName="checked" noStyle>
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </div>
            <Form.Item
              name="dingtalk_webhook_url"
              label="Webhook URL"
              rules={[{ type: 'url', message: '请输入有效的 URL' }]}
            >
              <Input placeholder="请输入钉钉 Webhook URL" />
            </Form.Item>
          </div>
        </Card>

        <Card loading={loading} className={styles.card ?? ''}>
          <div className={styles.channelSection ?? ''}>
            <div className={styles.channelHeader ?? ''}>
              <Text strong>邮件通知</Text>
              <Form.Item name="email_enabled" valuePropName="checked" noStyle>
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
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

        <Card loading={loading} className={styles.card ?? ''}>
          <div className={styles.channelSection ?? ''}>
            <div className={styles.channelHeader ?? ''}>
              <Text strong>企业微信通知</Text>
              <Form.Item name="wecom_enabled" valuePropName="checked" noStyle>
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
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

        <div className={styles.footer ?? ''}>
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
            >
              保存配置
            </Button>
            <Button onClick={fetchConfig}>
              重置
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );
}
