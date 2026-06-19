import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, message, Space, Alert, Result, Upload, Radio } from 'antd';
import { ReloadOutlined, SaveOutlined, PictureOutlined, FontSizeOutlined, LockOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { useCustomization, saveAppSettings } from '../../hooks/useCustomization';
import { DEFAULT_CONFIG } from '../../types/customization';
import { isAdmin } from '../../utils/auth';
import styles from './CustomizationSettings.module.css';

const { Title, Text } = Typography;

const UPLOAD_RULES = {
  maxSize: 2 * 1024 * 1024,
  maxFaviconSize: 512 * 1024,
  allowedTypes: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/x-icon'],
  faviconTypes: ['image/png', 'image/x-icon', 'image/svg+xml'],
  maxDimensions: { width: 512, height: 512 },
  faviconDimensions: { width: 32, height: 32 },
};

function getBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

function validateImage(file: File, isFavicon: boolean): string | null {
  const allowedTypes = isFavicon ? UPLOAD_RULES.faviconTypes : UPLOAD_RULES.allowedTypes;
  if (!allowedTypes.includes(file.type)) {
    return `不支持的格式: ${file.type}。请使用 PNG、JPEG 或 SVG`;
  }

  const maxSize = isFavicon ? UPLOAD_RULES.maxFaviconSize : UPLOAD_RULES.maxSize;
  if (file.size > maxSize) {
    const maxMB = maxSize / 1024 / 1024;
    return `文件过大: ${(file.size / 1024 / 1024).toFixed(1)}MB。最大允许 ${maxMB}MB`;
  }

  return null;
}

function checkImageDimensions(file: File, isFavicon: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    if (file.type === 'image/svg+xml') {
      resolve(null);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const limits = isFavicon ? UPLOAD_RULES.faviconDimensions : UPLOAD_RULES.maxDimensions;
      if (isFavicon) {
        if (img.width !== limits.width || img.height !== limits.height) {
          resolve(`尺寸不符: ${img.width}x${img.height}。Favicon 要求 ${limits.width}x${limits.height} 像素`);
        }
      } else {
        if (img.width > limits.width || img.height > limits.height) {
          resolve(`尺寸过大: ${img.width}x${img.height}。最大允许 ${limits.width}x${limits.height} 像素`);
        }
      }
      resolve(null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('无法读取图片尺寸');
    };
    img.src = url;
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
      displayMode: customization.branding.displayMode,
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
        subTitle="只有管理员可以访问应用配置"
        icon={<LockOutlined />}
      />
    );
  }

  const handleUpload = async (file: File, setter: React.Dispatch<React.SetStateAction<UploadFile[]>>, isFavicon: boolean) => {
    const error = validateImage(file, isFavicon);
    if (error) {
      message.error(error);
      return false;
    }

    const dimError = await checkImageDimensions(file, isFavicon);
    if (dimError) {
      message.error(dimError);
      return false;
    }

    try {
      const base64 = await getBase64(file);
      setter([{ uid: Date.now().toString(), name: file.name, status: 'done', url: base64 }]);
    } catch {
      message.error('文件读取失败');
    }
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
        displayMode: values.displayMode,
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

  const renderUploadItem = (
    label: string,
    files: UploadFile[],
    setter: React.Dispatch<React.SetStateAction<UploadFile[]>>,
    isFavicon: boolean,
    description: string,
  ) => (
    <Form.Item label={label}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
        {description}
      </Text>
      <Upload
        listType="picture-card"
        maxCount={1}
        accept="image/*"
        fileList={files}
        beforeUpload={(file) => handleUpload(file, setter, isFavicon)}
        onRemove={() => handleRemove(setter)}
      >
        {files.length === 0 && (
          <div>
            <PlusOutlined />
            <div style={{ marginTop: 8 }}>上传</div>
          </div>
        )}
      </Upload>
      {files.length > 0 && (
        <Button type="link" size="small" icon={<DeleteOutlined />} onClick={() => handleRemove(setter)}>
          清除
        </Button>
      )}
    </Form.Item>
  );

  return (
    <div className={styles.container}>
      <Title level={4}>应用配置</Title>
      <Alert
        message="管理员专属"
        description="只有管理员可以修改应用配置。修改后需刷新页面才能看到效果。"
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
          {renderUploadItem(
            '网页图标 (Favicon)',
            faviconFile,
            setFaviconFile,
            true,
            '格式: PNG/ICO/SVG | 尺寸: 32x32 像素 | 大小: ≤ 512KB',
          )}
          {renderUploadItem(
            '侧栏展开图标',
            logoExpandedFile,
            setLogoExpandedFile,
            false,
            '格式: PNG/JPEG/SVG | 建议尺寸: 高度 32px | 大小: ≤ 2MB',
          )}
          {renderUploadItem(
            '侧栏收起图标',
            logoCollapsedFile,
            setLogoCollapsedFile,
            false,
            '格式: PNG/JPEG/SVG | 建议尺寸: 32x32 像素 | 大小: ≤ 2MB',
          )}

          <Form.Item label="侧栏展示模式" name="displayMode">
            <Radio.Group>
              <Radio.Button value="icon">只显示图标</Radio.Button>
              <Radio.Button value="text">只显示文字</Radio.Button>
              <Radio.Button value="both">图标+文字</Radio.Button>
            </Radio.Group>
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
