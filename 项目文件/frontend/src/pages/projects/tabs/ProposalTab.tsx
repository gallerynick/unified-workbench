import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Typography,
  message,
  Tooltip,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  RightOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Project } from '../../../types/project';
import type { ProjectProposal } from '../../../types/project-proposal';
import type { User } from '../../../types/user';
import { listProjectProposals } from '../../../api/project-proposals';
import { listUsers } from '../../../api/users';
import { useUser } from '../../../contexts/UserContext';
import styles from './ProposalTab.module.css';
import {
  PRIORITY_COLOR,
  PROPOSAL_TYPE_OPTIONS,
  PROPOSAL_PRIORITY_OPTIONS,
  PROPOSAL_STATUS_COLOR,
  PROPOSAL_STATUS_OPTIONS,
} from '../../../constants/project';
import ProposalModal from '../components/ProposalModal';

const { Text } = Typography;


// ─── 标签颜色映射（与深浅色模式无关，由 antd Tag 语义色自适应） ─────────

const TYPE_COLOR: Record<string, string> = {
  feature: 'blue',
  bug: 'red',
  improvement: 'green',
  removal: 'orange',
  other: 'default',
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


export default function ProposalTab({ project }: { project: Project }) {
  const { user } = useUser();
  const navigate = useNavigate();

  // ── 数据状态 ──
  const [proposals, setProposals] = useState<ProjectProposal[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  // ── 筛选状态（空字符串表示"全部"） ──
  const [filters, setFilters] = useState<{ type: string; priority: string; status: string }>({
    type: '',
    priority: '',
    status: '',
  });
  const [search, setSearch] = useState('');

  // ── 新建（弹窗共用 ProposalModal） ──
  const [proposalModalOpen, setProposalModalOpen] = useState(false);

  // ── 权限：负责人+管理员始终可操作；普通成员按 member_permissions.proposals 分区 ──
  const isOwner = !!user && project.owner_id === user.id;
  const isAdmin = user?.role === 'admin';
  const proposalsPerm = project.member_permissions?.[user?.id ?? '']?.proposals;
  const canCreateProposal = isOwner || isAdmin || proposalsPerm === 'create';

  // ── 数据拉取 ──
  const fetchData = useCallback(async () => {
    setProposalsLoading(true);
    try {
      const [proposalRes, userRes] = await Promise.all([
        listProjectProposals({ project_id: project.id, page_size: 100 }),
        listUsers({ page_size: 100 }),
      ]);
      if (proposalRes.code === 0) {
        setProposals(proposalRes.data.items);
      } else {
        message.error(proposalRes.msg || '获取提案列表失败');
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

  // ── 新建由共用组件 ProposalModal 处理，见组件底部渲染 ──

  // ── 列定义 ──
  const columns = useMemo<ColumnsType<ProjectProposal>>(
    () => [
      {
        title: '编号',
        dataIndex: 'number',
        key: 'number',
        width: 180,
        ellipsis: true,
        render: (number: string, record: ProjectProposal) => (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => navigate(`/projects/${project.id}/proposal/${record.id}`)}
          >
            {number}
          </Button>
        ),
      },
      {
        title: '标题',
        dataIndex: 'title',
        key: 'title',
        ellipsis: true,
        render: (text: string) => (
          <Tooltip title={text}>
            <Text>{text}</Text>
          </Tooltip>
        ),
      },
      {
        title: '类型',
        dataIndex: 'type',
        key: 'type',
        width: 90,
        render: (type: string) => (
          <Tag color={TYPE_COLOR[type] ?? 'default'}>{getLabel(typeOptions, type)}</Tag>
        ),
      },
      {
        title: '优先级',
        dataIndex: 'priority',
        key: 'priority',
        width: 80,
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
        width: 90,
        render: (status: string, record: ProjectProposal) => (
          <Tooltip
            title={
              status === 'rejected' && record.reject_reason
                ? `拒绝原因：${record.reject_reason}`
                : undefined
            }
          >
            <Tag color={PROPOSAL_STATUS_COLOR[status] ?? 'default'}>{getLabel(statusOptions, status)}</Tag>
          </Tooltip>
        ),
      },
      {
        title: '创建人',
        dataIndex: 'creator_id',
        key: 'creator_id',
        width: 100,
        render: (id: string) => displayName(id),
      },
      {
        title: '执行人',
        dataIndex: 'assignee_id',
        key: 'assignee_id',
        width: 100,
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
        title: '操作',
        key: 'actions',
        width: 90,
        render: (_: unknown, record: ProjectProposal) => (
          <Button
            type="link"
            size="small"
            icon={<RightOutlined />}
            onClick={() => navigate(`/projects/${project.id}/proposal/${record.id}`)}
          >
            进入
          </Button>
        ),
      },
    ],
    [displayName, project.id, navigate],
  );

  return (
    <div className={styles.container ?? ''}>
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
            disabled={!canCreateProposal}
            onClick={() => setProposalModalOpen(true)}
          >
            新建提案
          </Button>
        </Space>
      </div>

      {/* 提案列表 */}
      <Table<ProjectProposal>
        rowKey="id"
        size="small"
        loading={proposalsLoading}
        columns={columns}
        dataSource={filteredProposals}
        className={styles.table ?? ''}
        pagination={{
          pageSize: 8,
          pageSizeOptions: [8, 10, 20, 50],
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        scroll={{ x: 900 }}
        locale={{
          emptyText: <Empty description="暂无提案" />,
        }}
      />

      {/* 新建提案（共用组件 ProposalModal） */}
      <ProposalModal
        project={project}
        open={proposalModalOpen}
        existingProposals={proposals}
        onClose={() => setProposalModalOpen(false)}
        onSaved={() => void fetchData()}
      />
    </div>
  );
}
