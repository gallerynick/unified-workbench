import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Typography, Modal, message, Space, Tooltip, InputNumber, Form } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { listInventories, createInventory, updateInventory, deleteInventory } from '../../api/inventory';
import type { Inventory, InventoryStatus } from '../../types/inventory';
import VisibilitySetting from '@/components/VisibilitySetting/VisibilitySetting';
import type { Visibility } from '../../utils/visibility';
import styles from './InventoryManagement.module.css';

const { Title, Paragraph, Text } = Typography;

const STATUS_MAP: Record<InventoryStatus, { color: string; text: string }> = {
  available: { color: 'success', text: '可用' },
  in_use: { color: 'processing', text: '使用中' },
  maintenance: { color: 'warning', text: '维护中' },
  retired: { color: 'default', text: '已退役' },
};

export default function InventoryManagement() {
  const [items, setItems] = useState<Inventory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Inventory | null>(null);
  const [form] = Form.useForm();
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formStatus, setFormStatus] = useState<InventoryStatus>('available');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [restrictedUsers, setRestrictedUsers] = useState<string[]>([]);
  const [permissionVisible, setPermissionVisible] = useState(false);

  const fetchInventories = useCallback(async () => {
    setLoading(true);
    try {
      const params: { page: number; page_size: number; status?: string; search?: string } = {
        page,
        page_size: pageSize,
      };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const res = await listInventories(params);
      if (res.code === 0) {
        setItems(res.data.items);
        setTotal(res.data.total);
      }
    } catch {
      message.error('获取物品列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, search]);

  useEffect(() => { fetchInventories(); }, [fetchInventories]);

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    setFormQuantity(1);
    setFormStatus('available');
    setVisibility('private');
    setRestrictedUsers([]);
    setModalVisible(true);
  };

  const handleEdit = (item: Inventory) => {
    setEditingItem(item);
    form.setFieldsValue({ name: item.name, category: item.category ?? '', location: item.location ?? '', description: item.description ?? '' });
    setFormQuantity(item.quantity);
    setFormStatus(item.status);
    setVisibility((item.visibility as Visibility) || 'private');
    setRestrictedUsers(item.restricted_users || []);
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const data: {
        name: string;
        category?: string;
        quantity: number;
        location?: string;
        description?: string;
        status: InventoryStatus;
        visibility: Visibility;
        restricted_users?: string[];
      } = {
        name: values.name,
        quantity: formQuantity,
        status: formStatus,
        visibility,
        ...(visibility === 'restricted' && restrictedUsers.length > 0 ? { restricted_users: restrictedUsers } : {}),
      };
      if (values.category) data.category = values.category;
      if (values.location) data.location = values.location;
      if (values.description) data.description = values.description;
      if (editingItem) {
        const res = await updateInventory(editingItem.id, data);
        if (res.code === 0) { message.success('物品已更新'); setModalVisible(false); fetchInventories(); }
      } else {
        const res = await createInventory(data);
        if (res.code === 0) { message.success('物品已创建'); setModalVisible(false); fetchInventories(); }
      }
    } catch { message.error('操作失败'); }
  };

  const handleDelete = (item: Inventory) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除物品「${item.name}」吗？`,
      okText: '删除', okType: 'danger', cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteInventory(item.id);
          if (res.code === 0) { message.success('物品已删除'); fetchInventories(); }
        } catch { message.error('删除失败'); }
      },
    });
  };

  const handleStatusChange = async (item: Inventory, status: InventoryStatus) => {
    try {
      const res = await updateInventory(item.id, { status });
      if (res.code === 0) { message.success('状态已更新'); fetchInventories(); }
    } catch { message.error('更新失败'); }
  };

  const columns: ColumnsType<Inventory> = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 180 },
    {
      title: '分类', dataIndex: 'category', key: 'category', width: 120,
      render: (cat: string | null) => cat || '-',
    },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80 },
    {
      title: '存放位置', dataIndex: 'location', key: 'location', width: 140,
      render: (loc: string | null) => loc || '-',
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 110,
      render: (status: InventoryStatus, record) => (
        <Select value={status} size="small" style={{ width: 100 }}
          onChange={(v) => handleStatusChange(record, v as InventoryStatus)}
          options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.text }))}
        />
      ),
    },
    {
      title: '操作', key: 'action', width: 140,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          </Tooltip>
          <Tooltip title="删除">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>物品管理</Title>
        <Space>
          <Input placeholder="搜索物品" allowClear style={{ width: 160 }}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} placeholder="状态筛选" allowClear style={{ width: 120 }}
            options={[{ value: '', label: '全部' }, ...Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.text }))]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新增物品</Button>
          <Tooltip title="权限说明">
            <Button
              type="text"
              size="small"
              icon={<QuestionCircleOutlined />}
              onClick={() => setPermissionVisible(true)}
            />
          </Tooltip>
        </Space>
      </div>

      <Table<Inventory> className={styles.table ?? ''} columns={columns} dataSource={items} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, showQuickJumper: true, showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />

      <Modal title={editingItem ? '编辑物品' : '新增物品'} open={modalVisible} onOk={handleSave}
        onCancel={() => { setModalVisible(false); form.resetFields(); }} okText="保存" cancelText="取消" width={560} destroyOnClose styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}>
        <Form form={form} layout="vertical" initialValues={{ quantity: 1, status: 'available' }}>
          <Form.Item name="name" label="物品名称" rules={[{ required: true, message: '请输入物品名称' }]}>
            <Input placeholder="请输入物品名称" />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input placeholder="请输入分类（可选）" />
          </Form.Item>
          <Form.Item label="数量">
            <InputNumber min={0} value={formQuantity} onChange={(v) => setFormQuantity(v ?? 1)} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="location" label="存放位置">
            <Input placeholder="请输入存放位置（可选）" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入描述（可选）" rows={3} />
          </Form.Item>
          <Form.Item label="状态">
            <Select value={formStatus} onChange={(v) => setFormStatus(v as InventoryStatus)} options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.text }))} />
          </Form.Item>
          <Form.Item label="可见性">
            <VisibilitySetting
              value={visibility}
              restrictedUsers={restrictedUsers}
              onChange={setVisibility}
              onRestrictedUsersChange={setRestrictedUsers}
              showRestrictedTags={false}
              label=""
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="权限说明"
        open={permissionVisible}
        width={560}
        footer={null}
        onCancel={() => setPermissionVisible(false)}
      >
        <div className={styles.permissionContent ?? ''}>
          <Title level={5}>创建者权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>创建者拥有物品记录的完整管理权限，可以编辑物品信息、调整状态、删除记录和设置可见范围。</Paragraph>
          <Title level={5}>成员/指定用户权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>可见范围内的成员可以查看物品详情；被指定的用户只能查看被授权给自己的物品。</Paragraph>
          <Title level={5}>可见范围</Title>
          <ul className={styles.permissionList ?? ''}>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                公开：所有成员都可以查看该物品
              </Text>
            </li>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                私有：仅创建者和被授权成员可以查看
              </Text>
            </li>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                指定用户：仅被指定的用户可以看到该物品
              </Text>
            </li>
          </ul>
          <Title level={5}>管理员</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>系统管理员可以管理自己创建以及被指定给自己的物品。</Paragraph>
          <Title level={5}>创建权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>所有成员都可以创建物品，创建时需设定可见范围。</Paragraph>
        </div>
      </Modal>
    </div>
  );
}
