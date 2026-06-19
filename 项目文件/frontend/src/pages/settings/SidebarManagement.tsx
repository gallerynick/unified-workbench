import { useState, useEffect } from 'react';
import { Card, Button, Typography, message, Space, Switch, List, Modal, Input, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, LockOutlined, MenuOutlined } from '@ant-design/icons';
import { isAdmin } from '../../utils/auth';
import { Result } from 'antd';

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
  { key: '/files', label: '文件管理', icon: 'FileOutlined', visible: true, hasData: true, builtin: true },
  { key: '/content', label: '内容管理', icon: 'FileTextOutlined', visible: true, hasData: true, builtin: true },
  { key: '/projects', label: '项目管理', icon: 'ProjectOutlined', visible: true, hasData: true, builtin: true },
  { key: '/inventory', label: '物品管理', icon: 'AppstoreOutlined', visible: true, hasData: false, builtin: true },
  { key: '/finance', label: '财务管理', icon: 'MoneyCollectOutlined', visible: true, hasData: false, builtin: true },
  { key: '/secrets', label: '密钥管理', icon: 'KeyOutlined', visible: true, hasData: true, builtin: true },
  { key: '/reminders', label: '提醒管理', icon: 'BellOutlined', visible: true, hasData: true, builtin: true },
];

function getSidebarConfig(): SidebarItem[] {
  try {
    const stored = localStorage.getItem(SIDEBAR_CONFIG_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_ITEMS;
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
  const [newItemKey, setNewItemKey] = useState('');
  const [newItemLabel, setNewItemLabel] = useState('');

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
              style={{ marginTop: 16 }}
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

  const handleAdd = () => {
    if (!newItemKey.trim() || !newItemLabel.trim()) {
      message.warning('请填写完整信息');
      return;
    }
    if (items.some((i) => i.key === newItemKey)) {
      message.warning('菜单项已存在');
      return;
    }
    const newItem: SidebarItem = {
      key: newItemKey,
      label: newItemLabel,
      visible: true,
      hasData: false,
      builtin: false,
    };
    const updated = [...items, newItem];
    setItems(updated);
    saveSidebarConfig(updated);
    setAddModalVisible(false);
    setNewItemKey('');
    setNewItemLabel('');
    message.success('已添加');
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <Title level={4}>侧边栏管理</Title>
      <Alert
        message="管理员专属"
        description="管理侧边栏菜单项的显示和隐藏。删除菜单项时，数据将保留在数据库中。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
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
        onCancel={() => setAddModalVisible(false)}
        okText="添加"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            placeholder="菜单项名称（如：项目档案）"
            value={newItemLabel}
            onChange={(e) => setNewItemLabel(e.target.value)}
          />
          <Input
            placeholder="路径（如：/archives）"
            value={newItemKey}
            onChange={(e) => setNewItemKey(e.target.value)}
          />
        </Space>
      </Modal>
    </div>
  );
}
