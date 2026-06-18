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
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { listReminders, deleteReminder } from '../../api/reminders';
import type { Reminder, ReminderStatus } from '../../types/reminder';
import ReminderFormModal from './ReminderFormModal';
import styles from './ReminderManagement.module.css';

const { Title } = Typography;

const STATUS_TAG_MAP: Record<ReminderStatus, { color: string; text: string }> = {
  pending: { color: 'default', text: '待发送' },
  sent: { color: 'success', text: '已发送' },
  failed: { color: 'error', text: '发送失败' },
  cancelled: { color: 'default', text: '已取消' },
};

const TRIGGER_TYPE_MAP: Record<string, string> = {
  timed: '定时触发',
  event: '事件触发',
};

const CHANNEL_TAG_MAP: Record<string, string> = {
  websocket: '站内通知',
  feishu: '飞书',
  dingtalk: '钉钉',
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
      title: '触发类型',
      dataIndex: 'trigger_type',
      key: 'trigger_type',
      width: 100,
      render: (type: string) => TRIGGER_TYPE_MAP[type] ?? type,
    },
    {
      title: '触发时间',
      dataIndex: 'trigger_time',
      key: 'trigger_time',
      width: 180,
      render: (time: string | null) => (time ? new Date(time).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '通知渠道',
      dataIndex: 'channels',
      key: 'channels',
      width: 180,
      render: (channels: Reminder['channels']) => (
        <Space size={[0, 4]} wrap>
          {channels?.map((ch) => (
            <Tag key={ch}>{CHANNEL_TAG_MAP[ch] ?? ch}</Tag>
          )) ?? '-'}
        </Space>
      ),
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
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>
          提醒管理
        </Title>
        <Space>
          <Input
            placeholder="搜索标题"
            prefix={<SearchOutlined />}
            allowClear
            className={styles.searchInput ?? ''}
            onChange={(e) => handleSearch(e.target.value)}
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
    </div>
  );
}
