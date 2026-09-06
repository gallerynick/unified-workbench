import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Empty,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  deleteProjectEvent,
  listProjectEvents,
} from '../../../api/project-events';
import { listUsers } from '../../../api/users';
import { EVENT_TYPE_OPTIONS } from '../../../constants/project';
import { useUser } from '../../../contexts/UserContext';
import type { Project } from '../../../types/project';
import type { ProjectEvent } from '../../../types/project-event';
import type { User } from '../../../types/user';
import styles from './ProjectEventTab.module.css';
import EventModal from '../components/EventModal';

const { Text } = Typography;

// ─── 常量 ─────────────────────────────────────────────────────────

/** 事件类型标签颜色（由 antd Tag 语义色自适应深浅色模式） */
const EVENT_TYPE_COLOR: Record<string, string> = {
  handover: 'blue',
  archive: 'orange',
  close: 'red',
  reopen: 'green',
  owner_change: 'purple',
  other: 'default',
};

/** 事件类型选项转可变数组（as const 只读数组无法直接赋给 Select options） */
const eventTypeOptions: { value: string; label: string }[] = EVENT_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

// ─── 工具函数 ─────────────────────────────────────────────────────

/** 根据选项数组反查中文标签，查不到则原样返回 */
function getLabel(
  options: { value: string; label: string }[],
  value: string | null | undefined,
): string {
  if (!value) return '-';
  return options.find((o) => o.value === value)?.label ?? value;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}


export default function ProjectEventTab({ project }: { project: Project }) {
  const { user } = useUser();

  // ── 数据状态 ──
  const [events, setEvents] = useState<ProjectEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  // ── 弹窗状态（共用组件 EventModal） ──
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ProjectEvent | null>(null);

  // 权限：负责人 + 管理员全权限；普通成员按 member_permissions.events 分区，readonly 时只读
  const isOwner = !!user && user.id === project.owner_id;
  const isAdmin = user?.role === 'admin';
  const eventsPerm = project.member_permissions?.[user?.id ?? '']?.events;
  const canOperate = isOwner || isAdmin || eventsPerm !== 'readonly';

  // ── 数据加载 ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [eventRes, userRes] = await Promise.all([
        listProjectEvents({ project_id: project.id, page_size: 100 }),
        listUsers({ page_size: 100 }),
      ]);
      if (eventRes.code === 0) {
        setEvents(eventRes.data.items);
      } else {
        message.error(eventRes.msg || '获取项目事件失败');
      }
      if (userRes.code === 0) {
        setUsers(userRes.data.items);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取项目事件失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ── 派生数据 ──
  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  const displayName = useCallback(
    (id: string | null | undefined): string => {
      if (!id) return '-';
      const u = userMap.get(id);
      if (u) return u.nickname || u.username;
      return `${id.slice(0, 8)}...`;
    },
    [userMap],
  );


  const filteredEvents = useMemo(() => {
    const kw = searchText.trim().toLowerCase();
    if (!kw) return events;
    return events.filter((ev) => {
      const detailsText = Object.values(ev.details ?? {})
        .map((v) => (typeof v === 'string' ? v : JSON.stringify(v ?? '')))
        .join(' ');
      return (
        ev.title.toLowerCase().includes(kw) ||
        (ev.number ?? '').toLowerCase().includes(kw) ||
        detailsText.toLowerCase().includes(kw)
      );
    });
  }, [events, searchText]);

  // ── 打开新建/编辑（弹窗共用 EventModal） ──
  const openCreate = useCallback(() => {
    setEditingEvent(null);
    setEventModalOpen(true);
  }, []);

  const openEdit = useCallback((record: ProjectEvent) => {
    setEditingEvent(record);
    setEventModalOpen(true);
  }, []);

  // ── 删除 ──
  const handleDelete = useCallback(
    (record: ProjectEvent) => {
      Modal.confirm({
        title: '确认删除事件',
        icon: <ExclamationCircleOutlined />,
        content: `确定要删除事件「${record.number} ${record.title}」吗？此操作不可恢复。`,
        okText: '删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
          try {
            const res = await deleteProjectEvent(record.id);
            if (res.code === 0) {
              message.success('事件已删除');
              void fetchData();
            } else {
              message.error(res.msg || '删除失败');
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '删除失败';
            message.error(msg);
          }
        },
      });
    },
    [fetchData],
  );

  // ── 列定义 ──
  const columns = useMemo<ColumnsType<ProjectEvent>>(
    () => [
      {
        title: '编号',
        dataIndex: 'number',
        key: 'number',
        width: 200,
        render: (number: string) => <Text strong>{number}</Text>,
      },
      {
        title: '标题',
        dataIndex: 'title',
        key: 'title',
        ellipsis: true,
        render: (title: string) => <span className={styles.titleCell ?? ''}>{title}</span>,
      },
      {
        title: '事件类型',
        dataIndex: 'event_type',
        key: 'event_type',
        width: 120,
        render: (eventType: string) => (
          <Tag color={EVENT_TYPE_COLOR[eventType] ?? 'default'}>
            {getLabel(eventTypeOptions, eventType)}
          </Tag>
        ),
      },
      {
        title: '操作人',
        dataIndex: 'operator_id',
        key: 'operator_id',
        width: 140,
        render: (id: string) => displayName(id),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 170,
        render: (time: string) => formatDate(time),
      },
      {
        title: '操作',
        key: 'actions',
        width: 140,
        align: 'right',
        render: (_, record) => {
          if (!canOperate) return null;
          return (
            <Space size="small" wrap>
              <Tooltip title="编辑">
                <Button
                  size="small"
                  type="link"
                  icon={<EditOutlined />}
                  aria-label="编辑"
                  onClick={() => openEdit(record)}
                />
              </Tooltip>
              <Tooltip title="删除">
                <Button
                  size="small"
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label="删除"
                  onClick={() => handleDelete(record)}
                />
              </Tooltip>
            </Space>
          );
        },
      },
    ],
    [canOperate, displayName, openEdit, handleDelete],
  );

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.toolbar ?? ''}>
        <Space>
          <span className={styles.toolbarLeft ?? ''}>
            <SwapOutlined style={{ color: 'var(--text-secondary)' }} />
            <Text type="secondary">共 {events.length} 条事件记录</Text>
          </span>
          <Input
            className={styles.searchInput ?? ''}
            variant="filled"
            placeholder="搜索事件..."
            prefix={<SearchOutlined style={{ color: 'var(--text-secondary)' }} />}
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
            }}
            allowClear
          />
        </Space>
        <Space>
          {canOperate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新增事件
            </Button>
          )}
        </Space>
      </div>

      <Table<ProjectEvent>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={filteredEvents}
        className={styles.table ?? ''}
        pagination={{
          pageSize: 8,
          pageSizeOptions: [8, 10, 20, 50],
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        scroll={{ x: 880 }}
        locale={{ emptyText: <Empty description="暂无项目事件" /> }}
      />

      {/* 新建/编辑 事件（共用组件 EventModal，含移交动态表单） */}
      <EventModal
        project={project}
        open={eventModalOpen}
        editingEvent={editingEvent}
        existingEvents={events}
        onClose={() => setEventModalOpen(false)}
        onSaved={() => void fetchData()}
      />
    </div>
  );
}
