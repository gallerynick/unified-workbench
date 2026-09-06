import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Divider,
  Empty,
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
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  deleteProjectTodo,
  getProjectTodo,
  updateProjectTodo,
} from '../../api/project-todos';
import { getProject } from '../../api/projects';
import { listProjectProposals } from '../../api/project-proposals';
import { listProjectMeetings, updateProjectMeeting } from '../../api/project-meetings';
import { listUsers } from '../../api/users';
import { useUser } from '../../contexts/UserContext';
import MeetingModal from './components/MeetingModal';
import TodoModal from './components/TodoModal';
import {
  PRIORITY_COLOR,
  PROPOSAL_STATUS_COLOR,
  PROPOSAL_STATUS_LABEL,
  TODO_PRIORITY_OPTIONS,
  TODO_STATUS_COLOR,
  TODO_STATUS_LABEL,
  TODO_STATUS_OPTIONS,
} from '../../constants/project';
import type { Project } from '../../types/project';
import type { ProjectProposal } from '../../types/project-proposal';
import type { ProjectMeeting } from '../../types/project-meeting';
import type { ProjectTodo } from '../../types/project-todo';
import type { User } from '../../types/user';
import styles from './TodoDetailPage.module.css';

const { Text, Title, Paragraph } = Typography;

const priorityOptions: { value: string; label: string }[] = TODO_PRIORITY_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));
const statusOptions: { value: string; label: string }[] = TODO_STATUS_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

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

function formatDateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * 项目待办详情页
 *
 * 展示范式沿用提案详情页：状态流转 Steps + 定义列表 + 段落区块 + 关联内容元信息行。
 * 待办描述保持纯文本（任务备注性质），不引入富文本。
 */
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

  // 添加已有交流 / 提案
  const [addMeetingVisible, setAddMeetingVisible] = useState(false);
  const [pendingMeetingIds, setPendingMeetingIds] = useState<string[]>([]);
  const [showAddProposalModal, setShowAddProposalModal] = useState(false);
  const [pendingProposalId, setPendingProposalId] = useState<string | null>(null);
  // 新建并关联交流（共用组件 MeetingModal）
  const [createMeetingVisible, setCreateMeetingVisible] = useState(false);
  // 编辑待办（共用组件 TodoModal）
  const [editVisible, setEditVisible] = useState(false);

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

  // 未关联的提案（排除已关联的）
  const unlinkedProposals = useMemo(() => {
    if (!todo) return [];
    return todo.proposal_id
      ? proposals.filter((p) => p.id !== todo.proposal_id)
      : proposals;
  }, [proposals, todo]);

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

  const handleBack = () => {
    if (projectId) navigate(`/projects/${projectId}`);
  };

  // 断开关联提案（二次确认）
  const handleDisconnectProposal = useCallback(() => {
    if (!todo) return;
    const proposal = proposals.find((p) => p.id === todo.proposal_id);
    Modal.confirm({
      title: '确认断开关联',
      icon: <ExclamationCircleOutlined />,
      content: `确定要断开待办「${todo.number} ${todo.title}」与提案「${proposal ? proposal.number : ''}」的关联吗？`,
      okText: '断开',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
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
      },
    });
  }, [todo, proposals]);

  const handleConfirmAddProposal = useCallback(async () => {
    if (!todo) return;
    if (!pendingProposalId) {
      message.warning('请选择要关联的提案');
      return;
    }
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
    if (pendingMeetingIds.length === 0) {
      message.warning('请选择要关联的交流记录');
      return;
    }
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

  // 断开关联交流（二次确认）
  const handleDisconnectMeeting = useCallback(
    (meeting: ProjectMeeting) => {
      Modal.confirm({
        title: '确认断开关联',
        icon: <ExclamationCircleOutlined />,
        content: `确定要断开交流「${meeting.number}」与此待办的关联吗？`,
        okText: '断开',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
          try {
            const res = await updateProjectMeeting(meeting.id, { todo_id: null });
            if (res.code === 0) {
              message.success('已断开关联交流');
              void fetchTodo();
            } else {
              message.error(res.msg || '更新失败');
            }
          } catch (err: unknown) {
            message.error(err instanceof Error ? err.message : '更新失败');
          }
        },
      });
    },
    [fetchTodo],
  );

  // 状态变更：推进直接生效，回退/跳级二次确认
  const handleStatusChange = useCallback(
    (targetStatus: string) => {
      if (!todo) return;
      const statusOrder: Record<string, number> = {
        pending: 0,
        in_progress: 1,
        completed: 2,
      };
      const currentOrder = statusOrder[todo.status];
      const targetOrder = statusOrder[targetStatus];
      if (currentOrder === undefined || targetOrder === undefined) return;
      const doChange = async () => {
        try {
          const res = await updateProjectTodo(todo.id, { status: targetStatus });
          if (res.code === 0) {
            message.success('状态已更新');
            setTodo(res.data);
          } else {
            message.error(res.msg || '更新失败');
          }
        } catch (err: unknown) {
          message.error(err instanceof Error ? err.message : '更新失败');
        }
      };
      if (targetOrder === currentOrder + 1) {
        void doChange();
        return;
      }
      Modal.confirm({
        title: '确认状态变更',
        content: `当前状态「${TODO_STATUS_LABEL[todo.status] ?? todo.status}」，目标状态「${TODO_STATUS_LABEL[targetStatus] ?? targetStatus}」。此操作涉及回退或跳级，是否继续？`,
        okText: '确定',
        cancelText: '取消',
        onOk: () => doChange(),
      });
    },
    [todo],
  );

  const openEdit = useCallback(() => {
    if (!todo) return;
    setEditVisible(true);
  }, [todo]);

  const handleDeleteTodo = useCallback(() => {
    if (!todo) return;
    Modal.confirm({
      title: '确认删除待办',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除待办「${todo.number} ${todo.title}」吗？此操作不可恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteProjectTodo(todo.id);
          if (res.code === 0) {
            message.success('待办已删除');
            if (projectId) navigate(`/projects/${projectId}`);
          } else {
            message.error(res.msg || '删除失败');
          }
        } catch (err: unknown) {
          message.error(err instanceof Error ? err.message : '删除失败');
        }
      },
    });
  }, [todo, projectId, navigate]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!todo) return null;

  const headerStatusColor = TODO_STATUS_COLOR[todo.status] ?? 'default';
  const headerStatusLabel = getLabel(statusOptions, todo.status);

  // 状态流程步骤（pending→in_progress→completed）
  const statusStepIndex: Record<string, number> = {
    pending: 0,
    in_progress: 1,
    completed: 2,
  };
  const currentStep = statusStepIndex[todo.status] ?? 0;
  const statusSteps: { title: string }[] = TODO_STATUS_OPTIONS.map((o) => ({
    title: o.label,
  }));

  // 定义列表项渲染辅助（短键值）
  const renderDefItem = (label: string, value: React.ReactNode) => (
    <div className={styles.defItem ?? ''}>
      <span className={styles.defLabel ?? ''}>{label}</span>
      <span className={styles.defValue ?? ''}>{value}</span>
    </div>
  );

  const linkedProposal = linkedProposals[0];

  const tabItems = [
    {
      key: 'detail',
      label: '待办详情',
      children: (
        <div className={styles.tabContent ?? ''}>
          {/* 状态流转可视化 */}
          <Steps
            size="small"
            current={currentStep}
            items={statusSteps}
            style={{ marginBottom: 'var(--spacing-card-gap)' }}
          />

          {/* 基础信息（定义列表） */}
          <div className={styles.definitionList ?? ''}>
            {renderDefItem('编号', todo.number)}
            {renderDefItem('标题', todo.title)}
            {renderDefItem(
              '状态',
              <Tag color={headerStatusColor} style={{ margin: 0 }}>
                {headerStatusLabel}
              </Tag>,
            )}
            {renderDefItem(
              '优先级',
              <Tag color={PRIORITY_COLOR[todo.priority] ?? 'default'} style={{ margin: 0 }}>
                {getLabel(priorityOptions, todo.priority)}
              </Tag>,
            )}
            {renderDefItem('创建人', displayName(todo.creator_id))}
            {renderDefItem('执行人', displayName(todo.assignee_id))}
            {renderDefItem('截止日期', todo.due_date ? formatDateOnly(todo.due_date) : '-')}
            {renderDefItem(
              '关联提案',
              linkedProposal ? (
                <a
                  onClick={() => {
                    if (projectId) navigate(`/projects/${projectId}/proposal/${linkedProposal.id}`);
                  }}
                >
                  {linkedProposal.number}
                </a>
              ) : (
                '-'
              ),
            )}
            {renderDefItem('创建时间', formatDate(todo.created_at))}
            {renderDefItem('更新时间', formatDate(todo.updated_at))}
          </div>

          {/* 描述（纯文本段落区块） */}
          {todo.description && (
            <div className={styles.textBlock ?? ''}>
              <div className={styles.textLabel ?? ''}>描述</div>
              <div className={styles.textBody ?? ''}>{todo.description}</div>
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
                关联提案
                {linkedProposals.length > 0 && (
                  <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                    （{linkedProposals.length}）
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
                  添加已有
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
                      onClick={() => {
                        if (projectId) navigate(`/projects/${projectId}/proposal/${proposal.id}`);
                      }}
                      style={{ cursor: 'pointer' }}
                      actions={[
                        <Button
                          key="disconnect-proposal"
                          type="link"
                          danger
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDisconnectProposal();
                          }}
                        >
                          断开关联
                        </Button>,
                      ]}
                    >
                      <div className={styles.linkedContent ?? ''}>
                        <Space className={styles.linkedLink ?? ''} wrap>
                          <Text strong>{proposal.number}</Text>
                          <Text>{proposal.title}</Text>
                        </Space>
                        <Space size={4} style={{ marginTop: 'var(--spacing-xxs)' }} wrap>
                          <Tag
                            color={PROPOSAL_STATUS_COLOR[proposal.status] ?? 'default'}
                            style={{ marginRight: 0 }}
                          >
                            {PROPOSAL_STATUS_LABEL[proposal.status] ?? proposal.status}
                          </Tag>
                          <Tag
                            color={PRIORITY_COLOR[proposal.priority] ?? 'default'}
                            style={{ marginRight: 0 }}
                          >
                            {getLabel(priorityOptions, proposal.priority)}
                          </Tag>
                          {proposal.assignee_id && (
                            <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                              执行人：{displayName(proposal.assignee_id)}
                            </Text>
                          )}
                        </Space>
                      </div>
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
                <>
                  <Button
                    type="link"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setPendingMeetingIds([]);
                      setAddMeetingVisible(true);
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
            {canManageTodos ? (
              linkedMeetings.length > 0 ? (
                <List
                  dataSource={linkedMeetings}
                  renderItem={(meeting) => (
                    <List.Item
                      className={styles.linkedItem ?? ''}
                      onClick={() => {
                        if (projectId) navigate(`/projects/${projectId}/meeting/${meeting.id}`);
                      }}
                      style={{ cursor: 'pointer' }}
                      actions={[
                        <Button
                          key="disconnect-meeting"
                          type="link"
                          danger
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDisconnectMeeting(meeting);
                          }}
                        >
                          断开关联
                        </Button>,
                      ]}
                    >
                      <div className={styles.linkedContent ?? ''}>
                        <Space className={styles.linkedLink ?? ''} wrap>
                          <Text strong>{meeting.number}</Text>
                          <Text>{meeting.type} {formatDate(meeting.started_at)}</Text>
                        </Space>
                        {(meeting.speaker || meeting.content) && (
                          <div style={{ marginTop: 'var(--spacing-xxs)' }}>
                            {meeting.speaker && (
                              <Text
                                type="secondary"
                                style={{ fontSize: 'var(--text-body-xs-size)', marginRight: 'var(--spacing-sm)' }}
                              >
                                发言人：{meeting.speaker}
                              </Text>
                            )}
                            {meeting.content && (
                              <Text
                                type="secondary"
                                style={{ fontSize: 'var(--text-body-xs-size)' }}
                                ellipsis
                              >
                                {meeting.content.length > 60
                                  ? `${meeting.content.slice(0, 60)}...`
                                  : meeting.content}
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
              <Empty description="您没有待办管理权限，无法关联交流" />
            )}
          </div>
        </Space>
      ),
    },
    ...(canManageTodos
      ? [
          {
            key: 'actions',
            label: '待办操作',
            children: (
              <div>
                <Title level={5} style={{ marginBottom: 16 }}>
                  状态操作
                </Title>
                <div style={{ marginBottom: 24 }}>
                  <Text strong style={{ marginRight: 16 }}>
                    当前状态：
                  </Text>
                  <Tag color={headerStatusColor}>{headerStatusLabel}</Tag>
                </div>

                {todo.status === 'pending' && (
                  <div style={{ marginBottom: 24 }}>
                    <Text strong style={{ marginRight: 16 }}>
                      推进：
                    </Text>
                    <Space>
                      <Button type="primary" onClick={() => handleStatusChange('in_progress')}>
                        开始处理
                      </Button>
                      <Button onClick={() => handleStatusChange('completed')}>
                        标记完成
                      </Button>
                    </Space>
                  </div>
                )}
                {todo.status === 'in_progress' && (
                  <div style={{ marginBottom: 24 }}>
                    <Text strong style={{ marginRight: 16 }}>
                      推进：
                    </Text>
                    <Space>
                      <Button type="primary" onClick={() => handleStatusChange('completed')}>
                        标记完成
                      </Button>
                    </Space>
                  </div>
                )}
                {todo.status === 'completed' && (
                  <div style={{ marginBottom: 24 }}>
                    <Text strong style={{ marginRight: 16 }}>
                      重新打开：
                    </Text>
                    <Space>
                      <Button onClick={() => handleStatusChange('pending')}>
                        退回待处理
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
                    options={TODO_STATUS_OPTIONS.filter((o) => o.value !== todo.status)}
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
                        <Text strong>编辑待办</Text>
                        <Paragraph type="secondary" style={{ marginBottom: 0, marginLeft: 12 }}>
                          修改标题、描述、优先级、执行人、截止日期和关联提案
                        </Paragraph>
                      </div>
                      <Button icon={<EditOutlined />} onClick={openEdit}>
                        编辑
                      </Button>
                    </Space>
                    <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <Text strong>删除待办</Text>
                        <Paragraph type="secondary" style={{ marginBottom: 0, marginLeft: 12 }}>
                          删除此待办，此操作不可恢复
                        </Paragraph>
                      </div>
                      <Button danger icon={<DeleteOutlined />} onClick={handleDeleteTodo}>
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

      {/* 编辑待办（共用组件 TodoModal） */}
      <TodoModal
        project={project ?? ({} as Project)}
        open={editVisible}
        editingTodo={todo}
        existingTodos={todo ? [todo] : []}
        onClose={() => setEditVisible(false)}
        onSaved={() => void fetchTodo()}
      />

      {/* 新建并关联交流（共用组件 MeetingModal，预关联当前待办） */}
      <MeetingModal
        project={project ?? ({} as Project)}
        open={createMeetingVisible}
        existingMeetings={meetings}
        initialTodoId={todo.id}
        onClose={() => setCreateMeetingVisible(false)}
        onSaved={() => void fetchTodo()}
      />

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
        destroyOnClose
        width={560}
        okButtonProps={{ disabled: pendingMeetingIds.length === 0 }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>
          选择要关联到此待办的交流记录（已关联的自动排除）：
        </Text>
        <Select
          mode="multiple"
          showSearch
          allowClear
          style={{ width: '100%' }}
          placeholder="选择要关联的交流记录"
          optionFilterProp="label"
          maxTagCount="responsive"
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
        destroyOnClose
        width={560}
        okButtonProps={{ disabled: !pendingProposalId }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>
          待办仅能关联一个提案，确认关联将替换原有提案：
        </Text>
        <Select
          showSearch
          allowClear
          style={{ width: '100%' }}
          placeholder="选择要关联的提案"
          optionFilterProp="label"
          value={pendingProposalId}
          onChange={(value) => setPendingProposalId(value ?? null)}
          options={unlinkedProposals.map((p) => ({
            value: p.id,
            label: `${p.number} ${p.title}`,
          }))}
        />
      </Modal>
    </div>
  );
}
