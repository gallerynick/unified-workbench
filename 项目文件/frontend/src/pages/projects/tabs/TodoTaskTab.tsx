import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Empty,
  Input,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  PlusOutlined,
  CalendarOutlined,
  UserOutlined,
  LinkOutlined,
  CheckSquareOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Project } from '../../../types/project';
import type { ProjectTodo } from '../../../types/project-todo';
import type { User } from '../../../types/user';
import type { ProjectProposal } from '../../../types/project-proposal';
import { listProjectTodos } from '../../../api/project-todos';
import { listProjectProposals } from '../../../api/project-proposals';
import { listUsers } from '../../../api/users';
import { TODO_STATUS_OPTIONS, PRIORITY_COLOR } from '../../../constants/project';
import { getUserId, isAdmin } from '../../../utils/auth';
import { useUser } from '../../../contexts/UserContext';
import TodoModal from '../components/TodoModal';
import styles from './TodoTaskTab.module.css';

const { Text } = Typography;

/** 看板三列状态 */
const BOARD_COLUMNS = ['pending', 'in_progress', 'completed'] as const;
type TodoStatus = (typeof BOARD_COLUMNS)[number];

const statusLabel = (status: string): string =>
  TODO_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;

export default function TodoTaskTab({ project }: { project: Project }) {
  const { user } = useUser();
  const navigate = useNavigate();
  // ── 数据状态 ──
  const [todos, setTodos] = useState<ProjectTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [proposals, setProposals] = useState<ProjectProposal[]>([]);

  // ── UI 状态 ──
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTodo, setEditingTodo] = useState<ProjectTodo | null>(null);

  // ── 权限 ──
  const currentUserId = getUserId();
  const isOwner = project.owner_id === currentUserId;
  const isAdminUser = isAdmin();
  const todosPermission = project.member_permissions?.[user?.id ?? '']?.todos;
  /** 负责人/管理员全权限；成员按 todos 分区（readonly 禁用操作）；未配置默认允许 */
  const canOperate = isAdminUser || isOwner || todosPermission !== 'readonly';

  // ── 派生数据 ──
  const userMap = useMemo(() => {
    const m: Record<string, User> = {};
    for (const u of users) m[u.id] = u;
    return m;
  }, [users]);

  const proposalMap = useMemo(() => {
    const m: Record<string, ProjectProposal> = {};
    for (const p of proposals) m[p.id] = p;
    return m;
  }, [proposals]);

  const byStatus = useMemo(() => {
    const groups: Record<string, ProjectTodo[]> = { pending: [], in_progress: [], completed: [] };
    const kw = searchText.trim().toLowerCase();
    for (const t of todos) {
      if (kw && !t.title.toLowerCase().includes(kw) && !t.number.toLowerCase().includes(kw)) {
        continue;
      }
      const key = BOARD_COLUMNS.includes(t.status as TodoStatus) ? t.status : 'pending';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return groups;
  }, [todos, searchText]);

  // ── 数据加载 ──
  const fetchTodos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listProjectTodos({ project_id: project.id, page: 1, page_size: 100 });
      if (res.code === 0) {
        setTodos(res.data.items);
      } else {
        message.error(res.msg || '加载待办失败');
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '加载待办失败');
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    void fetchTodos();

    listUsers({ page: 1, page_size: 100 })
      .then((res) => {
        if (res.code === 0) setUsers(res.data.items);
      })
      .catch(() => {
        // 用户列表加载失败不阻断看板
      });

    listProjectProposals({ project_id: project.id, page: 1, page_size: 100 })
      .then((res) => {
        if (res.code === 0) setProposals(res.data.items);
      })
      .catch(() => {
        // 提案列表加载失败不阻断看板
      });
  }, [fetchTodos, project.id]);

  // ── 工具函数 ──
  const getUserLabel = (id: string | null): string | null => {
    if (!id) return null;
    const u = userMap[id];
    if (!u) return id.slice(0, 8);
    return u.username ? `${u.nickname} (${u.username})` : u.nickname;
  };

  // ── 新建/编辑 Modal（由共用组件 TodoModal 承载） ──
  const handleOpenCreate = useCallback(() => {
    setEditingTodo(null);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setEditingTodo(null);
  }, []);

  const handleSaved = useCallback(() => {
    void fetchTodos();
  }, [fetchTodos]);

  // ── 删除 ──
  // ── 卡片渲染 ──
  const renderCard = (todo: ProjectTodo) => {
    const proposal = todo.proposal_id ? proposalMap[todo.proposal_id] : undefined;
    const dueOverdue = todo.due_date ? dayjs(todo.due_date).isBefore(dayjs(), 'day') : false;
    // 已完成但截止日期未填或已过期 → 提示色
    const dueWarning = todo.status === 'completed' && (!todo.due_date || dueOverdue);
    const dueText = todo.due_date
      ? dayjs(todo.due_date).format('YYYY-MM-DD')
      : '未设置截止日期';

    return (
      <div
        key={todo.id}
        className={styles.card ?? ''}
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/projects/${project.id}/todo/${todo.id}`)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate(`/projects/${project.id}/todo/${todo.id}`);
          }
        }}
      >
        <div className={styles.cardHeader ?? ''}>
          <div className={styles.cardTitle ?? ''}>{todo.title}</div>
          <div className={styles.cardNumber ?? ''}>{todo.number}</div>
        </div>

        <div className={styles.cardMeta ?? ''}>
          <Tag color={PRIORITY_COLOR[todo.priority] || 'default'}>
            {todo.priority}
          </Tag>
          {todo.assignee_id && (
            <span className={styles.cardMetaItem ?? ''}>
              <UserOutlined />
              {getUserLabel(todo.assignee_id)}
            </span>
          )}
          <span className={dueWarning ? (styles.cardMetaWarning ?? '') : (styles.cardMetaItem ?? '')}>
            <CalendarOutlined />
            {dueText}
            {dueWarning && ' · 已完成但超期'}
          </span>
          {proposal && (
            <Tooltip title={`关联提案：${proposal.title}`}>
              <span className={styles.cardMetaItem ?? ''}>
                <LinkOutlined />
                {proposal.number}
              </span>
            </Tooltip>
          )}
        </div>

      </div>
    );
  };

  const renderColumn = (status: TodoStatus) => {
    const items = byStatus[status] ?? [];
    return (
      <div key={status} className={styles.column ?? ''}>
        <div className={styles.columnHeader ?? ''}>
          <span className={styles.columnTitle ?? ''}>
            <CheckSquareOutlined style={{ color: 'var(--text-secondary)' }} />
            <Text strong style={{ fontSize: 'var(--text-body-sm-size)' }}>
              {statusLabel(status)}
            </Text>
          </span>
          <span className={styles.columnCount ?? ''}>{items.length}</span>
        </div>
        {items.length === 0 ? (
          <div className={styles.columnEmpty ?? ''}>暂无待办</div>
        ) : (
          items.map(renderCard)
        )}
      </div>
    );
  };

  const completedCount = (byStatus.completed ?? []).length;

  return (
    <>
      {/* 顶栏 */}
      <div className={styles.toolbar ?? ''}>
        <div className={styles.toolbarTitle ?? ''}>
          <Text strong style={{ fontSize: 'var(--text-heading-4-size)' }}>
            待办任务
          </Text>
          <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
            共 {todos.length} 项 · 已完成 {completedCount} 项
          </Text>
          {!canOperate && (
            <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
              当前为只读权限
            </Text>
          )}
        </div>
        <Space>
          <Input
            className={styles.searchInput ?? ''}
            variant="filled"
            placeholder="搜索待办..."
            prefix={<SearchOutlined style={{ color: 'var(--text-secondary)' }} />}
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
            }}
            allowClear
          />
          {canOperate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
              新建待办
            </Button>
          )}
        </Space>
      </div>

      {/* 看板 */}
      {loading ? (
        <div className={styles.loadingWrap ?? ''}>
          <Spin />
        </div>
      ) : todos.length === 0 ? (
        <Empty description="暂无待办任务">
          {canOperate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
              创建第一个待办
            </Button>
          )}
        </Empty>
      ) : (
        <div className={styles.board ?? ''}>
          {BOARD_COLUMNS.map(renderColumn)}
        </div>
      )}

      {/* 新建待办（共用组件 TodoModal） */}
      <TodoModal
        project={project}
        open={modalVisible}
        editingTodo={editingTodo}
        existingTodos={todos}
        onClose={handleCloseModal}
        onSaved={handleSaved}
      />
    </>
  );
}
