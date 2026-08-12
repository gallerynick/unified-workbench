import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Typography,
  Modal,
  Form,
  message,
  Tooltip,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  LinkOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Project } from '../../../types/project';
import type { ProjectProposal } from '../../../types/project-proposal';
import type { ProjectTodo } from '../../../types/project-todo';
import type { User } from '../../../types/user';
import {
  listProjectProposals,
  createProjectProposal,
  updateProjectProposal,
  deleteProjectProposal,
} from '../../../api/project-proposals';
import { listProjectTodos } from '../../../api/project-todos';
import { listUsers } from '../../../api/users';
import { useUser } from '../../../contexts/UserContext';
import styles from './ProposalTab.module.css';
import {
  PROPOSAL_TYPE_OPTIONS,
  PROPOSAL_PRIORITY_OPTIONS,
  PROPOSAL_STATUS_OPTIONS,
  TODO_STATUS_OPTIONS,
  PROJECT_NUMBER_PREFIX,
} from '../../../constants/project';

const { Text } = Typography;
const { TextArea } = Input;

// ─── 标签颜色映射（与深浅色模式无关，由 antd Tag 语义色自适应） ─────────

const TYPE_COLOR: Record<string, string> = {
  feature: 'blue',
  bug: 'red',
  improvement: 'green',
  removal: 'orange',
  other: 'default',
};

const PRIORITY_COLOR: Record<string, string> = {
  P0: 'red',
  P1: 'volcano',
  P2: 'orange',
  P3: 'gold',
  P4: 'default',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'processing',
  approved: 'success',
  rejected: 'error',
  completed: 'default',
};

const TODO_STATUS_COLOR: Record<string, string> = {
  pending: 'default',
  in_progress: 'processing',
  completed: 'success',
};

// ─── 工具函数 ────────────────────────────────────────────────────────

/** 常量选项转为可变数组（as const 只读数组无法直接赋给 Select options） */
const typeOptions: { value: string; label: string }[] = PROPOSAL_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));
const priorityOptions: { value: string; label: string }[] = PROPOSAL_PRIORITY_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));
const statusOptions: { value: string; label: string }[] = PROPOSAL_STATUS_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));
const todoStatusOptions: { value: string; label: string }[] = TODO_STATUS_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

