import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Tag,
  Typography,
  Modal,
  message,
  Space,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { listReminders, deleteReminder } from '../../api/reminders';
import type { Reminder, ReminderStatus } from '../../types/reminder';
import ReminderFormModal from './ReminderFormModal';
import styles from './ReminderManagement.module.css';

const { Title, Paragraph } = Typography;

const STATUS_TAG_MAP: Record<ReminderStatus, { color: string; text: string }> = {
  pending: { color: 'default', text: '待发送' },
  sent: { color: 'success', text: '已发送' },
  failed: { color: 'error', text: '发送失败' },
  cancelled: { color: 'default', text: '已取消' },
};

export default function ReminderManagement() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [permissionVisible, setPermissionVisible] = useState(false);

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        page: number;
        page_size: number;
        status?: string;
      } = {
        page,
        page_size: pageSize,
      };
      if (statusFilter) params.status = statusFilter;

      const res = await listReminders(params);
      if (res.code === 0) {
        setReminders(res.data.items);
        setTotal(res.data.total);
      } else {
        message.error(res.msg || '获取提醒列表失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取提醒列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleCreate = () => {
    setModalMode('create');
    setEditingReminder(null);
    setModalVisible(true);
  };

  const handleEdit = (record: Reminder) => {
    setModalMode('edit');
    setEditingReminder(record);
    setModalVisible(true);
  };

  const handleDelete = (record: Reminder) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除提醒「${record.title}」吗？此操作不可撤销。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteReminder(record.id);
          if (res.code === 0) {
            message.success('提醒已删除');
            fetchReminders();
          } else {
            message.error(res.msg || '删除失败');
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '删除失败';
          message.error(msg);
        }
      },
    });
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setEditingReminder(null);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditingReminder(null);
    fetchReminders();
  };

  // 客户端搜索过滤
  const filteredReminders = search
    ? reminders.filter((r) => r.title.toLowerCase().includes(search.toLowerCase()))
    : reminders;

  const columns: ColumnsType<Reminder> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: '触发时间',
      dataIndex: 'trigger_time',
      key: 'trigger_time',
      width: 180,
      render: (time: string | null) => (time ? new Date(time).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ReminderStatus) => {
        const cfg = STATUS_TAG_MAP[status];
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time: string) => new Date(time).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, record: Reminder) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            >
              删除
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>
          提醒事项
        </Title>
        <Space>
          <Input
            placeholder="搜索标题"
            prefix={<SearchOutlined style={{ color: 'var(--text-secondary)' }} />}
            allowClear
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            variant="filled"
            className={styles.searchInput ?? ''}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            className={styles.statusSelect ?? ''}
            onChange={handleStatusFilter}
            options={[
              { value: 'pending', label: '待发送' },
              { value: 'sent', label: '已发送' },
              { value: 'failed', label: '发送失败' },
              { value: 'cancelled', label: '已取消' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建提醒
          </Button>
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

      <Table<Reminder>
        className={styles.table ?? ''}
        columns={columns}
        dataSource={filteredReminders}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <ReminderFormModal
        visible={modalVisible}
        mode={modalMode}
        reminder={editingReminder}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />

      <Modal
        title="权限说明"
        open={permissionVisible}
        width={560}
        footer={null}
        onCancel={() => setPermissionVisible(false)}
        destroyOnClose
      >
        <div>
          <Title level={5}>创建者权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>提醒为纯私有，仅创建者本人可以查看、编辑和删除提醒。</Paragraph>

          <Title level={5}>提醒方式</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>支持定时触发提醒。</Paragraph>

          <Title level={5}>管理员</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>系统管理员无权管理他人的提醒（提醒为纯私有）。</Paragraph>

          <Title level={5}>创建权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>所有成员都可以创建提醒，提醒仅对创建者可见。</Paragraph>
        </div>
      </Modal>
    </div>
  );
}
