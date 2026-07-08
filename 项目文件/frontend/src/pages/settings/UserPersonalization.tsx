import { useState, useEffect } from 'react';
import { Card, Segmented, Button, Typography, message, Alert, Space } from 'antd';
import { BgColorsOutlined, SaveOutlined } from '@ant-design/icons';
import { useTheme, type ThemeMode } from '../../contexts/ThemeContext';
import styles from './UserPersonalization.module.css';

const { Title, Paragraph } = Typography;

const THEME_OPTIONS: { label: string; value: ThemeMode }[] = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
  { label: '跟随系统', value: 'system' },
];

export default function UserPersonalization() {
  const { themeMode, setTheme } = useTheme();
  const [localTheme, setLocalTheme] = useState<ThemeMode>(themeMode);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalTheme(themeMode);
  }, [themeMode]);

  const handleSave = () => {
    setSaving(true);
    try {
      setTheme(localTheme);
      message.success('个性化设置已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>用户个性化</Title>
      </div>
      <Alert
        message="这些设置仅影响当前浏览器，不会同步到其他设备或其他用户。"
        type="info"
        showIcon
      />

      <Card
        title={
          <Space>
            <BgColorsOutlined />
            主题设置
          </Space>
        }
      >
        <div style={{ marginBottom: 'var(--spacing-card-gap)' }}>
          <Segmented
            options={THEME_OPTIONS}
            value={localTheme}
            onChange={(val) => setLocalTheme(val as ThemeMode)}
          />
        </div>

        <Paragraph type="secondary">
          选择主题颜色模式。"跟随系统"将根据操作系统设置自动切换深色/浅色主题。
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