/** 根据选项数组反查中文标签，查不到则原样返回 */
function getLabel(
  options: { value: string; label: string }[],
  value: string | null | undefined,
): string {
  if (!value) return '-';
  return options.find((o) => o.value === value)?.label ?? value;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 生成提案编号：PRP-{项目编号}-{项目内序号}
 * 序号 = 当前列表中该前缀下最大序号 + 1
 */
function buildProposalNumber(project: Project, proposals: ProjectProposal[]): string {
  const projTag = project.number ?? project.id.slice(0, 8).toUpperCase();
  const prefix = `${PROJECT_NUMBER_PREFIX.proposal}${projTag}-`;
  let maxSeq = 0;
  for (const p of proposals) {
    if (p.number?.startsWith(prefix)) {
      const seq = parseInt(p.number.slice(prefix.length), 10);
      if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

interface ProposalFormValues {
  title: string;
  type: string;
  priority: string;
  description?: string;
  attachment_links?: string[];
  assignee_id?: string;
}

export default function ProposalTab({ project }: { project: Project }) {
  const { user } = useUser();

  // ── 数据状态 ──
  const [proposals, setProposals] = useState<ProjectProposal[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [todos, setTodos] = useState<ProjectTodo[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // ── 筛选状态（空字符串表示"全部"） ──
  const [filters, setFilters] = useState<{ type: string; priority: string; status: string }>({
    type: '',
    priority: '',
    status: '',
  });
  const [search, setSearch] = useState('');

  // ── 新建/编辑 ──
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<ProjectProposal | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<ProposalFormValues>();

  // ── 拒绝弹窗 ──
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ProjectProposal | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── 关联待办弹窗 ──
  const [todoModalVisible, setTodoModalVisible] = useState(false);
  const [todoTarget, setTodoTarget] = useState<ProjectProposal | null>(null);

  // ── 权限：负责人+管理员始终可操作；普通成员按 member_permissions.proposals 分区 ──
  const isOwner = !!user && project.owner_id === user.id;
  const isAdmin = user?.role === 'admin';
  const proposalsPerm = project.member_permissions?.[user?.id ?? '']?.proposals;
  const canOperate = isOwner || isAdmin || proposalsPerm !== 'readonly';

  // ── 数据拉取 ──
  const fetchData = useCallback(async () => {
    setProposalsLoading(true);
    try {
      const [proposalRes, todoRes, userRes] = await Promise.all([
        listProjectProposals({ project_id: project.id, page_size: 100 }),
        listProjectTodos({ project_id: project.id, page_size: 100 }),
        listUsers({ page_size: 100 }),
      ]);
      if (proposalRes.code === 0) {
        setProposals(proposalRes.data.items);
      } else {
        message.error(proposalRes.msg || '获取提案列表失败');
      }
      if (todoRes.code === 0) {
        setTodos(todoRes.data.items);
      }
      if (userRes.code === 0) {
        setUsers(userRes.data.items);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取提案数据失败';
      message.error(msg);
    } finally {
      setProposalsLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ── 派生数据 ──
  const userMap = useMemo(() => {
    const map: Record<string, User> = {};
    for (const u of users) map[u.id] = u;
    return map;
  }, [users]);

  const displayName = useCallback(
    (id: string | null | undefined): string => {
      if (!id) return '-';
      const u = userMap[id];
      return u ? u.nickname || u.username : `${id.slice(0, 8)}...`;
    },
    [userMap],
  );

  /** 每个提案关联的待办数量 */
  const todoCountByProposal = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of todos) {
      if (t.proposal_id) {
        map[t.proposal_id] = (map[t.proposal_id] ?? 0) + 1;
      }
    }
    return map;
  }, [todos]);

  /** 按类型/优先级/状态 + 关键词（标题/编号）过滤后的列表 */
  const filteredProposals = useMemo(() => {
    let list = proposals;
    if (filters.type) list = list.filter((p) => p.type === filters.type);
    if (filters.priority) list = list.filter((p) => p.priority === filters.priority);
    if (filters.status) list = list.filter((p) => p.status === filters.status);
    const kw = search.trim().toLowerCase();
    if (kw) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(kw) ||
          p.number.toLowerCase().includes(kw),
      );
    }
    return list;
  }, [proposals, filters, search]);

  const relatedTodos = useMemo(
    () => (todoTarget ? todos.filter((t) => t.proposal_id === todoTarget.id) : []),
    [todos, todoTarget],
  );

  // ── 新建/编辑 ──
  const handleCreate = useCallback(() => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ type: 'feature', priority: 'P2', attachment_links: [] });
    setModalVisible(true);
  }, [form]);

  const handleEdit = useCallback(
    (record: ProjectProposal) => {
      setEditing(record);
      form.resetFields();
      const initValues: ProposalFormValues = {
        title: record.title,
        type: record.type,
        priority: record.priority,
        attachment_links: record.attachment_links ?? [],
      };
      if (record.description) initValues.description = record.description;
      if (record.assignee_id) initValues.assignee_id = record.assignee_id;
      form.setFieldsValue(initValues);
      setModalVisible(true);
    },
    [form],
  );

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = {
        title: values.title.trim(),
        type: values.type,
        priority: values.priority,
        ...(values.description?.trim() ? { description: values.description.trim() } : {}),
        attachment_links: (values.attachment_links ?? [])
          .map((l) => l.trim())
          .filter((l) => l.length > 0),
        ...(values.assignee_id ? { assignee_id: values.assignee_id } : {}),
      };
      if (editing) {
        const res = await updateProjectProposal(editing.id, payload);
        if (res.code === 0) {
          message.success('提案已更新');
          setModalVisible(false);
          void fetchData();
        } else {
          message.error(res.msg || '更新失败');
        }
      } else {
        const res = await createProjectProposal({
          project_id: project.id,
          number: buildProposalNumber(project, proposals),
          ...payload,
        });
        if (res.code === 0) {
          message.success('提案已创建');
          setModalVisible(false);
          void fetchData();
        } else {
          message.error(res.msg || '创建失败');
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [form, editing, project, proposals, fetchData]);

  // ── 审批流转 ──
  const handleChangeStatus = useCallback(
    async (record: ProjectProposal, status: string, reason?: string) => {
      try {
        const res =
          reason !== undefined
            ? await updateProjectProposal(record.id, { status, reject_reason: reason })
            : await updateProjectProposal(record.id, { status });
        if (res.code === 0) {
          const text =
            status === 'approved' ? '提案已采纳' : status === 'rejected' ? '提案已拒绝' : '提案已完成';
          message.success(text);
          void fetchData();
        } else {
          message.error(res.msg || '状态更新失败');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '状态更新失败';
        message.error(msg);
      }
    },
    [fetchData],
  );

  const openReject = useCallback((record: ProjectProposal) => {
    setRejectTarget(record);
    setRejectReason('');
    setRejectVisible(true);
  }, []);

  const confirmReject = useCallback(async () => {
    const reason = rejectReason.trim();
    if (!reason) {
      message.warning('请填写拒绝原因');
      return;
    }
    if (!rejectTarget) return;
    await handleChangeStatus(rejectTarget, 'rejected', reason);
    setRejectVisible(false);
  }, [rejectReason, rejectTarget, handleChangeStatus]);

  // ── 删除 ──
  const handleDelete = useCallback(
    (record: ProjectProposal) => {
      Modal.confirm({
        title: '确认删除提案',
        icon: <ExclamationCircleOutlined />,
        content: `确定要删除提案「${record.number} ${record.title}」吗？此操作不可恢复。`,
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          try {
            const res = await deleteProjectProposal(record.id);
            if (res.code === 0) {
              message.success('提案已删除');
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
  const columns = useMemo<ColumnsType<ProjectProposal>>(
    () => [
      {
        title: '编号',
        dataIndex: 'number',
        key: 'number',
        width: 180,
        render: (number: string) => <Text strong>{number}</Text>,
      },
      {
        title: '标题',
        dataIndex: 'title',
        key: 'title',
        ellipsis: true,
      },
      {
        title: '类型',
        dataIndex: 'type',
        key: 'type',
        width: 100,
        render: (type: string) => (
          <Tag color={TYPE_COLOR[type] ?? 'default'}>{getLabel(typeOptions, type)}</Tag>
        ),
      },
      {
        title: '优先级',
        dataIndex: 'priority',
        key: 'priority',
        width: 100,
        render: (priority: string) => (
          <Tag color={PRIORITY_COLOR[priority] ?? 'default'}>
            {getLabel(priorityOptions, priority)}
          </Tag>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (status: string, record) => (
          <Tooltip
            title={
              status === 'rejected' && record.reject_reason
                ? `拒绝原因：${record.reject_reason}`
                : undefined
            }
          >
            <Tag color={STATUS_COLOR[status] ?? 'default'}>{getLabel(statusOptions, status)}</Tag>
          </Tooltip>
        ),
      },
      {
        title: '创建人',
        dataIndex: 'creator_id',
        key: 'creator_id',
        width: 120,
        render: (id: string) => displayName(id),
      },
      {
        title: '执行人',
        dataIndex: 'assignee_id',
        key: 'assignee_id',
        width: 120,
        render: (id: string | null) => displayName(id),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 160,
        render: (time: string) => formatDate(time),
      },
      {
        title: '关联待办',
        key: 'todos',
        width: 110,
        render: (_, record) => {
          const count = todoCountByProposal[record.id] ?? 0;
          return (
            <Space size={4}>
              <Tag color={count > 0 ? 'blue' : 'default'}>{count}</Tag>
              <Button
                size="small"
                type="link"
                icon={<LinkOutlined />}
                disabled={count === 0}
                onClick={() => {
                  setTodoTarget(record);
                  setTodoModalVisible(true);
                }}
              >
                查看
              </Button>
            </Space>
          );
        },
      },
      {
        title: '操作',
        key: 'actions',
        width: 230,
        render: (_, record) => (
          <Space size={4} wrap>
            {record.status === 'pending' && (
              <>
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckOutlined />}
                  disabled={!canOperate}
                  onClick={() => void handleChangeStatus(record, 'approved')}
                >
                  采纳
                </Button>
                <Button
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  disabled={!canOperate}
                  onClick={() => openReject(record)}
                >
                  拒绝
                </Button>
              </>
            )}
            {record.status === 'approved' && (
              <Button
                size="small"
                icon={<CheckOutlined />}
                disabled={!canOperate}
                onClick={() => void handleChangeStatus(record, 'completed')}
              >
                标记完成
              </Button>
            )}
            <Tooltip title="编辑">
              <Button
                size="small"
                icon={<EditOutlined />}
                disabled={!canOperate}
                aria-label="编辑"
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
            <Tooltip title="删除">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={!canOperate}
                aria-label="删除"
                onClick={() => handleDelete(record)}
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    [todoCountByProposal, canOperate, displayName, handleChangeStatus, openReject, handleEdit, handleDelete],
  );

  // ── 关联待办列定义 ──
  const todoColumns = useMemo<ColumnsType<ProjectTodo>>(
    () => [
      { title: '编号', dataIndex: 'number', key: 'number', width: 160 },
      { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (status: string) => (
          <Tag color={TODO_STATUS_COLOR[status] ?? 'default'}>
            {getLabel(todoStatusOptions, status)}
          </Tag>
        ),
      },
      {
        title: '执行人',
        dataIndex: 'assignee_id',
        key: 'assignee_id',
        width: 120,
        render: (id: string | null) => displayName(id),
      },
    ],
    [displayName],
  );

  return (
    <>
      {/* 工具栏：搜索 + 筛选 + 新建 */}
      <div className={styles.header ?? ''}>
        <Space>
          <Input
            prefix={<SearchOutlined style={{ color: 'var(--text-secondary)' }} />}
            placeholder="搜索提案标题/编号..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            variant="filled"
            className={styles.searchInput ?? ''}
            style={{ width: 240 }}
          />
          <Select
            placeholder="类型"
            allowClear
            style={{ width: 130 }}
            value={filters.type || undefined}
            onChange={(value) => setFilters((prev) => ({ ...prev, type: value || '' }))}
            options={typeOptions}
          />
          <Select
            placeholder="优先级"
            allowClear
            style={{ width: 130 }}
            value={filters.priority || undefined}
            onChange={(value) => setFilters((prev) => ({ ...prev, priority: value || '' }))}
            options={priorityOptions}
          />
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 130 }}
            value={filters.status || undefined}
            onChange={(value) => setFilters((prev) => ({ ...prev, status: value || '' }))}
            options={statusOptions}
          />
        </Space>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!canOperate}
            onClick={handleCreate}
          >
            新建提案
          </Button>
        </Space>
      </div>

      {/* 提案列表 */}
      <Table<ProjectProposal>
        rowKey="id"
        loading={proposalsLoading}
        columns={columns}
        dataSource={filteredProposals}
        pagination={{
          pageSize: 8,
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 条`,
        }}
        scroll={{ x: 1200 }}
        locale={{
          emptyText: <Empty description="暂无提案" />,
        }}
      />

      {/* 新建/编辑提案 Modal */}
      <Modal
        title={editing ? '编辑提案' : '新建提案'}
        open={modalVisible}
        onOk={() => void handleSubmit()}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        destroyOnClose
        width={640}
        styles={{
          body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' },
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入提案标题' }]}
          >
            <Input placeholder="请输入提案标题" maxLength={200} showCount />
          </Form.Item>
          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: '请选择提案类型' }]}
          >
            <Select options={typeOptions} />
          </Form.Item>
          <Form.Item
            name="priority"
            label="优先级"
            rules={[{ required: true, message: '请选择优先级' }]}
          >
            <Select options={priorityOptions} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={4} placeholder="请输入提案描述" maxLength={2000} showCount />
          </Form.Item>
          <Form.Item name="assignee_id" label="执行人" tooltip="从工作台用户中选择（可选）">
            <Select
              allowClear
              showSearch
              placeholder="选择执行人（可选）"
              optionFilterProp="label"
              options={users.map((u) => ({ value: u.id, label: u.nickname || u.username }))}
            />
          </Form.Item>
          <Form.List name="attachment_links">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <Form.Item
                    key={field.key}
                    label={index === 0 ? '附件链接' : ' '}
                    required={false}
                    style={{ marginBottom: 'var(--spacing-xs)' }}
                  >
                    <Space style={{ display: 'flex', width: '100%' }}>
                      <Form.Item
                        {...field}
                        noStyle
                        rules={[{ type: 'url', message: '请输入合法的 URL' }]}
                      >
                        <Input placeholder="https://..." style={{ flex: 1 }} />
                      </Form.Item>
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label="删除链接"
                        onClick={() => remove(field.name)}
                      />
                    </Space>
                  </Form.Item>
                ))}
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => add('')}
                  block
                >
                  添加附件链接
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      {/* 拒绝提案 Modal */}
      <Modal
        title="拒绝提案"
        open={rejectVisible}
        onOk={() => void confirmReject()}
        onCancel={() => setRejectVisible(false)}
        okText="确认拒绝"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        destroyOnClose
        width={520}
      >
        <Text type="secondary">请填写拒绝原因（必填）：</Text>
        <TextArea
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="请输入拒绝原因"
          maxLength={500}
          showCount
          style={{ marginTop: 'var(--spacing-xs)' }}
        />
      </Modal>

      {/* 关联待办 Modal */}
      <Modal
        title={`关联待办（${todoTarget ? todoTarget.number : ''}）`}
        open={todoModalVisible}
        onCancel={() => setTodoModalVisible(false)}
        footer={<Button onClick={() => setTodoModalVisible(false)}>关闭</Button>}
        width={640}
        styles={{
          body: { maxHeight: 'calc(100vh - 260px)', overflowY: 'auto', overflowX: 'hidden' },
        }}
      >
        {relatedTodos.length === 0 ? (
          <Empty description="暂无关联待办" />
        ) : (
          <Table<ProjectTodo>
            rowKey="id"
            size="small"
            dataSource={relatedTodos}
            columns={todoColumns}
            pagination={false}
          />
        )}
      </Modal>
    </>
  );
}
