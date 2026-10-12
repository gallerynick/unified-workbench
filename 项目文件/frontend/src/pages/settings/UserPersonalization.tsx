import { useState, useEffect } from 'react';
import {
  Card,
  Segmented,
  Button,
  Switch,
  Typography,
  message,
  Alert,
  Space,
} from 'antd';
import { BgColorsOutlined, SaveOutlined, FullscreenOutlined, MenuFoldOutlined } from '@ant-design/icons';
import { useTheme, type ThemeMode } from '../../contexts/ThemeContext';
import { getUserPreferences, updateUserPreferences } from '../../api/user-preferences';
import styles from './UserPersonalization.module.css';

const { Title, Paragraph } = Typography;

const THEME_OPTIONS: { label: string; value: ThemeMode }[] = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
  { label: '跟随系统', value: 'system' },
];

const ZOOM_OPTIONS = [
  { label: '80%', value: '80' },
  { label: '90%', value: '90' },
  { label: '标准 (100%)', value: '100' },
  { label: '110%', value: '110' },
  { label: '120%', value: '120' },
];

export default function UserPersonalization() {
  const { themeMode, setTheme } = useTheme();
  const [localTheme, setLocalTheme] = useState<ThemeMode>('system');
  const [localZoom, setLocalZoom] = useState<string>('100');
  const [localAutoCollapse, setLocalAutoCollapse] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await getUserPreferences();
        if (res.code === 0 && res.data) {
          setLocalTheme((res.data.theme_mode as ThemeMode) || 'system');
          setLocalZoom(res.data.page_zoom || '100');
          setLocalAutoCollapse(res.data.auto_collapse_sidebar ?? false);
        }
      } catch {
        // 忽略错误
      }
    })();
  }, []);

  useEffect(() => {
    setLocalTheme(themeMode);
  }, [themeMode]);

  const handleSave = () => {
    setSaving(true);
    void (async () => {
      try {
        setTheme(localTheme);
        await updateUserPreferences({
          page_zoom: localZoom,
          theme_mode: localTheme,
          auto_collapse_sidebar: localAutoCollapse,
        });
        // 广播偏好变更：MainLayout 监听后即时生效，无需刷新页面
        window.dispatchEvent(new CustomEvent('auto-collapse-changed', { detail: localAutoCollapse }));
        window.dispatchEvent(new CustomEvent('zoom-changed', { detail: localZoom }));
        window.dispatchEvent(new CustomEvent('theme-changed', { detail: localTheme }));
        message.success('个性化设置已保存');
      } catch {
        message.error('保存失败');
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>用户个性化</Title>
      </div>
      <Alert
        message="这些设置已保存至用户数据，换设备登录后会自动同步应用。"
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

      <Card
        title={
          <Space>
            <FullscreenOutlined />
            页面缩放
          </Space>
        }
      >
        <div style={{ marginBottom: 'var(--spacing-card-gap)' }}>
          <Segmented
            options={ZOOM_OPTIONS}
            value={localZoom}
            onChange={(val) => setLocalZoom(String(val))}
          />
        </div>

        <Paragraph type="secondary">
          调整页面整体缩放比例。
        </Paragraph>
      </Card>

      <Card
        title={
          <Space>
            <MenuFoldOutlined />
            自动折叠模块栏
          </Space>
        }
      >
        <div style={{ marginBottom: 'var(--spacing-card-gap)' }}>
          <Switch
            checked={localAutoCollapse}
            onChange={setLocalAutoCollapse}
            checkedChildren="开启"
            unCheckedChildren="关闭"
          />
        </div>

        <Paragraph type="secondary">
          开启后，点击侧边栏的模块跳转时，侧边栏会自动收起；关闭则保持展开状态不变。
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
