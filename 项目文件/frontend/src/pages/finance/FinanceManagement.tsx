import { useState, useEffect, useCallback } from 'react';
import { Tabs, Table, Button, Typography, Space, Tag, Modal, message, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { listBudgets, deleteBudget } from '../../api/budgets';
import { listSubscriptions, deleteSubscription } from '../../api/subscriptions';
import type { Budget } from '../../types/budget';
import type { Subscription } from '../../types/subscription';
import BudgetModal from './BudgetModal';
import SubscriptionModal from './SubscriptionModal';
import styles from './FinanceManagement.module.css';

const { Title, Paragraph, Text } = Typography;

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

  // ── 弹窗状态（共用组件 BudgetModal / SubscriptionModal） ──
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [permissionVisible, setPermissionVisible] = useState(false);

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listBudgets();
      if (res.code === 0) setBudgets(res.data.items);
    } catch {
      message.error('获取预算列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSubscriptions();
      if (res.code === 0) setSubscriptions(res.data.items);
    } catch {
      message.error('获取订阅列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBudgets();
    fetchSubscriptions();
  }, [fetchBudgets, fetchSubscriptions]);

  // ── 打开新建/编辑（弹窗共用 BudgetModal / SubscriptionModal） ──
  const handleAddBudget = () => {
    setEditingBudget(null);
    setBudgetModalOpen(true);
  };

  const handleEditBudget = (item: Budget) => {
    setEditingBudget(item);
    setBudgetModalOpen(true);
  };

  const handleAddSubscription = () => {
    setEditingSub(null);
    setSubModalOpen(true);
  };

  const handleEditSubscription = (item: Subscription) => {
    setEditingSub(item);
    setSubModalOpen(true);
  };

  const handleDeleteBudget = (item: Budget) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除预算「${item.name}」吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteBudget(item.id);
          message.success('预算已删除');
          fetchBudgets();
        } catch (e) {
          message.error('删除预算失败');
          console.warn('Failed to delete budget:', e);
        }
      },
    });
  };

  const handleDeleteSubscription = (item: Subscription) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除订阅「${item.name}」吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteSubscription(item.id);
          message.success('订阅已删除');
          fetchSubscriptions();
        } catch (e) {
          message.error('删除订阅失败');
          console.warn('Failed to delete subscription:', e);
        }
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
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>财务中心</Title>
        <Space>
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
      <Tabs
        items={[
          {
            key: 'budgets',
            label: '预算管理',
            children: (
              <>
                <div style={{ marginBottom: "var(--spacing-card-gap)", display: 'flex', justifyContent: 'flex-end' }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddBudget}>
                    新增预算
                  </Button>
                </div>
                <Table className={styles.table ?? ''} columns={budgetColumns} dataSource={budgets} rowKey="id" loading={loading} pagination={{ showSizeChanger: true, showQuickJumper: true, showTotal: (t) => `共 ${t} 条` }} />
              </>
            ),
          },
          {
            key: 'subscriptions',
            label: '订阅管理',
            children: (
              <>
                <div style={{ marginBottom: "var(--spacing-card-gap)", display: 'flex', justifyContent: 'flex-end' }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddSubscription}>
                    新增订阅
                  </Button>
                </div>
                <Table className={styles.table ?? ''} columns={subColumns} dataSource={subscriptions} rowKey="id" loading={loading} pagination={{ showSizeChanger: true, showQuickJumper: true, showTotal: (t) => `共 ${t} 条` }} />
              </>
            ),
          },
        ]}
      />

      {/* 预算 新增/编辑（共用组件 BudgetModal） */}
      <BudgetModal
        open={budgetModalOpen}
        editingBudget={editingBudget}
        onClose={() => setBudgetModalOpen(false)}
        onSaved={() => void fetchBudgets()}
      />

      {/* 订阅 新增/编辑（共用组件 SubscriptionModal） */}
      <SubscriptionModal
        open={subModalOpen}
        editingSub={editingSub}
        onClose={() => setSubModalOpen(false)}
        onSaved={() => void fetchSubscriptions()}
      />

      <Modal
        title="权限说明"
        open={permissionVisible}
        width={560}
        footer={null}
        onCancel={() => setPermissionVisible(false)}
      >
        <div className={styles.permissionContent ?? ''}>
          <Title level={5}>创建者权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>创建者拥有预算记录的完整管理权限，可以编辑预算信息、删除记录和设置可见范围。</Paragraph>
          <Title level={5}>成员权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>可见范围内的成员可以查看预算信息；订阅记录对所有成员可见。</Paragraph>
          <Title level={5}>可见范围</Title>
          <ul className={styles.permissionList ?? ''}>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                公开：所有成员都可以查看该预算
              </Text>
            </li>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                私有：仅创建者和被授权成员可以查看
              </Text>
            </li>
          </ul>
          <Title level={5}>管理员</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>系统管理员可以管理自己创建以及被指定给自己的预算。</Paragraph>
          <Title level={5}>创建权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>所有成员都可以创建预算和订阅，创建时需设定预算可见范围。</Paragraph>
        </div>
      </Modal>
    </div>
  );
}
