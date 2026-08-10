import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Button,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Spin,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  RightOutlined,
  LeftOutlined,
  CalendarOutlined,
  UserOutlined,
  LinkOutlined,
  CheckSquareOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import type { Project } from '../../../types/project';
import type { ProjectTodo, ProjectTodoCreate, ProjectTodoUpdate } from '../../../types/project-todo';
import type { User } from '../../../types/user';
import type { ProjectProposal } from '../../../types/project-proposal';
import {
  listProjectTodos,
  createProjectTodo,
  updateProjectTodo,
  deleteProjectTodo,
} from '../../../api/project-todos';
import { listProjectProposals } from '../../../api/project-proposals';
import { listUsers } from '../../../api/users';
import { TODO_PRIORITY_OPTIONS, TODO_STATUS_OPTIONS, PROJECT_NUMBER_PREFIX } from '../../../constants/project';
import { getUserId, isAdmin } from '../../../utils/auth';
import styles from './TodoTaskTab.module.css';

const { Text } = Typography;
const { TextArea } = Input;

/** 看板三列状态 */
const BOARD_COLUMNS = ['pending', 'in_progress', 'completed'] as const;
type TodoStatus = (typeof BOARD_COLUMNS)[number];

const PRIORITY_COLOR: Record<string, string> = {
  P0: 'red',
  P1: 'volcano',
  P2: 'gold',
  P3: 'default',
  P4: 'default',
};

/** 状态流转方向：前进一步 / 后退一步 */
const STATUS_NEXT: Record<string, TodoStatus> = {
  pending: 'in_progress',
  in_progress: 'completed',
  completed: 'in_progress',
};
const STATUS_PREV: Record<string, TodoStatus> = {
  pending: 'in_progress',
  in_progress: 'pending',
  completed: 'in_progress',
};

const statusLabel = (status: string): string =>
  TODO_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;

