import { useState, useEffect } from 'react';
import { Card, Switch, Button, Typography, message, Alert, Space } from 'antd';
import { BgColorsOutlined, SaveOutlined } from '@ant-design/icons';
import { useTheme } from '../../contexts/ThemeContext';

const { Title, Paragraph, Text } = Typography;

export default function UserPersonalization() {
  const { isDark, setDark } = useTheme();
  const [localDark, setLocalDark] = useState(isDark);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalDark(isDark);
  }, [isDark]);

  const handleSave = () => {
    setSaving(true);
    try {
      setDark(localDark);
      message.success('个性化设置已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <Title level={4} style={{ fontWeight: 600, margin: 0 }}>用户个性化</Title>
      <Alert
        message="这些设置仅影响当前浏览器，不会同步到其他设备或其他用户。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card
        title={
          <Space>
            <BgColorsOutlined />
            主题设置
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <div style={{ marginBottom: 16 }}>
          <Switch
            checked={localDark}
            onChange={setLocalDark}
          />
          <Text style={{ marginLeft: 8 }}>
            {localDark ? '深色主题' : '浅色主题'}
          </Text>
        </div>

        <Paragraph type="secondary">
          切换主题颜色模式。深色主题适合低光环境使用。
        </Paragraph>
      </Card>

      <Space>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={handleSave}
        >
          保存设置
        </Button>
      </Space>
    </div>
  );
}
