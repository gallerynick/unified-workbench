import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Divider,
  Empty,
  Input,
  List,
  message,
  Modal,
  Select,
  Space,
  Spin,
  Steps,
  Tag,
  Tabs,
  Tooltip,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
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
import ContentEditor from '@/components/ContentEditor/ContentEditor';
import TodoModal from './components/TodoModal';
import MeetingModal from './components/MeetingModal';
import ProposalModal from './components/ProposalModal';
import { parseDescription } from './components/proposalDescription';
import {
  PRIORITY_COLOR,
  PROPOSAL_PRIORITY_OPTIONS,
  PROPOSAL_STATUS_COLOR,
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUS_OPTIONS,
  PROPOSAL_TYPE_OPTIONS,
  TODO_STATUS_COLOR,
  TODO_STATUS_LABEL,
} from '../../constants/project';
import type { ProjectProposal } from '../../types/project-proposal';
import type { Project } from '../../types/project';
import type { ProjectTodo } from '../../types/project-todo';
import type { ProjectMeeting } from '../../types/project-meeting';
import type { User } from '../../types/user';
import styles from './ProposalDetailPage.module.css';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

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

  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [linkedTodoIds, setLinkedTodoIds] = useState<string[]>([]);
  const [linkedMeetingIds, setLinkedMeetingIds] = useState<string[]>([]);
  const [showAddTodoModal, setShowAddTodoModal] = useState(false);
  const [showAddMeetingModal, setShowAddMeetingModal] = useState(false);
  const [pendingTodoIds, setPendingTodoIds] = useState<string[]>([]);
  const [pendingMeetingIds, setPendingMeetingIds] = useState<string[]>([]);

  // ── 一键新建并关联 ──
  const [createTodoVisible, setCreateTodoVisible] = useState(false);
  const [createMeetingVisible, setCreateMeetingVisible] = useState(false);

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
    (todoId: string) => {
      const todo = todos.find((t) => t.id === todoId);
      Modal.confirm({
        title: '确认断开关联',
        icon: <ExclamationCircleOutlined />,
        content: `确定要断开待办「${todo ? todo.number : ''} ${todo ? todo.title : ''}」与当前提案的关联吗？`,
        okText: '断开',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
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
      });
    },
    [linkedTodoIds, todos],
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
    (meetingId: string) => {
      const meeting = meetings.find((m) => m.id === meetingId);
      Modal.confirm({
        title: '确认断开关联',
        icon: <ExclamationCircleOutlined />,
        content: `确定要断开交流「${meeting ? meeting.number : ''} ${meeting ? meeting.type : ''}」与当前提案的关联吗？`,
        okText: '断开',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
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
      });
    },
    [linkedMeetingIds, meetings],
  );

  // ── 一键新建交流并关联：由共用组件 MeetingModal 处理（见组件底部渲染） ──

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

  // ── 编辑提案：由共用组件 ProposalModal 处理（见组件底部渲染） ──
  const openEdit = useCallback(() => {
    if (!proposal) return;
    setEditVisible(true);
  }, [proposal]);

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