/** 生成待办编号：TOD-{项目编号}-{序号} */
function buildTodoNumber(project: Project, existing: ProjectTodo[]): string {
  const projectNum = project.number || 'PRJ';
  const prefix = `${PROJECT_NUMBER_PREFIX.todo}${projectNum}-`;
  let maxSeq = 0;
  for (const t of existing) {
    if (t.number.startsWith(prefix)) {
      const seq = parseInt(t.number.slice(prefix.length), 10);
      if (!Number.isNaN(seq)) maxSeq = Math.max(maxSeq, seq);
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

export default function TodoTaskTab({ project }: { project: Project }) {
  // ── 数据状态 ──
  const [todos, setTodos] = useState<ProjectTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [proposals, setProposals] = useState<ProjectProposal[]>([]);

  // ── UI 状态 ──
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTodo, setEditingTodo] = useState<ProjectTodo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // ── 权限 ──
  const currentUserId = getUserId();
  const isOwner = project.owner_id === currentUserId;
  const isAdminUser = isAdmin();
  const todosPermission = project.member_permissions?.todos;
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
    for (const t of todos) {
      const key = BOARD_COLUMNS.includes(t.status as TodoStatus) ? t.status : 'pending';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return groups;
  }, [todos]);

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

  // ── 新建/编辑 Modal ──
  const handleOpenCreate = useCallback(() => {
    setEditingTodo(null);
    form.resetFields();
    form.setFieldsValue({ priority: 'P2' });
    setModalVisible(true);
  }, [form]);

  const handleOpenEdit = useCallback(
    (todo: ProjectTodo) => {
      setEditingTodo(todo);
      form.setFieldsValue({
        title: todo.title,
        description: todo.description ?? undefined,
        priority: todo.priority,
        assignee_id: todo.assignee_id ?? undefined,
        proposal_id: todo.proposal_id ?? undefined,
        due_date: todo.due_date ? dayjs(todo.due_date) : undefined,
      });
      setModalVisible(true);
    },
    [form],
  );

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setEditingTodo(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    let values: {
      title: string;
      description?: string;
      priority?: string;
      assignee_id?: string;
      proposal_id?: string;
      due_date?: Dayjs;
    };
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验未通过，Modal 会显示错误
    }
    setSubmitting(true);
    try {
      if (editingTodo) {
        const payload: ProjectTodoUpdate = {
          title: values.title,
          ...(values.description?.trim() ? { description: values.description.trim() } : {}),
          ...(values.priority ? { priority: values.priority } : {}),
          ...(values.assignee_id ? { assignee_id: values.assignee_id } : {}),
          ...(values.proposal_id ? { proposal_id: values.proposal_id } : {}),
          ...(values.due_date ? { due_date: values.due_date.format('YYYY-MM-DD') } : {}),
        };
        const res = await updateProjectTodo(editingTodo.id, payload);
        if (res.code === 0) {
          message.success('待办已更新');
          setModalVisible(false);
          void fetchTodos();
        } else {
          message.error(res.msg || '更新待办失败');
        }
      } else {
        const payload: ProjectTodoCreate = {
          project_id: project.id,
          number: buildTodoNumber(project, todos),
          title: values.title,
          priority: values.priority ?? 'P2',
          status: 'pending',
          ...(values.description?.trim() ? { description: values.description.trim() } : {}),
          ...(values.assignee_id ? { assignee_id: values.assignee_id } : {}),
          ...(values.proposal_id ? { proposal_id: values.proposal_id } : {}),
          ...(values.due_date ? { due_date: values.due_date.format('YYYY-MM-DD') } : {}),
        };
        const res = await createProjectTodo(payload);
        if (res.code === 0) {
          message.success('待办已创建');
          setModalVisible(false);
          void fetchTodos();
        } else {
          message.error(res.msg || '创建待办失败');
        }
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '保存待办失败');
    } finally {
      setSubmitting(false);
    }
  }, [form, editingTodo, project, todos, fetchTodos]);

  // ── 删除 ──
  const handleDelete = useCallback(
    (todo: ProjectTodo) => {
      Modal.confirm({
        title: '确认删除待办',
        icon: <ExclamationCircleOutlined />,
        content: `确定要删除待办「${todo.title}」吗？此操作不可撤销。`,
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          try {
            const res = await deleteProjectTodo(todo.id);
            if (res.code === 0) {
              message.success('待办已删除');
              void fetchTodos();
            } else {
              message.error(res.msg || '删除待办失败');
            }
          } catch (err: unknown) {
            message.error(err instanceof Error ? err.message : '删除待办失败');
          }
        },
      });
    },
    [fetchTodos],
  );

  // ── 状态流转 ──
  const handleMoveStatus = useCallback(
    async (todo: ProjectTodo, nextStatus: TodoStatus) => {
      try {
        const res = await updateProjectTodo(todo.id, { status: nextStatus });
        if (res.code === 0) {
          message.success(`已流转为「${statusLabel(nextStatus)}」`);
          void fetchTodos();
        } else {
          message.error(res.msg || '状态流转失败');
        }
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : '状态流转失败');
      }
    },
    [fetchTodos],
  );

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
      <div key={todo.id} className={styles.card ?? ''}>
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

        {canOperate && (
          <div className={styles.cardActions ?? ''}>
            <div className={styles.cardActionsGroup ?? ''}>
              {todo.status !== 'pending' && STATUS_PREV[todo.status] && (
                <Tooltip title={`回到「${statusLabel(STATUS_PREV[todo.status]!)}」`}>
                  <Button
                    type="text"
                    size="small"
                    icon={<LeftOutlined />}
                    aria-label="上一步"
                    onClick={() => void handleMoveStatus(todo, STATUS_PREV[todo.status]!)}
                  />
                </Tooltip>
              )}
              {todo.status !== 'completed' && STATUS_NEXT[todo.status] && (
                <Tooltip title={`进入「${statusLabel(STATUS_NEXT[todo.status]!)}」`}>
                  <Button
                    type="text"
                    size="small"
                    icon={<RightOutlined />}
                    aria-label="下一步"
                    onClick={() => void handleMoveStatus(todo, STATUS_NEXT[todo.status]!)}
                  />
                </Tooltip>
              )}
            </div>
            <div className={styles.cardActionsGroup ?? ''}>
              <Tooltip title="编辑">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  aria-label="编辑"
                  onClick={() => handleOpenEdit(todo)}
                />
              </Tooltip>
              <Tooltip title="删除">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label="删除"
                  onClick={() => handleDelete(todo)}
                />
              </Tooltip>
            </div>
          </div>
        )}
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
        {canOperate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            新建待办
          </Button>
        )}
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

      {/* 新建/编辑 Modal */}
      <Modal
        title={editingTodo ? '编辑待办' : '新建待办'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={handleCloseModal}
        confirmLoading={submitting}
        okText="保存"
        cancelText="取消"
        destroyOnClose
        width={560}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入待办标题' }]}
          >
            <Input placeholder="请输入待办标题" maxLength={200} showCount />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea
              placeholder="请输入描述（可选）"
              rows={3}
              maxLength={2000}
              showCount
            />
          </Form.Item>
          <Form.Item name="priority" label="优先级">
            <Select options={[...TODO_PRIORITY_OPTIONS]} />
          </Form.Item>
          <Form.Item name="assignee_id" label="执行人">
            <Select
              placeholder="选择执行人（可选）"
              allowClear
              options={users.map((u) => ({
                value: u.id,
                label: u.username ? `${u.nickname} (${u.username})` : u.nickname,
              }))}
            />
          </Form.Item>
          <Form.Item name="due_date" label="截止日期">
            <DatePicker style={{ width: '100%' }} placeholder="选择截止日期（可选）" />
          </Form.Item>
          <Form.Item name="proposal_id" label="关联提案">
            <Select
              placeholder="选择关联提案（可选）"
              allowClear
              options={proposals.map((p) => ({
                value: p.id,
                label: `${p.number} ${p.title}`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
