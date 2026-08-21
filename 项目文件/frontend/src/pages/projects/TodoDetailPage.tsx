import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Descriptions,
  Divider,
  Empty,
  List,
  message,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Tabs,
  Tooltip,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  getProjectTodo,
  updateProjectTodo,
} from '../../api/project-todos';
import { getProject } from '../../api/projects';
import { listProjectProposals } from '../../api/project-proposals';
import { listProjectMeetings, updateProjectMeeting } from '../../api/project-meetings';
import { listUsers } from '../../api/users';
import { useUser } from '../../contexts/UserContext';
import {
  TODO_PRIORITY_OPTIONS,
  TODO_STATUS_OPTIONS,
} from '../../constants/project';
import type { Project } from '../../types/project';
import type { ProjectProposal } from '../../types/project-proposal';
import type { ProjectMeeting } from '../../types/project-meeting';
import type { ProjectTodo } from '../../types/project-todo';
import type { User } from '../../types/user';
import styles from './TodoDetailPage.module.css';

const { Text, Title } = Typography;

const PRIORITY_COLOR: Record<string, string> = {
  P0: 'red',
  P1: 'volcano',
  P2: 'orange',
  P3: 'gold',
  P4: 'default',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'default',
  in_progress: 'processing',
  completed: 'success',
};

function getLabel(
  options: { value: string; label: string }[],
  value: string | null | undefined,
): string {
  if (!value) return '-';
  return options.find((o) => o.value === value)?.label ?? value;
}

