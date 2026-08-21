import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
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
  DeleteOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  deleteProjectProposal,
  getProjectProposal,
  updateProjectProposal,
} from '../../api/project-proposals';
import { getProject } from '../../api/projects';
import { listProjectTodos, updateProjectTodo } from '../../api/project-todos';
import { listProjectMeetings, updateProjectMeeting } from '../../api/project-meetings';
import { listUsers } from '../../api/users';
import { useUser } from '../../contexts/UserContext';
import {
  PROPOSAL_PRIORITY_OPTIONS,
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUS_OPTIONS,
  PROPOSAL_TYPE_OPTIONS,
} from '../../constants/project';
import type { AttachmentLink, ProjectProposal } from '../../types/project-proposal';
import type { Project } from '../../types/project';
import type { ProjectTodo } from '../../types/project-todo';
import type { ProjectMeeting } from '../../types/project-meeting';
import type { User } from '../../types/user';
import styles from './ProposalDetailPage.module.css';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

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
  in_progress: 'processing',
  rejected: 'error',
  completed: 'default',
};

function getLabel(
  options: { value: string; label: string }[],
  value: string | null | undefined,
): string {
  if (!value) return '-';
  return options.find((o) => o.value === value)?.label ?? value;
}

const typeOptions: { value: string; label: string }[] = PROPOSAL_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));
const priorityOptions: { value: string; label: string }[] = PROPOSAL_PRIORITY_OPTIONS.map((o) => ({
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

interface ProposalFormValues {
  title: string;
  type: string;
  priority: string;
  description?: string;
  attachment_links?: AttachmentLink[];
  assignee_id?: string;
}

export default function ProposalDetailPage() {
  const { id: projectId, proposalId } = useParams<{ id: string; proposalId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();

  const [proposal, setProposal] = useState<ProjectProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [todos, setTodos] = useState<ProjectTodo[]>([]);
  const [meetings, setMeetings] = useState<ProjectMeeting[]>([]);
  const [project, setProject] = useState<Project | null>(null);

  const [editVisible, setEditVisible] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editForm] = Form.useForm<ProposalFormValues>();

  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [linkedTodoIds, setLinkedTodoIds] = useState<string[]>([]);
  const [linkedMeetingIds, setLinkedMeetingIds] = useState<string[]>([]);
  const [showAddTodoModal, setShowAddTodoModal] = useState(false);
  const [showAddMeetingModal, setShowAddMeetingModal] = useState(false);
  const [pendingTodoIds, setPendingTodoIds] = useState<string[]>([]);
  const [pendingMeetingIds, setPendingMeetingIds] = useState<string[]>([]);

  const isAdmin = user?.role === 'admin';
  const proposalsApprover = !!user && project?.member_permissions?.[user?.id ?? '']?.proposals_approver === true;
  const isProjectOwner = !!user && project?.owner_id === user?.id;
  const canManageProposal = isAdmin || isProjectOwner || proposalsApprover;

  const fetchProposal = useCallback(async () => {
    if (!projectId || !proposalId) return;
    setLoading(true);
    try {
      const [proposalRes, userRes, todoRes, meetingRes, projectRes] = await Promise.all([
        getProjectProposal(proposalId),
        listUsers({ page_size: 100 }),
        listProjectTodos({ project_id: projectId, page_size: 100 }),
        listProjectMeetings({ project_id: projectId, page_size: 100 }),
        getProject(projectId),
      ]);
      if (proposalRes.code === 0) {
        setProposal(proposalRes.data);
      } else {
        message.error(proposalRes.msg || '获取提案失败');
        navigate(`/projects/${projectId}`);
      }
      if (userRes.code === 0) setUsers(userRes.data.items);
      if (todoRes.code === 0) {
        const todoItems = todoRes.data.items;
        setTodos(todoItems);
        setLinkedTodoIds(
          todoItems.filter((t) => t.proposal_id === proposalRes.data?.id).map((t) => t.id),
        );
      }
      if (meetingRes.code === 0) {
        const meetingItems = meetingRes.data.items;
        setMeetings(meetingItems);
        setLinkedMeetingIds(
          meetingItems.filter((m) => m.proposal_id === proposalRes.data?.id).map((m) => m.id),
        );
      }
      if (projectRes.code === 0) setProject(projectRes.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取提案失败';
      message.error(msg);
      navigate(`/projects/${projectId}`);
    } finally {
      setLoading(false);
    }
  }, [projectId, proposalId, navigate]);

  useEffect(() => {
    void fetchProposal();
  }, [fetchProposal]);

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

  const linkedTodos = useMemo(
    () => todos.filter((t) => linkedTodoIds.includes(t.id)),
    [todos, linkedTodoIds],
  );

  const linkedMeetings = useMemo(
    () => meetings.filter((m) => linkedMeetingIds.includes(m.id)),
    [meetings, linkedMeetingIds],
  );

  const canManageTodos =
    !!user && project?.member_permissions?.[user.id]?.todos !== 'readonly';
  const canManageMeetings =
    !!user && project?.member_permissions?.[user.id]?.meetings !== 'readonly';

  const handleTodoSelectChange = useCallback(
    (selectedIds: string[]) => {
      setPendingTodoIds(selectedIds);
    },
    [],
  );

  const confirmAddTodos = useCallback(async () => {
    if (!proposal) return;
    const toAdd = pendingTodoIds.filter((id) => !linkedTodoIds.includes(id));
    if (toAdd.length === 0) {
      message.warning('没有新增的待办需要关联');
      setShowAddTodoModal(false);
      return;
    }
    const promises: Promise<unknown>[] = [];
    for (const id of toAdd) {
      promises.push(updateProjectTodo(id, { proposal_id: proposal.id }));
    }
    const results = await Promise.allSettled(promises);
    setShowAddTodoModal(false);
    setPendingTodoIds([]);
    const failed = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    if (failed.length > 0) {
      message.error(`关联待办失败（${failed.length} 项）`);
    } else {
      message.success(`已关联 ${toAdd.length} 项待办`);
      setLinkedTodoIds([...linkedTodoIds, ...toAdd]);
    }
  }, [pendingTodoIds, linkedTodoIds, proposal]);

  const handleDisconnectTodo = useCallback(
    async (todoId: string) => {
      try {
        const res = await updateProjectTodo(todoId, { proposal_id: null });
        if (res.code === 0) {
          message.success('已断开关联');
          setLinkedTodoIds(linkedTodoIds.filter((id) => id !== todoId));
        } else {
          message.error(res.msg || '断开关联失败');
        }
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : '断开关联失败');
      }
    },
    [linkedTodoIds],
  );

  const handleMeetingSelectChange = useCallback(
    (selectedIds: string[]) => {
      setPendingMeetingIds(selectedIds);
    },
    [],
  );

  const confirmAddMeetings = useCallback(async () => {
    if (!proposal) return;
    const toAdd = pendingMeetingIds.filter((id) => !linkedMeetingIds.includes(id));
    if (toAdd.length === 0) {
      message.warning('没有新增的交流需要关联');
      setShowAddMeetingModal(false);
      return;
    }
    const promises: Promise<unknown>[] = [];
    for (const id of toAdd) {
      promises.push(updateProjectMeeting(id, { proposal_id: proposal.id }));
    }
    const results = await Promise.allSettled(promises);
    setShowAddMeetingModal(false);
    setPendingMeetingIds([]);
    const failed = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    if (failed.length > 0) {
      message.error(`关联交流失败（${failed.length} 项）`);
    } else {
      message.success(`已关联 ${toAdd.length} 项交流`);
      setLinkedMeetingIds([...linkedMeetingIds, ...toAdd]);
    }
  }, [pendingMeetingIds, linkedMeetingIds, proposal]);

  const handleDisconnectMeeting = useCallback(
    async (meetingId: string) => {
      try {
        const res = await updateProjectMeeting(meetingId, { proposal_id: null });
        if (res.code === 0) {
          message.success('已断开关联');
          setLinkedMeetingIds(linkedMeetingIds.filter((id) => id !== meetingId));
        } else {
          message.error(res.msg || '断开关联失败');
        }
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : '断开关联失败');
      }
    },
    [linkedMeetingIds],
  );

  const confirmReject = useCallback(async () => {
    if (!proposal) return;
    const reason = rejectReason.trim();
    if (!reason) {
        message.warning('请填写废弃原因');
      return;
    }
    try {
      const res = await updateProjectProposal(proposal.id, {
        status: 'rejected',
        reject_reason: reason,
      });
      if (res.code === 0) {
        message.success('提案已废弃');
        setRejectVisible(false);
        setProposal(res.data);
      } else {
        message.error(res.msg || '废弃失败');
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '废弃失败');
    }
  }, [proposal, rejectReason]);

  const handleStatusChange = useCallback(
    (targetStatus: string) => {
      if (!proposal) return;
      if (targetStatus === 'rejected') {
        setRejectReason('');
        setRejectVisible(true);
        return;
      }
      const statusOrder: Record<string, number> = {
        pending: 0,
        approved: 1,
        in_progress: 2,
        completed: 3,
        rejected: -1,
      };
      const currentOrder = (statusOrder as Record<string, number>)[proposal.status];
      const targetOrder = (statusOrder as Record<string, number>)[targetStatus];
      if (currentOrder === undefined || targetOrder === undefined) return;
      const isNext = currentOrder >= 0 && targetOrder === currentOrder + 1;
      if (isNext) {
        void (async () => {
          try {
            const res = await updateProjectProposal(proposal.id, { status: targetStatus });
            if (res.code === 0) {
              message.success('状态已更新');
              setProposal(res.data);
            } else {
              message.error(res.msg || '更新失败');
            }
          } catch (err: unknown) {
            message.error(err instanceof Error ? err.message : '更新失败');
          }
        })();
        return;
      }
      Modal.confirm({
        title: '确认状态变更',
        content: `当前状态「${PROPOSAL_STATUS_LABEL[proposal.status] ?? proposal.status}」，目标状态「${PROPOSAL_STATUS_LABEL[targetStatus] ?? targetStatus}」。此操作涉及回退或跳级，是否继续？`,
        okText: '确定',
        cancelText: '取消',
        onOk: async () => {
          try {
            const res = await updateProjectProposal(proposal.id, { status: targetStatus });
            if (res.code === 0) {
              message.success('状态已更新');
              setProposal(res.data);
            } else {
              message.error(res.msg || '更新失败');
            }
          } catch (err: unknown) {
            message.error(err instanceof Error ? err.message : '更新失败');
          }
        },
      });
    },
    [proposal],
  );

  const openEdit = useCallback(() => {
    if (!proposal) return;
    editForm.resetFields();
    const initValues: ProposalFormValues = {
      title: proposal.title,
      type: proposal.type,
      priority: proposal.priority,
      attachment_links: (proposal.attachment_links ?? []).map((l) =>
        typeof l === 'string' ? { url: l, description: '' } : l,
      ),
    };
    if (proposal.description) initValues.description = proposal.description;
    if (proposal.assignee_id) initValues.assignee_id = proposal.assignee_id;
    editForm.setFieldsValue(initValues);
    setEditVisible(true);
  }, [proposal, editForm]);

  const submitEdit = useCallback(async () => {
    if (!proposal) return;
    try {
      const values = await editForm.validateFields();
      setSubmittingEdit(true);
      const payload = {
        title: values.title.trim(),
        type: values.type,
        priority: values.priority,
        ...(values.description?.trim() ? { description: values.description.trim() } : {}),
        attachment_links: (values.attachment_links ?? [])
          .map((l) => ({ url: (l.url ?? '').trim(), description: (l.description ?? '').trim() }))
          .filter((l) => l.url.length > 0),
        ...(values.assignee_id ? { assignee_id: values.assignee_id } : {}),
      };
      const res = await updateProjectProposal(proposal.id, payload);
      if (res.code === 0) {
        message.success('提案已更新');
        setEditVisible(false);
        setProposal(res.data);
      } else {
        message.error(res.msg || '更新失败');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setSubmittingEdit(false);
    }
  }, [proposal, editForm]);

  const handleDeleteProposal = useCallback(() => {
    if (!proposal) return;
    Modal.confirm({
      title: '确认删除提案',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除提案「${proposal.number} ${proposal.title}」吗？此操作不可恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteProjectProposal(proposal.id);
          if (res.code === 0) {
            message.success('提案已删除');
            if (projectId) navigate(`/projects/${projectId}`);
          } else {
            message.error(res.msg || '删除失败');
          }
        } catch (err: unknown) {
          message.error(err instanceof Error ? err.message : '删除失败');
        }
      },
    });
  }, [proposal, projectId, navigate]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!proposal) return null;

const headerStatusColor = STATUS_COLOR[proposal.status] ?? 'default';
const headerStatusLabel = PROPOSAL_STATUS_LABEL[proposal.status] ?? proposal.status;

  const handleBack = () => {
    if (projectId) navigate(`/projects/${projectId}`);
  };

  const tabItems = [
    {
      key: 'detail',
      label: '提案信息',
      children: (
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="编号">{proposal.number}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tooltip
                  title={
                    proposal.status === 'rejected' && proposal.reject_reason
                      ? `废弃原因：${proposal.reject_reason}`
                      : undefined
                  }
                >
                  <Tag color={headerStatusColor}>{headerStatusLabel}</Tag>
                </Tooltip>
              </Descriptions.Item>
          <Descriptions.Item label="标题" span={2}>{proposal.title}</Descriptions.Item>
          <Descriptions.Item label="类型">
            {getLabel(typeOptions, proposal.type)}
          </Descriptions.Item>
          <Descriptions.Item label="优先级">
            <Tag color={PRIORITY_COLOR[proposal.priority] ?? 'default'}>
              {getLabel(priorityOptions, proposal.priority)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="创建人">
            {displayName(proposal.creator_id)}
          </Descriptions.Item>
          <Descriptions.Item label="执行人">
            {displayName(proposal.assignee_id)}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间" span={2}>
            {formatDate(proposal.created_at)}
          </Descriptions.Item>
          {proposal.description && (
            <Descriptions.Item label="描述" span={2}>
              <Text>{proposal.description}</Text>
            </Descriptions.Item>
          )}
          {proposal.attachment_links && proposal.attachment_links.length > 0 && (
            <Descriptions.Item label="附件" span={2}>
              <Space direction="vertical" size="small">
                {proposal.attachment_links.map((link, index) => (
                  <Text key={link.url}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      附件 {index + 1}{link.description ? `：${link.description}` : ''}
                    </a>
                  </Text>
                ))}
              </Space>
            </Descriptions.Item>
          )}
          {proposal.status === 'rejected' && proposal.reject_reason && (
            <Descriptions.Item label="废弃原因" span={2}>
              <Text type="danger">{proposal.reject_reason}</Text>
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
                关联待办
                {linkedTodos.length > 0 && (
                  <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                    （{linkedTodos.length}）
                  </Text>
                )}
              </Title>
              {canManageTodos && (
                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setPendingTodoIds([]);
                    setShowAddTodoModal(true);
                  }}
                >
                  添加
                </Button>
              )}
            </Space>
            {canManageTodos ? (
              linkedTodos.length > 0 ? (
                <List
                  dataSource={linkedTodos}
                  renderItem={(todo) => (
                    <List.Item
                      className={styles.linkedItem ?? ''}
                      onClick={() => navigate(`/projects/${projectId}/todo/${todo.id}`)}
                      style={{ cursor: 'pointer' }}
                      actions={[
                        <Button
                          key="disconnect"
                          type="link"
                          danger
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDisconnectTodo(todo.id);
                          }}
                        >
                          断开关联
                        </Button>,
                      ]}
                    >
                      <Space className={styles.linkedLink ?? ''}>
                        <Text strong>{todo.number}</Text>
                        <Text>{todo.title}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂未关联待办" />
              )
            ) : (
              <Empty description="您没有待办管理权限，无法关联待办" />
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
              {canManageMeetings && (
                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setPendingMeetingIds([]);
                    setShowAddMeetingModal(true);
                  }}
                >
                  添加
                </Button>
              )}
            </Space>
            {canManageMeetings ? (
              linkedMeetings.length > 0 ? (
                <List
                  dataSource={linkedMeetings}
                  renderItem={(meeting) => (
                    <List.Item
                      className={styles.linkedItem ?? ''}
                      onClick={() => navigate(`/projects/${projectId}/meeting/${meeting.id}`)}
                      style={{ cursor: 'pointer' }}
                      actions={[
                        <Button
                          key="disconnect"
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
                        <Text>{meeting.type} {formatDate(meeting.started_at)}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂未关联交流" />
              )
            ) : (
              <Empty description="您没有交流管理权限，无法关联交流" />
            )}
          </div>
        </Space>
      ),
    },
    ...(canManageProposal
      ? [
          {
            key: 'actions',
            label: '提案操作',
            children: (
              <div>
                <Title level={5} style={{ marginBottom: 16 }}>
                  状态操作
                </Title>
                <div style={{ marginBottom: 24 }}>
                  <Text strong style={{ marginRight: 16 }}>
                    当前状态：
                  </Text>
                  <Tooltip
                    title={
                      proposal.status === 'rejected' && proposal.reject_reason
                        ? `废弃原因：${proposal.reject_reason}`
                        : undefined
                    }
                  >
                    <Tag color={headerStatusColor}>{headerStatusLabel}</Tag>
                  </Tooltip>
                </div>

                {proposal.status === 'pending' && (
                  <div style={{ marginBottom: 24 }}>
                    <Text strong style={{ marginRight: 16 }}>
                      审核：
                    </Text>
                    <Space>
                      <Button type="primary" onClick={() => handleStatusChange('approved')}>
                        通过
                      </Button>
                      <Button danger onClick={() => handleStatusChange('rejected')}>
                        拒绝
                      </Button>
                    </Space>
                  </div>
                )}
                {proposal.status === 'approved' && (
                  <div style={{ marginBottom: 24 }}>
                    <Text strong style={{ marginRight: 16 }}>
                      推进：
                    </Text>
                    <Space>
                      <Button type="primary" onClick={() => handleStatusChange('in_progress')}>
                        实现中
                      </Button>
                      <Button danger onClick={() => handleStatusChange('rejected')}>
                        废弃
                      </Button>
                    </Space>
                  </div>
                )}
                {proposal.status === 'in_progress' && (
                  <div style={{ marginBottom: 24 }}>
                    <Text strong style={{ marginRight: 16 }}>
                      推进：
                    </Text>
                    <Space>
                      <Button type="primary" onClick={() => handleStatusChange('completed')}>
                        已完成
                      </Button>
                      <Button danger onClick={() => handleStatusChange('rejected')}>
                        废弃
                      </Button>
                    </Space>
                  </div>
                )}
                

                <div style={{ marginBottom: 24 }}>
                  <Text strong style={{ marginRight: 16 }}>
                    切换状态：
                  </Text>
                  <Select
                    value={null}
                    placeholder="选择目标状态"
                    onChange={(value: string) => handleStatusChange(value)}
                    options={PROPOSAL_STATUS_OPTIONS.filter(
                      (o) => o.value !== proposal.status,
                    )}
                    style={{ width: 200 }}
                  />
                  <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                    回退或跳级需要二次确认
                  </Paragraph>
                </div>

                <Divider />

                <div>
                  <Title level={5} style={{ marginBottom: 16 }}>
                    其他操作
                  </Title>
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <Text strong>编辑提案</Text>
                        <Paragraph type="secondary" style={{ marginBottom: 0, marginLeft: 12 }}>
                          修改提案标题、类型、优先级、描述、附件和执行人
                        </Paragraph>
                      </div>
                      <Button onClick={openEdit}>
                        编辑
                      </Button>
                    </Space>
                    <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <Text strong>删除提案</Text>
                        <Paragraph type="secondary" style={{ marginBottom: 0, marginLeft: 12 }}>
                          删除此提案，此操作不可恢复
                        </Paragraph>
                      </div>
                      <Button danger onClick={handleDeleteProposal}>
                        删除
                      </Button>
                    </Space>
                  </Space>
                </div>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回
          </Button>
          <Title level={4} className={styles.title ?? ''}>
            {proposal.number} {proposal.title}
          </Title>
          <Tooltip
            title={
              proposal.status === 'rejected' && proposal.reject_reason
                ? `废弃原因：${proposal.reject_reason}`
                : undefined
            }
          >
            <Tag color={headerStatusColor}>{headerStatusLabel}</Tag>
          </Tooltip>
        </Space>
      </div>

      <Card>
        <Tabs items={tabItems} />
      </Card>

      <Modal
        title="编辑提案"
        open={editVisible}
        onOk={() => void submitEdit()}
        onCancel={() => setEditVisible(false)}
        confirmLoading={submittingEdit}
        destroyOnClose
        width={640}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Form form={editForm} layout="vertical">
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
                    label={index === 0 ? '附件' : ' '}
                    required={false}
                    style={{ marginBottom: 'var(--spacing-xs)' }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xxs)' }}>
                      <Space style={{ display: 'flex', width: '100%' }}>
                        <Form.Item
                          name={[field.name, 'url']}
                          noStyle
                          rules={[{ type: 'url', message: '请输入合法的 URL' }]}
                        >
                          <Input placeholder="附件地址 https://..." style={{ flex: 1 }} />
                        </Form.Item>
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          aria-label="删除附件"
                          onClick={() => remove(field.name)}
                        />
                      </Space>
                      <Form.Item name={[field.name, 'description']} noStyle>
                        <Input placeholder="附件说明（可选）" />
                      </Form.Item>
                    </div>
                  </Form.Item>
                ))}
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => add({ url: '', description: '' })}
                  block
                >
                  添加附件
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal
        title="废弃提案"
        open={rejectVisible}
        onOk={() => void confirmReject()}
        onCancel={() => setRejectVisible(false)}
        okText="确认废弃"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        destroyOnClose
        width={520}
      >
        <Text type="secondary">请填写废弃原因（必填）：</Text>
        <TextArea
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="请输入废弃原因"
          maxLength={500}
          showCount
          style={{ marginTop: 'var(--spacing-xs)', marginBottom: 'var(--spacing-lg)', width: '100%' }}
        />
      </Modal>

      <Modal
        title="选择待办关联"
        open={showAddTodoModal}
        onOk={() => void confirmAddTodos()}
        onCancel={() => setShowAddTodoModal(false)}
        okText="确认关联"
        cancelText="取消"
        destroyOnClose
        width={560}
        okButtonProps={{ disabled: pendingTodoIds.length === 0 }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>
          选择要关联到本提案的待办事项（已关联的自动排除）：
        </Text>
        <Select
          mode="multiple"
          showSearch
          allowClear
          value={pendingTodoIds}
          onChange={handleTodoSelectChange}
          optionFilterProp="label"
          options={todos
            .filter((t) => !linkedTodoIds.includes(t.id))
            .map((t) => ({
              value: t.id,
              label: `${t.number} ${t.title}`,
            }))}
          style={{ width: '100%' }}
          placeholder="选择待办"
          maxTagCount="responsive"
        />
      </Modal>

      <Modal
        title="选择交流关联"
        open={showAddMeetingModal}
        onOk={() => void confirmAddMeetings()}
        onCancel={() => setShowAddMeetingModal(false)}
        okText="确认关联"
        cancelText="取消"
        destroyOnClose
        width={560}
        okButtonProps={{ disabled: pendingMeetingIds.length === 0 }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>
          选择要关联到本提案的交流记录（已关联的自动排除）：
        </Text>
        <Select
          mode="multiple"
          showSearch
          allowClear
          value={pendingMeetingIds}
          onChange={handleMeetingSelectChange}
          optionFilterProp="label"
          options={meetings
            .filter((m) => !linkedMeetingIds.includes(m.id))
            .map((m) => ({
              value: m.id,
              label: `${m.number} ${m.type} ${formatDate(m.started_at)}`,
            }))}
          style={{ width: '100%' }}
          placeholder="选择交流"
          maxTagCount="responsive"
        />
      </Modal>
    </div>
  );
}