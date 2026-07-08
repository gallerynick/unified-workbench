import { useState, useEffect } from 'react';
import { Card, Button, Typography, message, Space, Switch, List, Modal, Input, Alert, Form, Result } from 'antd';
import { PlusOutlined, DeleteOutlined, LockOutlined, MenuOutlined } from '@ant-design/icons';
import { isAdmin } from '../../utils/auth';
import styles from './SidebarManagement.module.css';

const { Title, Text } = Typography;

const SIDEBAR_CONFIG_KEY = 'sidebar_config';

interface SidebarItem {
  key: string;
  label: string;
  icon?: string;
  visible: boolean;
  hasData: boolean;
  builtin: boolean;
}

const DEFAULT_ITEMS: SidebarItem[] = [
  { key: '/', label: '首页', icon: 'HomeOutlined', visible: true, hasData: false, builtin: true },
  { key: '/tasks', label: '任务中心', icon: 'CheckSquareOutlined', visible: true, hasData: false, builtin: true },
  { key: '/contacts', label: '联系人管理', icon: 'ContactsOutlined', visible: true, hasData: false, builtin: true },
  { key: '/calendar', label: '日程日历', icon: 'CalendarOutlined', visible: true, hasData: false, builtin: true },
  { key: '/votes', label: '投票决策', icon: 'LikeOutlined', visible: true, hasData: false, builtin: true },
  { key: '/forms', label: '表单收集', icon: 'FormOutlined', visible: true, hasData: false, builtin: true },
  { key: '/members', label: '成员目录', icon: 'TeamOutlined', visible: true, hasData: false, builtin: true },
  { key: '/announcements', label: '公告通知', icon: 'SoundOutlined', visible: true, hasData: false, builtin: true },
  { key: '/notes', label: '笔记知识库', icon: 'BookOutlined', visible: true, hasData: false, builtin: true },
  { key: '/files', label: '文件中心', icon: 'FileOutlined', visible: true, hasData: true, builtin: true },
  { key: '/content', label: '内容编辑', icon: 'FileTextOutlined', visible: true, hasData: true, builtin: true },
  { key: '/projects', label: '项目管理', icon: 'ProjectOutlined', visible: true, hasData: true, builtin: true },
  { key: '/inventory', label: '物品管理', icon: 'AppstoreOutlined', visible: true, hasData: false, builtin: true },
  { key: '/finance', label: '财务中心', icon: 'MoneyCollectOutlined', visible: true, hasData: false, builtin: true },
  { key: '/secrets', label: '密钥保险箱', icon: 'KeyOutlined', visible: true, hasData: true, builtin: true },
  { key: '/reminders', label: '提醒事项', icon: 'BellOutlined', visible: true, hasData: true, builtin: true },
  { key: '/topology', label: '拓扑结构', icon: 'ApartmentOutlined', visible: true, hasData: false, builtin: true },
{ key: '/streaming', label: '直播工作室', icon: 'VideoCameraOutlined', visible: true, hasData: false, builtin: true },
];

function mergeWithDefaults(storedItems: SidebarItem[]): SidebarItem[] {
  const mergedDefaults = DEFAULT_ITEMS.map((defaultItem) => {
    const storedItem = storedItems.find((s) => s.key === defaultItem.key);
    return storedItem ? { ...defaultItem, visible: storedItem.visible } : defaultItem;
  });

  const customItems = storedItems.filter(
    (s) => !s.builtin && !DEFAULT_ITEMS.some((d) => d.key === s.key)
  );

  return [...mergedDefaults, ...customItems];
}

function getSidebarConfig(): SidebarItem[] {
  try {
    const stored = localStorage.getItem(SIDEBAR_CONFIG_KEY);
    if (!stored) return DEFAULT_ITEMS;

    const storedItems: SidebarItem[] = JSON.parse(stored);
    const merged = mergeWithDefaults(storedItems);
    localStorage.setItem(SIDEBAR_CONFIG_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return DEFAULT_ITEMS;
  }
}

function saveSidebarConfig(items: SidebarItem[]): void {
  localStorage.setItem(SIDEBAR_CONFIG_KEY, JSON.stringify(items));
}

export function getVisibleSidebarItems(): SidebarItem[] {
  return getSidebarConfig().filter((item) => item.visible);
}

export default function SidebarManagement() {
  const [items, setItems] = useState<SidebarItem[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    setItems(getSidebarConfig());
  }, []);

  if (!isAdmin()) {
    return (
      <Result
        status="403"
        title="权限不足"
        subTitle="只有管理员可以管理侧边栏"
        icon={<LockOutlined />}
      />
    );
  }

  const handleToggleVisible = (key: string) => {
    const updated = items.map((item) =>
      item.key === key ? { ...item, visible: !item.visible } : item
    );
    setItems(updated);
    saveSidebarConfig(updated);
    message.success('已更新');
  };

  const handleDelete = (item: SidebarItem) => {
    Modal.confirm({
      title: '删除菜单项',
      content: (
        <div>
          <p>确定要删除「{item.label}」吗？</p>
          {item.hasData && (
            <Alert
              message="该菜单项下有数据"
              description="删除后数据将保留在数据库中，但用户无法通过界面访问。您可以随时恢复此菜单项。"
              type="warning"
              showIcon
              style={{ marginTop: "var(--spacing-card-gap)" }}
            />
          )}
        </div>
      ),
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        const updated = items.filter((i) => i.key !== item.key);
        setItems(updated);
        saveSidebarConfig(updated);
        message.success('已删除');
      },
    });
  };

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      if (items.some((i) => i.key === values.key)) {
        message.warning('菜单项已存在');
        return;
      }
      const newItem: SidebarItem = {
        key: values.key,
        label: values.label,
        visible: true,
        hasData: false,
        builtin: false,
      };
      const updated = [...items, newItem];
      setItems(updated);
      saveSidebarConfig(updated);
      setAddModalVisible(false);
      form.resetFields();
      message.success('已添加');
    } catch {
      message.warning('请填写完整信息');
    }
  };

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>侧边栏配置</Title>
      </div>
      <Alert
        message="管理员专属"
        description="管理侧边栏菜单项的显示和隐藏。删除菜单项时，数据将保留在数据库中。"
        type="info"
        showIcon
        style={{ marginBottom: "var(--spacing-lg)" }}
      />

      <Card
        title={<><MenuOutlined /> 菜单项管理</>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>
            添加自定义项
          </Button>
        }
      >
        <List
          dataSource={items}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Switch
                  key="visible"
                  checked={item.visible}
                  onChange={() => handleToggleVisible(item.key)}
                  checkedChildren="显示"
                  unCheckedChildren="隐藏"
                />,
                !item.builtin && (
                  <Button
                    key="delete"
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(item)}
                  >
                    删除
                  </Button>
                ),
              ]}
            >
              <List.Item.Meta
                title={item.label}
                description={
                  <Space>
                    <Text type="secondary">路径: {item.key}</Text>
                    {item.builtin && <Text type="secondary">（内置）</Text>}
                    {item.hasData && <Text type="warning">有数据</Text>}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title="添加自定义菜单项"
        open={addModalVisible}
        onOk={handleAdd}
        onCancel={() => { setAddModalVisible(false); form.resetFields(); }}
        okText="添加"
        cancelText="取消"
        width={560}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="label" label="菜单项名称" rules={[{ required: true, message: '请输入菜单项名称' }]}>
            <Input placeholder="请输入菜单项名称（如：项目档案）" />
          </Form.Item>
          <Form.Item name="key" label="路径" rules={[{ required: true, message: '请输入路径' }]}>
            <Input placeholder="请输入路径（如：/archives）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
