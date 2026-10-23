import { useState, useEffect } from 'react';
import { Card, Segmented, Button, Checkbox, Typography, message, Alert, Space } from 'antd';
import Switch from '@/components/AppSwitch';
import {
  BgColorsOutlined,
  SaveOutlined,
  FullscreenOutlined,
  MenuFoldOutlined,
  AppstoreOutlined,
  ColumnHeightOutlined,
} from '@ant-design/icons';
import { useTheme, type ThemeMode } from '../../contexts/ThemeContext';
import { getUserPreferences, updateUserPreferences } from '../../api/user-preferences';
import {
  ALL_SIDEBAR_ITEM_KEYS,
  MANDATORY_ITEM_KEYS,
  SIDEBAR_CATEGORIES,
  TOP_LEVEL_ITEMS,
  type SidebarDensity,
} from '../../config/sidebarConfig';
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
  /** 侧栏显示项；默认全选 */
  const [localVisibleItems, setLocalVisibleItems] = useState<string[]>(ALL_SIDEBAR_ITEM_KEYS);
  const [localDensity, setLocalDensity] = useState<SidebarDensity>('comfortable');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await getUserPreferences();
        if (res.code === 0 && res.data) {
          setLocalTheme((res.data.theme_mode as ThemeMode) || 'system');
          setLocalZoom(res.data.page_zoom || '100');
          setLocalAutoCollapse(res.data.auto_collapse_sidebar ?? false);
          // 强制项（首页）始终并入，兼容历史上被取消勾选的数据
          setLocalVisibleItems(
            Array.isArray(res.data.sidebar_visible_items)
              ? [...new Set([...res.data.sidebar_visible_items, ...MANDATORY_ITEM_KEYS])]
              : ALL_SIDEBAR_ITEM_KEYS,
          );
          setLocalDensity(
            res.data.sidebar_density === 'compact' ? 'compact' : 'comfortable',
          );
        }
      } catch {
        // 忽略错误
      }
    })();
  }, []);

  useEffect(() => {
    setLocalTheme(themeMode);
  }, [themeMode]);

  /**
   * 勾选/取消侧栏显示项。
   * 强制项（首页）不可取消——它是回到工作台起点的唯一入口。
   */
  const toggleVisibleItem = (key: string) => {
    if (MANDATORY_ITEM_KEYS.includes(key)) {
      message.info('首页固定显示，不能隐藏');
      return;
    }
    if (localVisibleItems.includes(key)) {
      setLocalVisibleItems(localVisibleItems.filter((k) => k !== key));
      return;
    }
    // 保持侧栏原有顺序，避免勾选顺序决定展示顺序
    setLocalVisibleItems(
      ALL_SIDEBAR_ITEM_KEYS.filter((k) => localVisibleItems.includes(k) || k === key),
    );
  };

  const handleSave = () => {
    setSaving(true);
    void (async () => {
      try {
        setTheme(localTheme);
        await updateUserPreferences({
          page_zoom: localZoom,
          theme_mode: localTheme,
          auto_collapse_sidebar: localAutoCollapse,
          // 保存前再兜一次强制项，避免异常状态把首页写没
          sidebar_visible_items: [
            ...new Set([...localVisibleItems, ...MANDATORY_ITEM_KEYS]),
          ],
          sidebar_density: localDensity,
        });
        // 广播偏好变更：MainLayout 监听后即时生效，无需刷新页面
        window.dispatchEvent(new CustomEvent('auto-collapse-changed', { detail: localAutoCollapse }));
        window.dispatchEvent(
          new CustomEvent('sidebar-prefs-changed', {
            detail: {
              visible_items: localVisibleItems,
              density: localDensity,
            },
          }),
        );
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

      <Card
        title={
          <Space>
            <AppstoreOutlined />
            侧栏显示项
          </Space>
        }
      >
        <div style={{ marginBottom: 'var(--spacing-card-gap)' }}>
          <Space wrap>
            <Button  onClick={() => setLocalVisibleItems(ALL_SIDEBAR_ITEM_KEYS)}>
              全部显示
            </Button>
            <Button
              onClick={() => setLocalVisibleItems(['/'])}
            >
              仅保留首页
            </Button>
          </Space>
        </div>

        {/* 顶部常驻项：不属于任何类别，单独一组；首页固定显示不可取消 */}
        <div className={styles.itemGroup ?? ''}>
          <div className={styles.itemGroupLabel ?? ''}>顶部常驻（不分类别）</div>
          <Space wrap size={[16, 8]}>
            {TOP_LEVEL_ITEMS.map((item) => {
              const mandatory = MANDATORY_ITEM_KEYS.includes(item.key);
              return (
                <Checkbox
                  key={item.key}
                  checked={mandatory || localVisibleItems.includes(item.key)}
                  disabled={mandatory}
                  onChange={() => toggleVisibleItem(item.key)}
                >
                  {item.label}
                  {mandatory && '（固定显示）'}
                </Checkbox>
              );
            })}
          </Space>
        </div>

        {SIDEBAR_CATEGORIES.map((cat) => (
          <div key={cat.key} className={styles.itemGroup ?? ''}>
            <div className={styles.itemGroupLabel ?? ''}>{cat.label}</div>
            <Space wrap size={[16, 8]}>
              {cat.items.map((item) => (
                <Checkbox
                  key={item.key}
                  checked={localVisibleItems.includes(item.key)}
                  onChange={() => toggleVisibleItem(item.key)}
                >
                  {item.label}
                </Checkbox>
              ))}
            </Space>
          </div>
        ))}

        <Paragraph type="secondary" style={{ marginTop: 'var(--spacing-card-gap)' }}>
          未勾选的项目不在侧边栏显示；随时可以在这里重新勾选找回。首页固定显示，不可取消。
        </Paragraph>
      </Card>

      <Card
        title={
          <Space>
            <ColumnHeightOutlined />
            侧栏显示密度
          </Space>
        }
      >
        <div style={{ marginBottom: 'var(--spacing-card-gap)' }}>
          <Segmented
            options={[
              { label: '舒适', value: 'comfortable' },
              { label: '紧凑', value: 'compact' },
            ]}
            value={localDensity}
            onChange={(val) => setLocalDensity(val as SidebarDensity)}
          />
        </div>

        <Paragraph type="secondary">
          紧凑密度会降低每个菜单项的行高，一屏可看到更多模块。
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
