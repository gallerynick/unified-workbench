import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, message, Space, Alert, Result, Upload } from 'antd';
import { ReloadOutlined, SaveOutlined, PictureOutlined, FontSizeOutlined, LockOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import { useCustomization, saveAppSettings } from '../../hooks/useCustomization';
import { DEFAULT_CONFIG } from '../../types/customization';
import { isAdmin } from '../../utils/auth';
import styles from './CustomizationSettings.module.css';

const { Title } = Typography;

function getBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

export default function CustomizationSettings() {
  const customization = useCustomization();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [faviconFile, setFaviconFile] = useState<UploadFile[]>([]);
  const [logoExpandedFile, setLogoExpandedFile] = useState<UploadFile[]>([]);
  const [logoCollapsedFile, setLogoCollapsedFile] = useState<UploadFile[]>([]);

  useEffect(() => {
    form.setFieldsValue({
      appName: customization.app.name,
      appShortName: customization.app.shortName,
      appDescription: customization.app.description,
    });

    if (customization.branding.favicon) {
      setFaviconFile([{ uid: '-1', name: 'favicon', status: 'done', url: customization.branding.favicon }]);
    }
    if (customization.branding.logoExpanded) {
      setLogoExpandedFile([{ uid: '-2', name: 'logo-expanded', status: 'done', url: customization.branding.logoExpanded }]);
    }
    if (customization.branding.logoCollapsed) {
      setLogoCollapsedFile([{ uid: '-3', name: 'logo-collapsed', status: 'done', url: customization.branding.logoCollapsed }]);
    }
  }, [customization, form]);

  if (!isAdmin()) {
    return (
      <Result
        status="403"
        title="权限不足"
        subTitle="只有管理员可以访问客制化设置"
        icon={<LockOutlined />}
      />
    );
  }

  const handleUpload = async (file: File, setter: React.Dispatch<React.SetStateAction<UploadFile[]>>) => {
    const base64 = await getBase64(file);
    setter([{ uid: Date.now().toString(), name: file.name, status: 'done', url: base64 }]);
    return false;
  };

  const handleRemove = (setter: React.Dispatch<React.SetStateAction<UploadFile[]>>) => {
    setter([]);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      saveAppSettings({
        name: values.appName,
        shortName: values.appShortName,
        description: values.appDescription,
        favicon: faviconFile[0]?.url || '',
        logoExpanded: logoExpandedFile[0]?.url || '',
        logoCollapsed: logoCollapsedFile[0]?.url || '',
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
    };
    form.setFieldValue(field, defaultValues[field]);
    message.success('已重置为默认值');
  };

  const handleResetAll = () => {
    form.resetFields();
    setFaviconFile([]);
    setLogoExpandedFile([]);
    setLogoCollapsedFile([]);
    message.success('已全部重置');
  };

  const uploadProps: UploadProps = {
    beforeUpload: () => false,
    listType: 'picture-card',
    maxCount: 1,
    accept: 'image/*',
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
          <Form.Item label="网页图标 (Favicon)">
            <Upload
              {...uploadProps}
              fileList={faviconFile}
              beforeUpload={(file) => handleUpload(file, setFaviconFile)}
              onRemove={() => handleRemove(setFaviconFile)}
            >
              {faviconFile.length === 0 && (
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>上传</div>
                </div>
              )}
            </Upload>
            <Button type="link" size="small" icon={<DeleteOutlined />} onClick={() => handleRemove(setFaviconFile)}>清除</Button>
          </Form.Item>
          <Form.Item label="侧栏展开图标">
            <Upload
              {...uploadProps}
              fileList={logoExpandedFile}
              beforeUpload={(file) => handleUpload(file, setLogoExpandedFile)}
              onRemove={() => handleRemove(setLogoExpandedFile)}
            >
              {logoExpandedFile.length === 0 && (
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>上传</div>
                </div>
              )}
            </Upload>
            <Button type="link" size="small" icon={<DeleteOutlined />} onClick={() => handleRemove(setLogoExpandedFile)}>清除</Button>
          </Form.Item>
          <Form.Item label="侧栏收起图标">
            <Upload
              {...uploadProps}
              fileList={logoCollapsedFile}
              beforeUpload={(file) => handleUpload(file, setLogoCollapsedFile)}
              onRemove={() => handleRemove(setLogoCollapsedFile)}
            >
              {logoCollapsedFile.length === 0 && (
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>上传</div>
                </div>
              )}
            </Upload>
            <Button type="link" size="small" icon={<DeleteOutlined />} onClick={() => handleRemove(setLogoCollapsedFile)}>清除</Button>
          </Form.Item>
        </Card>

        <div className={styles.actions}>
          <Space>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
              保存设置
            </Button>
            <Button onClick={handleResetAll}>
              全部重置
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );
}
