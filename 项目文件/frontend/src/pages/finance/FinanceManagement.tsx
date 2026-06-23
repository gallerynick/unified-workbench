import { useState, useEffect, useCallback } from 'react';
import { Tabs, Table, Button, Input, Typography, Space, Tag, Modal, Form, InputNumber, Select, message, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { listBudgets, createBudget, updateBudget, deleteBudget } from '../../api/budgets';
import { listSubscriptions, createSubscription, updateSubscription, deleteSubscription } from '../../api/subscriptions';
import type { Budget } from '../../types/budget';
import type { Subscription } from '../../types/subscription';

const { Title } = Typography;

const PERIOD_MAP: Record<string, string> = {
  monthly: '月度',
  quarterly: '季度',
  yearly: '年度',
};

const CYCLE_MAP: Record<string, string> = {
  monthly: '月付',
  yearly: '年付',
};

const BUDGET_STATUS_MAP: Record<string, { color: string; text: string }> = {
  active: { color: 'green', text: '进行中' },
  exceeded: { color: 'red', text: '超支' },
  completed: { color: 'default', text: '已完成' },
};

const SUB_STATUS_MAP: Record<string, { color: string; text: string }> = {
  active: { color: 'green', text: '活跃' },
  cancelled: { color: 'red', text: '已取消' },
  paused: { color: 'orange', text: '已暂停' },
};

export default function FinanceManagement() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [subModalVisible, setSubModalVisible] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [budgetForm] = Form.useForm();
  const [subForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const fetchBudgets = useCallback(async () => {
    try {
      const res = await listBudgets();
      if (res.code === 0) setBudgets(res.data.items);
    } catch {
      message.error('获取预算列表失败');
    }
  }, []);

  const fetchSubscriptions = useCallback(async () => {
    try {
      const res = await listSubscriptions();
      if (res.code === 0) setSubscriptions(res.data.items);
    } catch {
      message.error('获取订阅列表失败');
    }
  }, []);

  useEffect(() => {
    fetchBudgets();
    fetchSubscriptions();
  }, [fetchBudgets, fetchSubscriptions]);

  const handleAddBudget = () => {
    setEditingBudget(null);
    budgetForm.resetFields();
    setBudgetModalVisible(true);
  };

  const handleEditBudget = (item: Budget) => {
    setEditingBudget(item);
    budgetForm.setFieldsValue(item);
    setBudgetModalVisible(true);
  };

  const handleSaveBudget = async () => {
    try {
      const values = await budgetForm.validateFields();
      setLoading(true);
      if (editingBudget) {
        await updateBudget(editingBudget.id, values);
        message.success('预算已更新');
      } else {
        await createBudget(values);
        message.success('预算已添加');
      }
      setBudgetModalVisible(false);
      fetchBudgets();
    } catch {
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBudget = (item: Budget) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除预算「${item.name}」吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await deleteBudget(item.id);
        message.success('预算已删除');
        fetchBudgets();
      },
    });
  };

  const handleAddSubscription = () => {
    setEditingSub(null);
    subForm.resetFields();
    setSubModalVisible(true);
  };

  const handleEditSubscription = (item: Subscription) => {
    setEditingSub(item);
    subForm.setFieldsValue({
      ...item,
      next_billing: item.next_billing ? item.next_billing.split('T')[0] : '',
    });
    setSubModalVisible(true);
  };

  const handleSaveSubscription = async () => {
    try {
      const values = await subForm.validateFields();
      setLoading(true);
      if (editingSub) {
        await updateSubscription(editingSub.id, values);
        message.success('订阅已更新');
      } else {
        await createSubscription(values);
        message.success('订阅已添加');
      }
      setSubModalVisible(false);
      fetchSubscriptions();
    } catch {
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubscription = (item: Subscription) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除订阅「${item.name}」吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await deleteSubscription(item.id);
        message.success('订阅已删除');
        fetchSubscriptions();
      },
    });
  };

  const budgetColumns: ColumnsType<Budget> = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '分类', dataIndex: 'category', key: 'category' },
    { title: '预算金额', dataIndex: 'amount', key: 'amount', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '已使用', dataIndex: 'spent', key: 'spent', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '周期', dataIndex: 'period', key: 'period', render: (v: string) => PERIOD_MAP[v] ?? v },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => {
        const cfg = BUDGET_STATUS_MAP[record.status] ?? { color: 'default', text: record.status };
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditBudget(record)}>编辑</Button>
          </Tooltip>
          <Tooltip title="删除">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteBudget(record)}>删除</Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const subColumns: ColumnsType<Subscription> = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '提供商', dataIndex: 'provider', key: 'provider' },
    { title: '费用', dataIndex: 'amount', key: 'amount', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '计费周期', dataIndex: 'billing_cycle', key: 'billing_cycle', render: (v: string) => CYCLE_MAP[v] ?? v },
    { title: '下次扣费', dataIndex: 'next_billing', key: 'next_billing', render: (v: string | null) => v ? new Date(v).toLocaleDateString('zh-CN') : '-' },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => {
        const cfg = SUB_STATUS_MAP[record.status] ?? { color: 'default', text: record.status };
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditSubscription(record)}>编辑</Button>
          </Tooltip>
          <Tooltip title="删除">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteSubscription(record)}>删除</Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ margin: 0 }}>财务管理</Title>
      <Tabs
        items={[
          {
            key: 'budgets',
            label: '预算管理',
            children: (
              <>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddBudget}>
                    新增预算
                  </Button>
                </div>
                <Table columns={budgetColumns} dataSource={budgets} rowKey="id" />
              </>
            ),
          },
          {
            key: 'subscriptions',
            label: '订阅管理',
            children: (
              <>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddSubscription}>
                    新增订阅
                  </Button>
                </div>
                <Table columns={subColumns} dataSource={subscriptions} rowKey="id" />
              </>
            ),
          },
        ]}
      />

      <Modal title={editingBudget ? '编辑预算' : '新增预算'} open={budgetModalVisible} onOk={handleSaveBudget} onCancel={() => setBudgetModalVisible(false)} okText="保存" cancelText="取消" confirmLoading={loading}>
        <Form form={budgetForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="预算名称" />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请输入分类' }]}>
            <Input placeholder="如：运营、开发、市场" />
          </Form.Item>
          <Form.Item name="amount" label="预算金额" rules={[{ required: true, message: '请输入金额' }]}>
            <InputNumber min={0} style={{ width: '100%' }} prefix="¥" />
          </Form.Item>
          <Form.Item name="period" label="周期" initialValue="monthly">
            <Select options={[{ value: 'monthly', label: '月度' }, { value: 'quarterly', label: '季度' }, { value: 'yearly', label: '年度' }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={editingSub ? '编辑订阅' : '新增订阅'} open={subModalVisible} onOk={handleSaveSubscription} onCancel={() => setSubModalVisible(false)} okText="保存" cancelText="取消" confirmLoading={loading}>
        <Form form={subForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="订阅名称" />
          </Form.Item>
          <Form.Item name="provider" label="提供商" rules={[{ required: true, message: '请输入提供商' }]}>
            <Input placeholder="如：AWS、阿里云、GitHub" />
          </Form.Item>
          <Form.Item name="amount" label="费用" rules={[{ required: true, message: '请输入费用' }]}>
            <InputNumber min={0} style={{ width: '100%' }} prefix="¥" />
          </Form.Item>
          <Form.Item name="billing_cycle" label="计费周期" initialValue="monthly">
            <Select options={[{ value: 'monthly', label: '月付' }, { value: 'yearly', label: '年付' }]} />
          </Form.Item>
          <Form.Item name="next_billing" label="下次扣费日期">
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