const headerStatusColor = PROPOSAL_STATUS_COLOR[proposal.status] ?? 'default';
const headerStatusLabel = PROPOSAL_STATUS_LABEL[proposal.status] ?? proposal.status;

  const handleBack = () => {
    if (projectId) navigate(`/projects/${projectId}`);
  };

  // 状态流程步骤（pending→approved→in_progress→completed）
  const statusStepIndex: Record<string, number> = { pending: 0, approved: 1, in_progress: 2, completed: 3 };
  const currentStep = statusStepIndex[proposal.status] ?? 0;
  const stepStatus = proposal.status === 'rejected' ? 'error' : 'process';
  const statusSteps = [
    { title: '待审核' },
    { title: '待实现' },
    { title: '实现中' },
    { title: '已完成' },
  ];

  // 定义列表项渲染辅助（短键值）
  const renderDefItem = (label: string, value: React.ReactNode) => (
    <div className={styles.defItem ?? ''}>
      <span className={styles.defLabel ?? ''}>{label}</span>
      <span className={styles.defValue ?? ''}>{value}</span>
    </div>
  );

  /** 描述展示区块：富文本用 ContentEditor 只读渲染，纯文本直接显示 */
  const renderDescriptionBlock = (label: string, value: string) => {
    const doc = parseDescription(value);
    return (
      <div className={styles.textBlock ?? ''}>
        <div className={styles.textLabel ?? ''}>{label}</div>
        {doc ? (
          <ContentEditor value={doc} editable={false} minHeight={80} />
        ) : (
          <div className={styles.textBody ?? ''}>{value}</div>
        )}
      </div>
    );
  };

  const tabItems = [
    {
      key: 'detail',
      label: '提案信息',
      children: (
        <div className={styles.tabContent ?? ''}>
          {/* 状态流转可视化 */}
          <Steps
            size="small"
            current={currentStep}
            {...(stepStatus === 'error' ? { status: 'error' as const } : {})}
            items={statusSteps}
            style={{ marginBottom: 'var(--spacing-card-gap)' }}
          />

          {/* 基础信息（定义列表） */}
          <div className={styles.definitionList ?? ''}>
            {renderDefItem('编号', proposal.number)}
            {renderDefItem('标题', proposal.title)}
            {renderDefItem(
              '状态',
              <Tooltip
                title={
                  proposal.status === 'rejected' && proposal.reject_reason
                    ? `废弃原因：${proposal.reject_reason}`
                    : undefined
                }
              >
                <Tag color={headerStatusColor} style={{ margin: 0 }}>{headerStatusLabel}</Tag>
              </Tooltip>
            )}
            {renderDefItem('类型', getLabel(typeOptions, proposal.type))}
            {renderDefItem(
              '优先级',
              <Tag color={PRIORITY_COLOR[proposal.priority] ?? 'default'} style={{ margin: 0 }}>
                {getLabel(priorityOptions, proposal.priority)}
              </Tag>
            )}
            {renderDefItem('创建人', displayName(proposal.creator_id))}
            {renderDefItem('执行人', displayName(proposal.assignee_id))}
            {renderDefItem('创建时间', formatDate(proposal.created_at))}
          </div>

          {/* 描述（富文本/纯文本兼容渲染） */}
          {proposal.description && renderDescriptionBlock('描述', proposal.description)}

          {/* 附件（段落区块） */}
          {proposal.attachment_links && proposal.attachment_links.length > 0 && (
            <div className={styles.textBlock ?? ''}>
              <div className={styles.textLabel ?? ''}>附件</div>
              <Space direction="vertical" size="small">
                {proposal.attachment_links.map((link, index) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">
                    附件 {index + 1}{link.description ? `：${link.description}` : ''}
                  </a>
                ))}
              </Space>
            </div>
          )}

          {/* 废弃原因 */}
          {proposal.status === 'rejected' && proposal.reject_reason && (
            <div className={styles.textBlock ?? ''}>
              <div className={styles.textLabel ?? ''}>废弃原因</div>
              <div className={styles.textBody ?? ''} style={{ color: 'var(--color-error)' }}>
                {proposal.reject_reason}
              </div>
            </div>
          )}
        </div>
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
                <>
                  <Button
                    type="link"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setPendingTodoIds([]);
                      setShowAddTodoModal(true);
                    }}
                  >
                    添加已有
                  </Button>
                  <Button
                    type="link"
                    icon={<PlusOutlined />}
                    onClick={() => setCreateTodoVisible(true)}
                  >
                    新建并关联
                  </Button>
                </>
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
                            handleDisconnectTodo(todo.id);
                          }}
                        >
                          断开关联
                        </Button>,
                      ]}
                    >
                      <div className={styles.linkedContent ?? ''}>
                        <Space className={styles.linkedLink ?? ''}>
                          <Text strong>{todo.number}</Text>
                          <Text>{todo.title}</Text>
                        </Space>
                        <Space size={4} style={{ marginTop: 'var(--spacing-xxs)' }}>
                          <Tag color={PRIORITY_COLOR[todo.priority] ?? 'default'} style={{ marginRight: 0 }}>
                            {getLabel(priorityOptions, todo.priority)}
                          </Tag>
                          <Tag color={TODO_STATUS_COLOR[todo.status] ?? 'default'} style={{ marginRight: 0 }}>
                            {TODO_STATUS_LABEL[todo.status] ?? todo.status}
                          </Tag>
                          {todo.due_date && (
                            <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                              截止 {formatDate(todo.due_date)}
                            </Text>
                          )}
                        </Space>
                      </div>
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
                <>
                  <Button
                    type="link"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setPendingMeetingIds([]);
                      setShowAddMeetingModal(true);
                    }}
                  >
                    添加已有
                  </Button>
                  <Button
                    type="link"
                    icon={<PlusOutlined />}
                    onClick={() => setCreateMeetingVisible(true)}
                  >
                    新建并关联
                  </Button>
                </>
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
                            handleDisconnectMeeting(meeting.id);
                          }}
                        >
                          断开关联
                        </Button>,
                      ]}
                    >
                      <div className={styles.linkedContent ?? ''}>
                        <Space className={styles.linkedLink ?? ''}>
                          <Text strong>{meeting.number}</Text>
                          <Text>{meeting.type} {formatDate(meeting.started_at)}</Text>
                        </Space>
                        {(meeting.speaker || meeting.content) && (
                          <div style={{ marginTop: 'var(--spacing-xxs)' }}>
                            {meeting.speaker && (
                              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)', marginRight: 'var(--spacing-sm)' }}>
                                发言人：{meeting.speaker}
                              </Text>
                            )}
                            {meeting.content && (
                              <Text
                                type="secondary"
                                style={{ fontSize: 'var(--text-body-xs-size)' }}
                                ellipsis
                              >
                                {meeting.content.length > 60 ? `${meeting.content.slice(0, 60)}...` : meeting.content}
                              </Text>
                            )}
                          </div>
                        )}
                      </div>
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

      {/* 一键新建待办并关联（共用组件 TodoModal，预关联当前提案） */}
      <TodoModal
        project={project ?? ({} as Project)}
        open={createTodoVisible}
        existingTodos={todos}
        initialProposalId={proposal?.id ?? null}
        onClose={() => setCreateTodoVisible(false)}
        onSaved={() => void fetchProposal()}
      />

      {/* 一键新建交流并关联（共用组件 MeetingModal，预关联当前提案） */}
      <MeetingModal
        project={project ?? ({} as Project)}
        open={createMeetingVisible}
        existingMeetings={meetings}
        initialProposalId={proposal?.id ?? null}
        onClose={() => setCreateMeetingVisible(false)}
        onSaved={() => void fetchProposal()}
      />

      {/* 编辑提案（共用组件 ProposalModal，预填充当前提案） */}
      <ProposalModal
        project={project ?? ({} as Project)}
        open={editVisible}
        editingProposal={proposal}
        existingProposals={proposal ? [proposal] : []}
        onClose={() => setEditVisible(false)}
        onSaved={() => void fetchProposal()}
      />

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