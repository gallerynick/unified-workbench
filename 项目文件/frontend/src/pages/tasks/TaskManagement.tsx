import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Typography, Modal, message, Space, Tooltip, Form } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { listTasks, createTask, updateTask, deleteTask } from '../../api/tasks';
import type { Task, TaskStatus, TaskPriority } from '../../types/task';
import styles from './TaskManagement.module.css';

const { Title } = Typography;

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

export default function TaskManagement() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form] = Form.useForm();

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params: { page: number; page_size: number; status?: string; priority?: string } = {
        page,
        page_size: pageSize,
      };
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
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
  }, [page, pageSize, statusFilter, priorityFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleCreate = () => {
    setEditingTask(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    form.setFieldsValue({ title: task.title, description: task.description ?? '', priority: task.priority });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingTask) {
        const res = await updateTask(editingTask.id, { title: values.title, description: values.description, priority: values.priority });
        if (res.code === 0) { message.success('任务已更新'); setModalVisible(false); fetchTasks(); }
      } else {
        const res = await createTask({ title: values.title, description: values.description, priority: values.priority });
        if (res.code === 0) { message.success('任务已创建'); setModalVisible(false); fetchTasks(); }
      }
    } catch { message.error('操作失败'); }
  };

  const handleDelete = (task: Task) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除任务「${task.title}」吗？`,
      okText: '删除', okType: 'danger', cancelText: '取消',
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
      title: '截止日期', dataIndex: 'due_date', key: 'due_date', width: 120,
      render: (date: string | null) => date ? new Date(date).toLocaleDateString('zh-CN') : '-',
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
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
        <Title level={4} className={styles.title ?? ''}>任务中心</Title>
        <Space>
          <Select value={statusFilter} onChange={setStatusFilter} placeholder="状态筛选" allowClear style={{ width: 120 }}
            options={[{ value: '', label: '全部' }, ...Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.text }))]}
          />
          <Select value={priorityFilter} onChange={setPriorityFilter} placeholder="优先级筛选" allowClear style={{ width: 120 }}
            options={[{ value: '', label: '全部' }, ...Object.entries(PRIORITY_MAP).map(([k, v]) => ({ value: k, label: v.text }))]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建待办</Button>
        </Space>
      </div>

      <Table<Task> columns={columns} dataSource={tasks} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />

      <Modal title={editingTask ? '编辑待办' : '新建待办'} open={modalVisible} onOk={handleSave}
        onCancel={() => { setModalVisible(false); form.resetFields(); }} okText="保存" cancelText="取消" width={560} styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}>
        <Form form={form} layout="vertical" initialValues={{ priority: 'medium' }}>
          <Form.Item name="title" label="待办标题" rules={[{ required: true, message: '请输入待办标题' }]}>
            <Input placeholder="请输入待办标题" />
          </Form.Item>
          <Form.Item name="description" label="待办描述">
            <Input.TextArea placeholder="请输入待办描述（可选）" rows={3} />
          </Form.Item>
          <Form.Item name="priority" label="优先级">
            <Select options={Object.entries(PRIORITY_MAP).map(([k, v]) => ({ value: k, label: v.text }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
