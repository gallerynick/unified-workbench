import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import {
  Button,
  Select,
  Tag,
  Typography,
  Modal,
  message,
  Space,
  Tooltip,
  Tabs,
  Pagination,
  Empty,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
  CalendarOutlined,
  TagOutlined,
  ClockCircleOutlined,
  DownOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { listTasks, updateTask, deleteTask } from '../../api/tasks';
import type { Task, TaskStatus, TaskPriority } from '../../types/task';
import { getVisibilityConfig } from '../../utils/visibility';
import { getUserId } from '../../utils/auth';
import TaskModal from './TaskModal';
import styles from './TaskManagement.module.css';

const { Paragraph, Text } = Typography;

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

const STATUS_OPTIONS = Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.text }));
const PRIORITY_OPTIONS = Object.entries(PRIORITY_MAP).map(([k, v]) => ({ value: k, label: v.text }));

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN');
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('zh-CN');
}

interface TaskCardProps {
  task: Task;
  canManage: boolean;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
}

/**
 * 单条任务卡片：标题与任务描述直接平铺展示，不必进入编辑弹窗。
 * 描述超过 3 行时折叠，可「展开 / 收起」。
 */
function TaskCard({ task, canManage, onEdit, onDelete, onStatusChange }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const descRef = useRef<HTMLDivElement>(null);

  // 仅当描述确实被截断时才显示「展开」，避免空按钮
  useLayoutEffect(() => {
    const el = descRef.current;
    if (!el) {
      setOverflowing(false);
      return;
    }
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [task.description, expanded]);

  const description = (task.description ?? '').trim();
  const visibility = getVisibilityConfig(task.visibility ?? 'private');
  const restrictedHint = task.visibility === 'restricted'
    ? `指定用户可见（${task.restricted_users?.length ?? 0} 人）`
    : visibility.description;

  return (
    <div className={styles.card ?? ''}>
      <div className={styles.cardBody ?? ''}>
        <div className={styles.cardHead ?? ''}>
          <Select
            value={task.status}
            size="small"
            className={styles.statusSelect ?? ''}
            disabled={!canManage}
            onChange={(v) => onStatusChange(task, v as TaskStatus)}
            options={STATUS_OPTIONS}
          />
          <Text className={styles.cardTitle ?? ''} strong ellipsis={{ tooltip: task.title }}>
            {task.title}
          </Text>
          <div className={styles.cardHeadRight ?? ''}>
            <Tag color={PRIORITY_MAP[task.priority].color}>{PRIORITY_MAP[task.priority].text}</Tag>
            <Tooltip title={restrictedHint}>
              <Tag color={visibility.color}>{visibility.text}</Tag>
            </Tooltip>
            {canManage ? (
              <Space size="small">
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(task)}>
                  编辑
                </Button>
                <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(task)}>
                  删除
                </Button>
              </Space>
            ) : (
              <Tooltip title="仅创建者可编辑或删除">
                <Text type="secondary" className={styles.readonlyText ?? ''}>
                  只读
                </Text>
              </Tooltip>
            )}
          </div>
        </div>

        {description ? (
          <div className={styles.cardDesc ?? ''}>
            <div
              ref={descRef}
              className={[styles.descText ?? '', !expanded ? styles.descClamped : ''].filter(Boolean).join(' ')}
            >
              {description}
            </div>
            {expanded ? (
              <Button type="link" size="small" className={styles.descToggle ?? ''} onClick={() => setExpanded(false)}>
                收起 <UpOutlined />
              </Button>
            ) : overflowing ? (
              <Button type="link" size="small" className={styles.descToggle ?? ''} onClick={() => setExpanded(true)}>
                展开 <DownOutlined />
              </Button>
            ) : null}
          </div>
        ) : (
          <div className={[styles.cardDesc ?? '', styles.descEmpty ?? ''].join(' ')}>
            <Text type="secondary">未填写任务描述</Text>
          </div>
        )}

        <div className={styles.cardMeta ?? ''}>
          {task.due_date ? (
            <span className={styles.metaItem ?? ''}>
              <CalendarOutlined />
              截止 {formatDate(task.due_date)}
            </span>
          ) : null}
          {task.tags && task.tags.length > 0 ? (
            <span className={styles.metaItem ?? ''}>
              <TagOutlined />
              <span className={styles.metaTags}>
                {task.tags.map((tag) => (
                  <Tag key={tag} bordered={false}>
                    {tag}
                  </Tag>
                ))}
              </span>
            </span>
          ) : null}
          <span className={styles.metaItem ?? ''}>
            <ClockCircleOutlined />
            创建 {formatDateTime(task.created_at)}
          </span>
          {task.updated_at !== task.created_at ? (
            <span className={styles.metaItem ?? ''}>
              更新 {formatDateTime(task.updated_at)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

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
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
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

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <div className={styles.headerLeft ?? ''}>
          <Text className={styles.title ?? ''} strong>任务中心</Text>
          <Text type="secondary" className={styles.subtitle ?? ''}>标题与任务详情直接展示，无需进入编辑</Text>
        </div>
        <Space wrap>
          <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} placeholder="状态筛选" allowClear style={{ width: 120 }}
            options={[{ value: '', label: '全部' }, ...STATUS_OPTIONS]}
          />
          <Select value={priorityFilter} onChange={(v) => { setPriorityFilter(v); setPage(1); }} placeholder="优先级筛选" allowClear style={{ width: 120 }}
            options={[{ value: '', label: '全部' }, ...PRIORITY_OPTIONS]}
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

      <div className={styles.listWrap ?? ''}>
        <Spin spinning={loading}>
          {tasks.length === 0 && !loading ? (
            <div className={styles.empty ?? ''}>
              <Empty description="暂无任务，点击右上角「新建任务」创建第一条" />
            </div>
          ) : (
            <div className={styles.list ?? ''}>
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  canManage={canManage(task)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </Spin>

        {total > 0 ? (
          <div className={styles.pager ?? ''}>
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger
              showQuickJumper
              showTotal={(t) => `共 ${t} 条`}
              onChange={(p, ps) => { setPage(p); setPageSize(ps); }}
            />
          </div>
        ) : null}
      </div>

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
          <Text className={styles.permissionHeading ?? ''} strong>创建者权限</Text>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>创建者拥有该任务的完整管理权限：编辑内容、调整状态、删除任务、设置可见范围。</Paragraph>
          <Text className={styles.permissionHeading ?? ''} strong>其他成员</Text>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>非创建者只能查看自己可见范围内的任务，不能编辑、调整状态或删除。</Paragraph>
          <Text className={styles.permissionHeading ?? ''} strong>可见范围</Text>
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
          <Text className={styles.permissionHeading ?? ''} strong>管理员</Text>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>系统管理员不享有额外权限：只能管理自己创建的任务；对公开或指定给自己的任务同样只读。</Paragraph>
          <Text className={styles.permissionHeading ?? ''} strong>创建权限</Text>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>所有成员都可以创建任务，创建时可设定可见范围，默认为私有。</Paragraph>
        </div>
      </Modal>
    </div>
  );
}
