import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Slider,
  Button,
  Switch,
  Typography,
  Space,
  message,
  Modal,
  Tooltip,
  Spin,
} from 'antd';
import {
  ReloadOutlined,
  CopyOutlined,
  ExclamationCircleOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import {
  getStreamConfig,
  updateStreamConfig,
  getStreamKey,
  resetStreamKey,
} from '../../api/stream';
import styles from './StreamSettings.module.css';

const { Title, Text } = Typography;

const RESOLUTION_OPTIONS = [
  { label: '1920×1080 (1080p)', value: '1920x1080' },
  { label: '1280×720 (720p)', value: '1280x720' },
  { label: '854×480 (480p)', value: '854x480' },
  { label: '640×360 (360p)', value: '640x360' },
];

const FPS_OPTIONS = [
  { label: '60 fps', value: 60 },
  { label: '30 fps', value: 30 },
  { label: '25 fps', value: 25 },
  { label: '15 fps', value: 15 },
];

export default function StreamSettings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [streamKey, setStreamKey] = useState('');
  const [pushUrl, setPushUrl] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, keyRes] = await Promise.all([
        getStreamConfig(),
        getStreamKey(),
      ]);
      if (configRes.code === 0 && configRes.data) {
        form.setFieldsValue(configRes.data);
      }
      if (keyRes.code === 0 && keyRes.data) {
        setStreamKey(keyRes.data.stream_key);
        setPushUrl(keyRes.data.push_url);
      }
    } catch {
      message.error('加载推流配置失败');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await updateStreamConfig(values);
      if (res.code === 0) {
        message.success(res.msg || '推流配置已更新');
        if (res.data) {
          form.setFieldsValue(res.data);
        }
      }
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleResetKey = () => {
    Modal.confirm({
      title: '重置推流密钥',
      icon: <ExclamationCircleOutlined />,
      content: '重置后旧的推流密钥将立即失效，正在进行的推流将被中断。确定要继续吗？',
      okText: '确认重置',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await resetStreamKey();
          if (res.code === 0 && res.data) {
            setStreamKey(res.data.stream_key);
            setPushUrl(res.data.push_url);
            message.success(res.msg || '推流密钥已重置');
          }
        } catch {
          message.error('重置失败');
        }
      },
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => message.success(`${label}已复制到剪贴板`),
      () => message.error('复制失败'),
    );
  };

  const minBitrate = Form.useWatch('min_bitrate', form) ?? 500;
  const maxBitrate = Form.useWatch('max_bitrate', form) ?? 10000;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className={styles.container ?? ''}>
      <Title level={4}>
        <VideoCameraOutlined style={{ marginRight: 8 }} />
        推流配置
      </Title>

      <Card title="服务器设置" className={styles.formCard ?? ''}>
        <Form form={form} layout="vertical">
          <Form.Item
            name="server_url"
            label="推流服务器地址"
            rules={[{ required: true, message: '请输入推流服务器地址' }]}
          >
            <Input placeholder="rtmp://localhost:1935/live" />
          </Form.Item>

          <Form.Item
            name="server_port"
            label="服务器端口"
            rules={[{ required: true, message: '请输入服务器端口' }]}
          >
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="enable_auth" label="启用推流认证" valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>
        </Form>
      </Card>

      <Card title="编码参数" className={styles.formCard ?? ''}>
        <Form form={form} layout="vertical">
          <Form.Item
            name="default_resolution"
            label="默认分辨率"
            rules={[{ required: true, message: '请选择默认分辨率' }]}
          >
            <Select options={RESOLUTION_OPTIONS} />
          </Form.Item>

          <Form.Item
            name="default_fps"
            label="默认帧率"
            rules={[{ required: true, message: '请选择默认帧率' }]}
          >
            <Select options={FPS_OPTIONS} />
          </Form.Item>

          <Form.Item label="码率范围 (kbps)">
            <Space style={{ width: '100%' }} align="start">
              <Form.Item name="min_bitrate" noStyle rules={[{ required: true }]}>
                <InputNumber min={100} max={maxBitrate - 100} placeholder="最小" addonAfter="kbps" />
              </Form.Item>
              <Text style={{ lineHeight: '32px' }}>—</Text>
              <Form.Item name="max_bitrate" noStyle rules={[{ required: true }]}>
                <InputNumber min={minBitrate + 100} max={50000} placeholder="最大" addonAfter="kbps" />
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item name="default_bitrate" label="默认码率 (kbps)">
            <Slider
              min={minBitrate}
              max={maxBitrate}
              step={100}
              marks={{
                [minBitrate]: `${minBitrate}`,
                [Math.round((minBitrate + maxBitrate) / 2)]: `${Math.round((minBitrate + maxBitrate) / 2)}`,
                [maxBitrate]: `${maxBitrate}`,
              }}
            />
          </Form.Item>
        </Form>
      </Card>

      <div style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={handleSave} loading={saving}>
          保存配置
        </Button>
      </div>

      <Card title="推流密钥" className={styles.formCard ?? ''}>
        <div className={styles.keySection ?? ''}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            推流密钥用于身份验证，请勿泄露给他人。如怀疑泄露，请立即重置。
          </Text>

          <div className={styles.keyRow ?? ''}>
            <Input.Password
              className={styles.keyInput ?? ''}
              value={streamKey}
              readOnly
            />
            <Tooltip title="复制密钥">
              <Button
                icon={<CopyOutlined />}
                onClick={() => copyToClipboard(streamKey, '推流密钥')}
              />
            </Tooltip>
            <Button
              danger
              icon={<ReloadOutlined />}
              onClick={handleResetKey}
            >
              重置
            </Button>
          </div>

          <div style={{ marginTop: 16 }}>
            <Text strong>推流地址：</Text>
            <div className={styles.keyRow ?? ''} style={{ marginTop: 4 }}>
              <Input.TextArea
                className={styles.pushUrl ?? ''}
                value={pushUrl}
                readOnly
                autoSize={{ minRows: 1, maxRows: 2 }}
              />
              <Tooltip title="复制推流地址">
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => copyToClipboard(pushUrl, '推流地址')}
                />
              </Tooltip>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
