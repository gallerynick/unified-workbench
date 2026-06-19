import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, message, Space, Alert } from 'antd';
import { ReloadOutlined, SaveOutlined, PictureOutlined, FontSizeOutlined } from '@ant-design/icons';
import { useCustomization, saveAppSettings } from '../../hooks/useCustomization';
import { DEFAULT_CONFIG } from '../../types/customization';
import styles from './CustomizationSettings.module.css';

const { Title } = Typography;

export default function CustomizationSettings() {
  const customization = useCustomization();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    form.setFieldsValue({
      appName: customization.app.name,
      appShortName: customization.app.shortName,
      appDescription: customization.app.description,
      faviconUrl: customization.branding.favicon || '',
      logoExpandedUrl: customization.branding.logoExpanded || '',
      logoCollapsedUrl: customization.branding.logoCollapsed || '',
    });
  }, [customization, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      saveAppSettings({
        name: values.appName,
        description: values.appDescription,
      });
      message.success('设置已保存，刷新页面后生效');
    } catch {
      message.error('请检查输入');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = (field: string) => {
    const defaultValues: Record<string, string> = {
      appName: DEFAULT_CONFIG.app.name,
      appShortName: DEFAULT_CONFIG.app.shortName,
      appDescription: DEFAULT_CONFIG.app.description,
      faviconUrl: '',
      logoExpandedUrl: '',
      logoCollapsedUrl: '',
    };
    form.setFieldValue(field, defaultValues[field]);
    message.success('已重置为默认值');
  };

  return (
    <div className={styles.container}>
      <Title level={4}>客制化设置</Title>
      <Alert
        message="管理员专属"
        description="只有管理员可以修改客制化设置。修改后需刷新页面才能看到效果。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form form={form} layout="vertical">
        <Card title={<><FontSizeOutlined /> 应用信息</>} className={styles.card ?? ''}>
          <Form.Item label="应用名称" name="appName" rules={[{ required: true, message: '请输入应用名称' }]}>
            <Input placeholder="一站式工作台" suffix={<Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleReset('appName')}>重置</Button>} />
          </Form.Item>
          <Form.Item label="简短名称" name="appShortName" rules={[{ required: true, message: '请输入简短名称' }]}>
            <Input placeholder="工" suffix={<Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleReset('appShortName')}>重置</Button>} />
          </Form.Item>
          <Form.Item label="应用描述" name="appDescription">
            <Input.TextArea rows={2} placeholder="面向小团队的内网一体化协作与信息管理平台" />
            <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleReset('appDescription')}>重置为默认值</Button>
          </Form.Item>
        </Card>

        <Card title={<><PictureOutlined /> 品牌图标</>} className={styles.card ?? ''}>
          <Form.Item label="网页图标 (Favicon)" name="faviconUrl">
            <Input placeholder="https://example.com/favicon.ico 或 /custom/favicon.ico" suffix={<Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleReset('faviconUrl')}>重置</Button>} />
          </Form.Item>
          <Form.Item label="侧栏展开图标" name="logoExpandedUrl">
            <Input placeholder="https://example.com/logo.png 或 /custom/logo-expanded.png" suffix={<Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleReset('logoExpandedUrl')}>重置</Button>} />
          </Form.Item>
          <Form.Item label="侧栏收起图标" name="logoCollapsedUrl">
            <Input placeholder="https://example.com/icon.png 或 /custom/logo-collapsed.png" suffix={<Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleReset('logoCollapsedUrl')}>重置</Button>} />
          </Form.Item>
        </Card>

        <div className={styles.actions}>
          <Space>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
              保存设置
            </Button>
            <Button onClick={() => form.resetFields()}>
              全部重置
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );
}