const priorityOptions: { value: string; label: string }[] = TODO_PRIORITY_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));
const statusOptions: { value: string; label: string }[] = TODO_STATUS_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export default function TodoDetailPage() {
  const { id: projectId, todoId } = useParams<{ id: string; todoId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();

  const [todo, setTodo] = useState<ProjectTodo | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [proposals, setProposals] = useState<ProjectProposal[]>([]);
  const [meetings, setMeetings] = useState<ProjectMeeting[]>([]);
  const [project, setProject] = useState<Project | null>(null);

const [addMeetingVisible, setAddMeetingVisible] = useState(false);
const [pendingMeetingIds, setPendingMeetingIds] = useState<string[]>([]);
const [showAddProposalModal, setShowAddProposalModal] = useState(false);
const [pendingProposalId, setPendingProposalId] = useState<string | null>(null);

  const fetchTodo = useCallback(async () => {
    if (!projectId || !todoId) return;
    setLoading(true);
    try {
      const [todoRes, userRes, proposalRes, meetingRes, projectRes] = await Promise.all([
        getProjectTodo(todoId),
        listUsers({ page_size: 100 }),
        listProjectProposals({ project_id: projectId, page_size: 100 }),
        listProjectMeetings({ project_id: projectId, page_size: 100 }),
        getProject(projectId),
      ]);
      if (todoRes.code === 0) {
        setTodo(todoRes.data);
      } else {
        message.error(todoRes.msg || '获取待办失败');
        navigate(`/projects/${projectId}`);
      }
      if (userRes.code === 0) setUsers(userRes.data.items);
      if (proposalRes.code === 0) setProposals(proposalRes.data.items);
      if (meetingRes.code === 0) setMeetings(meetingRes.data.items);
      if (projectRes.code === 0) setProject(projectRes.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取待办失败';
      message.error(msg);
      navigate(`/projects/${projectId}`);
    } finally {
      setLoading(false);
    }
  }, [projectId, todoId, navigate]);

  useEffect(() => {
    void fetchTodo();
  }, [fetchTodo]);

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

  // 关联提案：todo.proposal_id 指向的提案
  const linkedProposals = useMemo(() => {
    if (!todo) return [];
    return todo.proposal_id
      ? proposals.filter((p) => p.id === todo.proposal_id)
      : [];
  }, [todo, proposals]);

  // 关联交流：按 todo_id 关联
  const linkedMeetings = useMemo(() => {
    if (!todo) return [];
    return meetings.filter((m) => m.todo_id === todo.id);
  }, [todo, meetings]);

  // 未关联的交流（排除已关联的）
  const unlinkedMeetings = useMemo(() => {
    if (!todo) return [];
    const linkedIds = new Set(linkedMeetings.map((m) => m.id));
    return meetings.filter((m) => !linkedIds.has(m.id));
  }, [meetings, linkedMeetings, todo]);

  const canManageTodos =
    !!user && project?.member_permissions?.[user.id]?.todos !== 'readonly';

  const headerStatusColor = todo ? STATUS_COLOR[todo.status] ?? 'default' : 'default';
  const headerStatusLabel = getLabel(statusOptions, todo?.status);

  const handleBack = () => {
    if (projectId) navigate(`/projects/${projectId}`);
  };

  // 断开关联提案
  const handleDisconnectProposal = useCallback(async () => {
    if (!todo) return;
    try {
      const res = await updateProjectTodo(todo.id, { proposal_id: null });
      if (res.code === 0) {
        message.success('已断开关联提案');
        setTodo(res.data);
      } else {
        message.error(res.msg || '更新失败');
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '更新失败');
    }
  }, [todo]);

  const handleConfirmAddProposal = useCallback(async () => {
    if (!todo) return;
    try {
      const res = await updateProjectTodo(todo.id, { proposal_id: pendingProposalId });
      if (res.code === 0) {
        message.success('关联提案已更新');
        setShowAddProposalModal(false);
        setPendingProposalId(null);
        setTodo(res.data);
      } else {
        message.error(res.msg || '更新失败');
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '更新失败');
    }
  }, [todo, pendingProposalId]);

  // 确认关联交流
  const handleConfirmAddMeetings = useCallback(async () => {
    if (!todo) return;
    try {
      for (const meetingId of pendingMeetingIds) {
        await updateProjectMeeting(meetingId, { todo_id: todo.id });
      }
      message.success('关联交流已更新');
      setAddMeetingVisible(false);
      setPendingMeetingIds([]);
      void fetchTodo();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '关联失败');
    }
  }, [todo, pendingMeetingIds, fetchTodo]);

  // 断开关联交流
  const handleDisconnectMeeting = useCallback(async (meetingId: string) => {
    try {
      const res = await updateProjectMeeting(meetingId, { todo_id: null });
      if (res.code === 0) {
        message.success('已断开关联交流');
        void fetchTodo();
      } else {
        message.error(res.msg || '更新失败');
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '更新失败');
    }
  }, [fetchTodo]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!todo) return null;

  const tabItems = [
    {
      key: 'detail',
      label: '待办详情',
      children: (
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="编号">{todo.number}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={headerStatusColor}>{headerStatusLabel}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="标题" span={2}>{todo.title}</Descriptions.Item>
          <Descriptions.Item label="优先级">
            <Tag color={PRIORITY_COLOR[todo.priority] ?? 'default'}>
              {getLabel(priorityOptions, todo.priority)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="创建人">
            {displayName(todo.creator_id)}
          </Descriptions.Item>
          <Descriptions.Item label="执行人">
            {displayName(todo.assignee_id)}
          </Descriptions.Item>
          <Descriptions.Item label="截止日期">
            {todo.due_date ? formatDateOnly(todo.due_date) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="关联提案">
            {todo.proposal_id
              ? proposals.find((p) => p.id === todo.proposal_id)?.number || todo.proposal_id
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间" span={2}>
            {formatDate(todo.created_at)}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间" span={2}>
            {formatDate(todo.updated_at)}
          </Descriptions.Item>
          {todo.description && (
            <Descriptions.Item label="描述" span={2}>
              <Text>{todo.description}</Text>
            </Descriptions.Item>
          )}
        </Descriptions>
      ),
    },
    {
      key: 'related',
      label: '关联内容',
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Space size="small" style={{ marginBottom: 'var(--spacing-sm)' }}>
              <Title level={5} style={{ margin: 0 }}>
                关联提案
                {todo.proposal_id && (
                  <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                    （1）
                  </Text>
                )}
              </Title>
              {canManageTodos && (
                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setPendingProposalId(null);
                    setShowAddProposalModal(true);
                  }}
                >
                  添加
                </Button>
              )}
            </Space>
            {canManageTodos ? (
              linkedProposals.length > 0 ? (
                <List
                  dataSource={linkedProposals}
                  renderItem={(proposal) => (
                    <List.Item
                      className={styles.linkedItem ?? ''}
                      onClick={() => { if (projectId) navigate(`/projects/${projectId}/proposal/${proposal.id}`); }}
                      style={{ cursor: 'pointer' }}
                      actions={[
                        <Button
                          key="disconnect-proposal"
                          type="link"
                          danger
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDisconnectProposal();
                          }}
                        >
                          断开关联
                        </Button>,
                      ]}
                    >
                      <Space className={styles.linkedLink ?? ''}>
                        <Text strong>{proposal.number}</Text>
                        <Text>{proposal.title}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂未关联提案" />
              )
            ) : (
              <Empty description="您没有待办管理权限，无法关联提案" />
            )}
          </div>
          <Divider />
          <div>
            <Space size="small" style={{ marginBottom: 'var(--spacing-sm)' }}>
              <Title level={5} style={{ margin: 0 }}>
                关联交流
                {linkedMeetings.length > 0 && (
                  <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                    （{linkedMeetings.length}）
                  </Text>
                )}
              </Title>
              {canManageTodos && (
                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setPendingMeetingIds([]);
                    setAddMeetingVisible(true);
                  }}
                >
                  添加
                </Button>
              )}
            </Space>
            {canManageTodos ? (
              linkedMeetings.length > 0 ? (
                <List
                  dataSource={linkedMeetings}
                  renderItem={(meeting) => (
                    <List.Item
                      className={styles.linkedItem ?? ''}
                      onClick={() => { if (projectId) navigate(`/projects/${projectId}/meeting/${meeting.id}`); }}
                      style={{ cursor: 'pointer' }}
                      actions={[
                        <Button
                          key="disconnect-meeting"
                          type="link"
                          danger
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDisconnectMeeting(meeting.id);
                          }}
                        >
                          断开关联
                        </Button>,
                      ]}
                    >
                      <Space className={styles.linkedLink ?? ''}>
                        <Text strong>{meeting.number}</Text>
                        <Text>{meeting.type}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂未关联交流" />
              )
            ) : (
              <Empty description="您没有待办管理权限，无法关联交流" />
            )}
          </div>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回
          </Button>
          <Tooltip title={todo.number + ' ' + todo.title}>
            <Title level={4} className={styles.title ?? ''}>
              {todo.number} {todo.title}
            </Title>
          </Tooltip>
          <Tag color={headerStatusColor}>{headerStatusLabel}</Tag>
        </Space>
      </div>

      <Card>
        <Tabs items={tabItems} />
      </Card>

      <Modal
        title="添加关联交流"
        open={addMeetingVisible}
        onOk={handleConfirmAddMeetings}
        onCancel={() => {
          setAddMeetingVisible(false);
          setPendingMeetingIds([]);
        }}
        okText="确认关联"
        cancelText="取消"
      >
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="选择要关联的交流记录"
          value={pendingMeetingIds}
          onChange={setPendingMeetingIds}
          options={unlinkedMeetings.map((m) => ({
            value: m.id,
            label: `${m.number} ${m.type}`,
          }))}
        />
</Modal>

        <Modal
          title="添加关联提案"
          open={showAddProposalModal}
          onOk={handleConfirmAddProposal}
          onCancel={() => {
            setShowAddProposalModal(false);
            setPendingProposalId(null);
          }}
          okText="确认关联"
          cancelText="取消"
        >
          <Select
            style={{ width: '100%' }}
            placeholder="选择要关联的提案"
            value={pendingProposalId}
            onChange={setPendingProposalId}
            options={proposals.map((p) => ({
              value: p.id,
              label: `${p.number} ${p.title}`,
            }))}
          />
        </Modal>
      </div>
  );
}