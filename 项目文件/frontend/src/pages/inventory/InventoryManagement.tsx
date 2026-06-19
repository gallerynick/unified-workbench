import { useState } from 'react';
import { Table, Button, Input, Typography, Space, Tag, Modal, Form, InputNumber, message } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  created_at: string;
}

const STATUS_MAP: Record<string, { color: string; text: string }> = {
  in_stock: { color: 'green', text: '充足' },
  low_stock: { color: 'orange', text: '偏低' },
  out_of_stock: { color: 'red', text: '缺货' },
};

export default function InventoryManagement() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form] = Form.useForm();

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    form.setFieldsValue(item);
    setModalVisible(true);
  };

  const handleDelete = (item: InventoryItem) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除物品「${item.name}」吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        setItems(items.filter((i) => i.id !== item.id));
        message.success('物品已删除');
      },
    });
  };

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      if (editingItem) {
        setItems(items.map((i) => (i.id === editingItem.id ? { ...i, ...values } : i)));
        message.success('物品已更新');
      } else {
        const newItem: InventoryItem = {
          ...values,
          id: Date.now().toString(),
          created_at: new Date().toISOString(),
        };
        setItems([...items, newItem]);
        message.success('物品已添加');
      }
      setModalVisible(false);
    });
  };

  const filteredItems = search
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  const columns: ColumnsType<InventoryItem> = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '分类', dataIndex: 'category', key: 'category' },
    { title: '数量', dataIndex: 'quantity', key: 'quantity' },
    { title: '单位', dataIndex: 'unit', key: 'unit' },
    { title: '存放位置', dataIndex: 'location', key: 'location' },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => {
        const cfg = STATUS_MAP[record.status] ?? { color: 'default', text: record.status };
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>物品管理</Title>
        <Space>
          <Input
            placeholder="搜索物品"
            prefix={<SearchOutlined />}
            allowClear
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新增物品
          </Button>
        </Space>
      </div>

      <Table columns={columns} dataSource={filteredItems} rowKey="id" />

      <Modal
        title={editingItem ? '编辑物品' : '新增物品'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="物品名称" />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请输入分类' }]}>
            <Input placeholder="如：办公用品、设备、耗材" />
          </Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true, message: '请输入数量' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="unit" label="单位" rules={[{ required: true, message: '请输入单位' }]}>
            <Input placeholder="如：个、箱、台" />
          </Form.Item>
          <Form.Item name="location" label="存放位置">
            <Input placeholder="存放位置" />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="in_stock">
            <Input placeholder="in_stock / low_stock / out_of_stock" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
