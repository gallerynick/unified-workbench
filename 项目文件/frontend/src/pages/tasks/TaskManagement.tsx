import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Select, Tag, Typography, Modal, message, Space, Tooltip, Tabs } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { listTasks, updateTask, deleteTask } from '../../api/tasks';
import type { Task, TaskStatus, TaskPriority } from '../../types/task';
import { getVisibilityConfig } from '../../utils/visibility';
import { getUserId } from '../../utils/auth';
import TaskModal from './TaskModal';
import styles from './TaskManagement.module.css';

const { Title, Paragraph, Text } = Typography;

const STATUS_MAP: Record<TaskStatus, { color: string; text: string }> = {
  todo: { color: 'default', text: '待办' },
  in_progress: { color: 'processing', text: '进行中' },
  done: { color: 'success', text: '已完成' },
  cancelled: { color: 'error', text: '已取消' },
};

const PRIORITY_MAP: Record<TaskPriority, { color: string; text: string }> = {
  low: { color: 'default', text: '低' },
  medium: { color: 'blue', text: '中' },
  high: { color: 'orange', text: '高' },
  urgent: { color: 'red', text: '紧急' },
};

type TabKey = 'all' | 'mine';

const TAB_ITEMS: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'mine', label: '我创建的' },
];

export default function TaskManagement() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  // ── 弹窗状态（共用组件 TaskModal） ──
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [permissionVisible, setPermissionVisible] = useState(false);

  const currentUserId = getUserId();

  // 任务权限：仅创建者可编辑 / 改状态 / 删除（管理员无额外权限，与后端 403 一致）
  const canManage = (task: Task): boolean => task.owner_id === currentUserId;

  const handleTabChange = (key: string) => {
    setActiveTab(key as TabKey);
    setPage(1);
  };

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        page: number;
        page_size: number;
        status?: string;
        priority?: string;
        owner_id?: string;
      } = {
        page,
        page_size: pageSize,
      };
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (activeTab === 'mine' && currentUserId) params.owner_id = currentUserId;
      const res = await listTasks(params);
      if (res.code === 0) {
        setTasks(res.data.items);
        setTotal(res.data.total);
      }
    } catch {
      message.error('获取任务列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, priorityFilter, activeTab, currentUserId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // ── 打开新建/编辑（弹窗共用 TaskModal） ──
  const handleCreate = () => {
    setEditingTask(null);
    setTaskModalOpen(true);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setTaskModalOpen(true);
  };

  const handleDelete = (task: Task) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除任务「${task.title}」吗？`,
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteTask(task.id);
          if (res.code === 0) { message.success('任务已删除'); fetchTasks(); }
        } catch { message.error('删除失败'); }
      },
    });
  };

  const handleStatusChange = async (task: Task, status: TaskStatus) => {
    try {
      const res = await updateTask(task.id, { status });
      if (res.code === 0) { message.success('状态已更新'); fetchTasks(); }
    } catch { message.error('更新失败'); }
  };

  const columns: ColumnsType<Task> = [
    { title: '标题', dataIndex: 'title', key: 'title', width: 200 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (status: TaskStatus, record) => (
        <Select value={status} size="small" style={{ width: 90 }}
          disabled={!canManage(record)}
          onChange={(v) => handleStatusChange(record, v as TaskStatus)}
          options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.text }))}
        />
      ),
    },
    {
      title: '优先级', dataIndex: 'priority', key: 'priority', width: 80,
      render: (priority: TaskPriority) => <Tag color={PRIORITY_MAP[priority].color}>{PRIORITY_MAP[priority].text}</Tag>,
    },
    {
      title: '可见性', dataIndex: 'visibility', key: 'visibility', width: 90,
      render: (visibility: string | undefined, record) => {
        const cfg = getVisibilityConfig(visibility ?? 'private');
        const hint = visibility === 'restricted'
          ? `指定用户可见（${record.restricted_users?.length ?? 0} 人）`
          : cfg.description;
        return (
          <Tooltip title={hint}>
            <Tag color={cfg.color}>{cfg.text}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '截止日期', dataIndex: 'due_date', key: 'due_date', width: 120,
      render: (date: string | null) => date ? new Date(date).toLocaleDateString('zh-CN') : '-',
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作', key: 'action', width: 140,
      render: (_, record) => canManage(record) ? (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          </Tooltip>
          <Tooltip title="删除">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button>
          </Tooltip>
        </Space>
      ) : (
        <Tooltip title="仅创建者可编辑或删除">
          <Text type="secondary">只读</Text>
        </Tooltip>
      ),
    },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>任务中心</Title>
        <Space>
          <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} placeholder="状态筛选" allowClear style={{ width: 120 }}
            options={[{ value: '', label: '全部' }, ...Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.text }))]}
          />
          <Select value={priorityFilter} onChange={(v) => { setPriorityFilter(v); setPage(1); }} placeholder="优先级筛选" allowClear style={{ width: 120 }}
            options={[{ value: '', label: '全部' }, ...Object.entries(PRIORITY_MAP).map(([k, v]) => ({ value: k, label: v.text }))]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建任务</Button>
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

      <Tabs activeKey={activeTab} items={TAB_ITEMS} onChange={handleTabChange} className={styles.tabs ?? ''} />

      <Table<Task> className={styles.table ?? ''} columns={columns} dataSource={tasks} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, showQuickJumper: true, showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />

      {/* 新建/编辑 任务（共用组件 TaskModal） */}
      <TaskModal
        open={taskModalOpen}
        editingTask={editingTask}
        onClose={() => setTaskModalOpen(false)}
        onSaved={() => void fetchTasks()}
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
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>创建者拥有该任务的完整管理权限：编辑内容、调整状态、删除任务、设置可见范围。</Paragraph>
          <Title level={5}>其他成员</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>非创建者只能查看自己可见范围内的任务，不能编辑、调整状态或删除。</Paragraph>
          <Title level={5}>可见范围</Title>
          <ul className={styles.permissionList ?? ''}>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                公开：所有登录成员都可以查看该任务
              </Text>
            </li>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                私有：仅创建者可以查看
              </Text>
            </li>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                受限（指定用户）：仅创建者和被指定的用户可以查看
              </Text>
            </li>
          </ul>
          <Title level={5}>管理员</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>系统管理员不享有额外权限：只能管理自己创建的任务；对公开或指定给自己的任务同样只读。</Paragraph>
          <Title level={5}>创建权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>所有成员都可以创建任务，创建时可设定可见范围，默认为私有。</Paragraph>
        </div>
      </Modal>
    </div>
  );
}
