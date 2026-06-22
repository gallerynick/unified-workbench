import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Typography, Modal, message, Space, Tooltip, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { listInventories, createInventory, updateInventory, deleteInventory } from '../../api/inventory';
import type { Inventory, InventoryStatus } from '../../types/inventory';
import styles from './InventoryManagement.module.css';

const { Title } = Typography;

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
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formLocation, setFormLocation] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<InventoryStatus>('available');

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
    setFormName('');
    setFormCategory('');
    setFormQuantity(1);
    setFormLocation('');
    setFormDescription('');
    setFormStatus('available');
    setModalVisible(true);
  };

  const handleEdit = (item: Inventory) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category || '');
    setFormQuantity(item.quantity);
    setFormLocation(item.location || '');
    setFormDescription(item.description || '');
    setFormStatus(item.status);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { message.warning('请输入物品名称'); return; }
    try {
      const data: {
        name: string;
        category?: string;
        quantity: number;
        location?: string;
        description?: string;
        status: InventoryStatus;
      } = {
        name: formName,
        quantity: formQuantity,
        status: formStatus,
      };
      if (formCategory) data.category = formCategory;
      if (formLocation) data.location = formLocation;
      if (formDescription) data.description = formDescription;
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
        <Title level={4}>物品管理</Title>
        <Space>
          <Input placeholder="搜索物品" allowClear style={{ width: 160 }}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} placeholder="状态筛选" allowClear style={{ width: 120 }}
            options={[{ value: '', label: '全部' }, ...Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.text }))]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新增物品</Button>
        </Space>
      </div>

      <Table<Inventory> columns={columns} dataSource={items} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />

      <Modal title={editingItem ? '编辑物品' : '新增物品'} open={modalVisible} onOk={handleSave}
        onCancel={() => setModalVisible(false)} okText="保存" cancelText="取消">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Input placeholder="物品名称" value={formName} onChange={(e) => setFormName(e.target.value)} />
          <Input placeholder="分类（可选）" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} />
          <InputNumber placeholder="数量" min={0} value={formQuantity} onChange={(v) => setFormQuantity(v ?? 1)} style={{ width: '100%' }} />
          <Input placeholder="存放位置（可选）" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} />
          <Input.TextArea placeholder="描述（可选）" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} />
          <Select value={formStatus} onChange={(v) => setFormStatus(v as InventoryStatus)} style={{ width: '100%' }}
            options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.text }))}
          />
        </Space>
      </Modal>
    </div>
  );
}
