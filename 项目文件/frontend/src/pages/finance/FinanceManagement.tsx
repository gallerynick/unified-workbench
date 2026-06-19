import { useState } from 'react';
import { Tabs, Table, Button, Input, Typography, Space, Tag, Modal, Form, InputNumber, Select, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

interface BudgetItem {
  id: string;
  name: string;
  category: string;
  amount: number;
  spent: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  status: 'active' | 'exceeded' | 'completed';
  created_at: string;
}

interface SubscriptionItem {
  id: string;
  name: string;
  provider: string;
  amount: number;
  billing_cycle: 'monthly' | 'yearly';
  next_billing: string;
  status: 'active' | 'cancelled' | 'paused';
  created_at: string;
}

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
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [subModalVisible, setSubModalVisible] = useState(false);
  const [budgetForm] = Form.useForm();
  const [subForm] = Form.useForm();

  const handleAddBudget = () => {
    budgetForm.resetFields();
    setBudgetModalVisible(true);
  };

  const handleSaveBudget = () => {
    budgetForm.validateFields().then((values) => {
      const newBudget: BudgetItem = {
        ...values,
        id: Date.now().toString(),
        spent: 0,
        status: 'active',
        created_at: new Date().toISOString(),
      };
      setBudgets([...budgets, newBudget]);
      setBudgetModalVisible(false);
      message.success('预算已添加');
    });
  };

  const handleDeleteBudget = (item: BudgetItem) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除预算「${item.name}」吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        setBudgets(budgets.filter((b) => b.id !== item.id));
        message.success('预算已删除');
      },
    });
  };

  const handleAddSubscription = () => {
    subForm.resetFields();
    setSubModalVisible(true);
  };

  const handleSaveSubscription = () => {
    subForm.validateFields().then((values) => {
      const newSub: SubscriptionItem = {
        ...values,
        id: Date.now().toString(),
        status: 'active',
        created_at: new Date().toISOString(),
      };
      setSubscriptions([...subscriptions, newSub]);
      setSubModalVisible(false);
      message.success('订阅已添加');
    });
  };

  const handleDeleteSubscription = (item: SubscriptionItem) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除订阅「${item.name}」吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        setSubscriptions(subscriptions.filter((s) => s.id !== item.id));
        message.success('订阅已删除');
      },
    });
  };

  const budgetColumns: ColumnsType<BudgetItem> = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '分类', dataIndex: 'category', key: 'category' },
    { title: '预算金额', dataIndex: 'amount', key: 'amount', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '已使用', dataIndex: 'spent', key: 'spent', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '周期', dataIndex: 'period', key: 'period' },
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
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} />
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDeleteBudget(record)} />
        </Space>
      ),
    },
  ];

  const subColumns: ColumnsType<SubscriptionItem> = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '提供商', dataIndex: 'provider', key: 'provider' },
    { title: '费用', dataIndex: 'amount', key: 'amount', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '计费周期', dataIndex: 'billing_cycle', key: 'billing_cycle' },
    { title: '下次扣费', dataIndex: 'next_billing', key: 'next_billing' },
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
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} />
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDeleteSubscription(record)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={4}>财务管理</Title>
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

      <Modal title="新增预算" open={budgetModalVisible} onOk={handleSaveBudget} onCancel={() => setBudgetModalVisible(false)} okText="保存" cancelText="取消">
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

      <Modal title="新增订阅" open={subModalVisible} onOk={handleSaveSubscription} onCancel={() => setSubModalVisible(false)} okText="保存" cancelText="取消">
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
          <Form.Item name="next_billing" label="下次扣费日期" rules={[{ required: true, message: '请选择日期' }]}>
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
