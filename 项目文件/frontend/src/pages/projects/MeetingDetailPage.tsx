import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  DatePicker,
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
  EditOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  deleteProjectMeeting,
  getProjectMeeting,
  updateProjectMeeting,
} from '../../api/project-meetings';
import { listProjectProposals } from '../../api/project-proposals';
import { listProjectTodos } from '../../api/project-todos';
import { getProject } from '../../api/projects';
import { listUsers } from '../../api/users';
import {
  MEETING_TYPE_OPTIONS,
  PRIORITY_COLOR,
  PROPOSAL_STATUS_COLOR,
  PROPOSAL_STATUS_LABEL,
  TODO_STATUS_COLOR,
  TODO_STATUS_LABEL,
  TODO_PRIORITY_OPTIONS,
} from '../../constants/project';
import { useUser } from '../../contexts/UserContext';
import TodoModal from './components/TodoModal';
import ProposalModal from './components/ProposalModal';
import MeetingModal, { splitTitleContent } from './components/MeetingModal';
import type { Project } from '../../types/project';
import type { ProjectMeeting } from '../../types/project-meeting';
import type { ProjectProposal } from '../../types/project-proposal';
import type { ProjectTodo } from '../../types/project-todo';
import type { User } from '../../types/user';
import styles from './MeetingDetailPage.module.css';

const { Text, Title } = Typography;
const { TextArea } = Input;

const typeOptions: { value: string; label: string }[] = MEETING_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));
const priorityOptions: { value: string; label: string }[] = TODO_PRIORITY_OPTIONS.map((o) => ({
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

interface MeetingNote {
  content: string;
  author: string;
  created_at: string;
}

function parseNote(note: unknown): MeetingNote {
  if (note && typeof note === 'object') {
    const o = note as Record<string, unknown>;
    return {
      content: typeof o.content === 'string' ? o.content : String(o.content ?? ''),
      author: typeof o.author === 'string' ? o.author : '',
      created_at: typeof o.created_at === 'string' ? o.created_at : '',
    };
  }
  return { content: String(note ?? ''), author: '', created_at: '' };
}

export default function MeetingDetailPage() {
  const { id: projectId, meetingId } = useParams<{ id: string; meetingId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();

  const [meeting, setMeeting] = useState<ProjectMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [proposals, setProposals] = useState<ProjectProposal[]>([]);
  const [todos, setTodos] = useState<ProjectTodo[]>([]);
  const [project, setProject] = useState<Project | null>(null);

  const [addProposalVisible, setAddProposalVisible] = useState(false);
  const [pendingProposalId, setPendingProposalId] = useState<string | null>(null);
  const [addTodoVisible, setAddTodoVisible] = useState(false);
  const [pendingTodoId, setPendingTodoId] = useState<string | null>(null);
  const [createTodoVisible, setCreateTodoVisible] = useState(false);
  const [createProposalVisible, setCreateProposalVisible] = useState(false);

  // ── 分区编辑状态 ──
  const [editBasicVisible, setEditBasicVisible] = useState(false);
  const [editContentVisible, setEditContentVisible] = useState(false);
  const [basicForm] = Form.useForm();
  const [editContentBody, setEditContentBody] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  // 用户列表（用于发言人/参与者下拉）
  const [userOptions, setUserOptions] = useState<{ value: string; label: string }[]>([]);

  const fetchMeeting = useCallback(async () => {
    if (!projectId || !meetingId) return;
    setLoading(true);
    try {
      const [
        meetingRes,
        userRes,
        proposalRes,
        todoRes,
        projectRes,
      ] = await Promise.all([
        getProjectMeeting(meetingId),
        listUsers({ page_size: 100 }),
        listProjectProposals({ project_id: projectId, page_size: 100 }),
        listProjectTodos({ project_id: projectId, page_size: 100 }),
        getProject(projectId),
      ]);
      if (meetingRes.code === 0) {
        setMeeting(meetingRes.data);
      } else {
        message.error(meetingRes.msg || '获取交流记录失败');
        navigate(`/projects/${projectId}`);
      }
      if (userRes.code === 0) setUsers(userRes.data.items);
      if (proposalRes.code === 0) setProposals(proposalRes.data.items);
      if (todoRes.code === 0) setTodos(todoRes.data.items);
      if (projectRes.code === 0) setProject(projectRes.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取交流记录失败';
      message.error(msg);
      navigate(`/projects/${projectId}`);
    } finally {
      setLoading(false);
    }
  }, [projectId, meetingId, navigate]);

  useEffect(() => {
    void fetchMeeting();
  }, [fetchMeeting]);

  useEffect(() => {
    if (users.length > 0) {
      setUserOptions(
        users.map((u) => ({
          value: u.id,
          label: u.username ? `${u.nickname} (${u.username})` : u.nickname,
        })),
      );
    }
  }, [users]);

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

  const linkedProposals = useMemo(() => {
    if (!meeting) return [];
    return meeting.proposal_id
      ? proposals.filter((p) => p.id === meeting.proposal_id)
      : [];
  }, [meeting, proposals]);

  const linkedTodos = useMemo(() => {
    if (!meeting) return [];
    return meeting.todo_id
      ? todos.filter((t) => t.id === meeting.todo_id)
      : [];
  }, [meeting, todos]);

  const unlinkedProposals = useMemo(() => {
    if (!meeting) return [];
    return meeting.proposal_id
      ? proposals.filter((p) => p.id !== meeting.proposal_id)
      : proposals;
  }, [proposals, meeting]);

  const unlinkedTodos = useMemo(() => {
    if (!meeting) return [];
    return meeting.todo_id ? todos.filter((t) => t.id !== meeting.todo_id) : todos;
  }, [todos, meeting]);

  const canManageMeetings =
    !!user && project?.member_permissions?.[user.id]?.meetings !== 'readonly';

  const handleBack = () => {
    if (projectId) navigate(`/projects/${projectId}`);
  };

  const handleDeleteMeeting = useCallback(() => {
    if (!meeting) return;
    Modal.confirm({
      title: '确认删除交流记录',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除交流记录「${meeting.number}」吗？此操作不可恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteProjectMeeting(meeting.id);
          if (res.code === 0) {
            message.success('交流记录已删除');
            if (projectId) navigate(`/projects/${projectId}`);
          } else {
            message.error(res.msg || '删除失败');
          }
        } catch (err: unknown) {
          message.error(err instanceof Error ? err.message : '删除失败');
        }
      },
    });
  }, [meeting, projectId, navigate]);

  const handleDisconnectProposal = useCallback(() => {
    if (!meeting) return;
    const proposal = proposals.find((p) => p.id === meeting.proposal_id);
    Modal.confirm({
      title: '确认断开关联',
      icon: <ExclamationCircleOutlined />,
      content: `确定要断开交流「${meeting.number}」与提案「${proposal ? proposal.number : ''}」的关联吗？`,
      okText: '断开',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await updateProjectMeeting(meeting.id, { proposal_id: null });
          if (res.code === 0) {
            message.success('已断开关联提案');
            setMeeting(res.data);
          } else {
            message.error(res.msg || '更新失败');
          }
        } catch (err: unknown) {
          message.error(err instanceof Error ? err.message : '更新失败');
        }
      },
    });
  }, [meeting, proposals]);

  const handleConfirmAddProposal = useCallback(async () => {
    if (!meeting) return;
    if (!pendingProposalId) {
      message.warning('请选择要关联的提案');
      return;
    }
    try {
      const res = await updateProjectMeeting(meeting.id, { proposal_id: pendingProposalId });
      if (res.code === 0) {
        message.success('关联提案已更新');
        setAddProposalVisible(false);
        setPendingProposalId(null);
        setMeeting(res.data);
      } else {
        message.error(res.msg || '更新失败');
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '更新失败');
    }
  }, [meeting, pendingProposalId]);

  const handleDisconnectTodo = useCallback(() => {
    if (!meeting) return;
    const todo = todos.find((t) => t.id === meeting.todo_id);
    Modal.confirm({
      title: '确认断开关联',
      icon: <ExclamationCircleOutlined />,
      content: `确定要断开交流「${meeting.number}」与待办「${todo ? todo.number : ''} ${todo ? todo.title : ''}」的关联吗？`,
      okText: '断开',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await updateProjectMeeting(meeting.id, { todo_id: null });
          if (res.code === 0) {
            message.success('已断开关联待办');
            setMeeting(res.data);
          } else {
            message.error(res.msg || '更新失败');
          }
        } catch (err: unknown) {
          message.error(err instanceof Error ? err.message : '更新失败');
        }
      },
    });
  }, [meeting, todos]);

  const handleConfirmAddTodo = useCallback(async () => {
    if (!meeting) return;
    if (!pendingTodoId) {
      message.warning('请选择要关联的待办');
      return;
    }
    try {
      const res = await updateProjectMeeting(meeting.id, { todo_id: pendingTodoId });
      if (res.code === 0) {
        message.success('关联待办已更新');
        setAddTodoVisible(false);
        setPendingTodoId(null);
        setMeeting(res.data);
      } else {
        message.error(res.msg || '更新失败');
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '更新失败');
    }
  }, [meeting, pendingTodoId]);

  // ── 分区编辑：打开基础信息弹窗 ──
  const openEditBasic = useCallback(() => {
    if (!meeting) return;
    const { title } = splitTitleContent(meeting.content);
    basicForm.setFieldsValue({
      type: meeting.type,
      title,
      started_at: meeting.started_at ? dayjs(meeting.started_at) : undefined,
      speaker: meeting.speaker || '',
      participants: meeting.participants || [],
    });
    setEditBasicVisible(true);
  }, [meeting, basicForm]);

  const handleSaveBasic = useCallback(async () => {
    if (!meeting) return;
    let values;
    try {
      values = await basicForm.validateFields();
    } catch {
      return;
    }
    setSaving(true);
    try {
      const { body } = splitTitleContent(meeting.content);
      const newTitle = values.title?.trim() ?? '';
      const content = body ? `${newTitle}\n\n${body}` : newTitle;
      const payload = {
        type: values.type,
        started_at: values.started_at?.toISOString() ?? new Date().toISOString(),
        content,
        ...(values.speaker?.trim() ? { speaker: values.speaker.trim() } : { speaker: null }),
        ...(values.participants?.length ? { participants: values.participants } : { participants: [] }),
      };
      const res = await updateProjectMeeting(meeting.id, payload);
      if (res.code === 0) {
        message.success('基础信息已更新');
        setMeeting(res.data);
        setEditBasicVisible(false);
      } else {
        message.error(res.msg || '更新失败');
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '更新失败');
    } finally {
      setSaving(false);
    }
  }, [meeting, basicForm]);

  // ── 分区编辑：打开交流正文弹窗 ──
  const openEditContent = useCallback(() => {
    if (!meeting) return;
    const { body } = splitTitleContent(meeting.content);
    setEditContentBody(body);
    setEditContentVisible(true);
  }, [meeting]);

  const handleSaveContent = useCallback(async () => {
    if (!meeting) return;
    setSaving(true);
    try {
      const { title } = splitTitleContent(meeting.content);
      const body = editContentBody.trim();
      const content = body ? `${title}\n\n${body}` : title;
      const res = await updateProjectMeeting(meeting.id, { content });
      if (res.code === 0) {
        message.success('交流正文已更新');
        setMeeting(res.data);
        setEditContentVisible(false);
      } else {
        message.error(res.msg || '更新失败');
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '更新失败');
    } finally {
      setSaving(false);
    }
  }, [meeting, editContentBody]);

  // ── 追加备注 ──
  const handleAddNote = useCallback(async () => {
    if (!meeting || !newNoteText.trim()) return;
    setSaving(true);
    try {
      const existingNotes = Array.isArray(meeting.notes) ? meeting.notes : [];
      const newNote = {
        content: newNoteText.trim(),
        author: user?.nickname || user?.username || '未知用户',
        created_at: new Date().toISOString(),
      };
      const updatedNotes = [...existingNotes, newNote];
      const res = await updateProjectMeeting(meeting.id, { notes: updatedNotes });
      if (res.code === 0) {
        message.success('备注已添加');
        setMeeting(res.data);
        setNewNoteText('');
      } else {
        message.error(res.msg || '添加失败');
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '添加失败');
    } finally {
      setSaving(false);
    }
  }, [meeting, newNoteText, user]);

  if (!meeting && !loading) return null;

  const typeLabel = meeting ? getLabel(typeOptions, meeting.type) : '';
  const { title: contentTitle, body: contentBody } = meeting ? splitTitleContent(meeting.content) : { title: '', body: '' };
  const participantNames = meeting ? (meeting.participants ?? []).map((id) => displayName(id)).join('、') : '';
  const notes = meeting ? (Array.isArray(meeting.notes) ? meeting.notes : []).map(parseNote) : [];
  const linkedProposal = linkedProposals[0];
  const linkedTodo = linkedTodos[0];

  const renderDefItem = (label: string, value: React.ReactNode) => (
    <div className={styles.defItem ?? ''}>
      <span className={styles.defLabel ?? ''}>{label}</span>
      <span className={styles.defValue ?? ''}>{value}</span>
    </div>
  );

  /** 区块标题（可带编辑按钮） */
  const sectionHeader = (title: string, onEdit?: () => void) => (
    <div className={styles.sectionHeader ?? ''}>
      <span className={styles.sectionTitle ?? ''}>{title}</span>
      {canManageMeetings && onEdit && (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={onEdit}>
          编辑
        </Button>
      )}
    </div>
  );

  const tabItems = [
    {
      key: 'basic',
      label: '基础信息',
      children: (
        <div className={styles.tabContent ?? ''}>
          {sectionHeader('基础信息', openEditBasic)}
          <div className={styles.definitionList ?? ''}>
            {renderDefItem('类型', typeLabel)}
            {renderDefItem('会议主题', contentTitle || '-')}
            {renderDefItem('开始时间', meeting ? formatDate(meeting.started_at) : '-')}
            {renderDefItem('发言人', meeting?.speaker || '-')}
            {renderDefItem('参与人', participantNames || '-')}
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
            {renderDefItem(
              '关联待办',
              linkedTodo ? (
                <a
                  onClick={() => {
                    if (projectId) navigate(`/projects/${projectId}/todo/${linkedTodo.id}`);
                  }}
                >
                  {linkedTodo.number}
                </a>
              ) : (
                '-'
              ),
            )}
            {renderDefItem('创建时间', meeting ? formatDate(meeting.created_at) : '-')}
            {renderDefItem('更新时间', meeting ? formatDate(meeting.updated_at) : '-')}
          </div>
        </div>
      ),
    },
    {
      key: 'content',
      label: '交流内容',
      children: (
        <div className={styles.tabContent ?? ''}>
          {/* 交流正文 */}
          <div className={styles.textBlock ?? ''}>
            {sectionHeader('交流正文', openEditContent)}
            {contentBody ? (
              <div className={styles.textBody ?? ''}>{contentBody}</div>
            ) : (
              <Text type="secondary" style={{ fontSize: 'var(--text-body-sm-size)' }}>
                暂无正文内容
              </Text>
            )}
          </div>
          {/* 备注/讨论（追加式） */}
          <div className={styles.textBlock ?? ''}>
            {sectionHeader(`备注/讨论（${notes.length}）`)}
            {notes.length > 0 ? (
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                {notes.map((note, index) => (
                  <div key={`${note.author}-${note.created_at}-${index}`} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <Text strong style={{ fontSize: 'var(--text-body-sm-size)' }}>
                        {note.author || '未知用户'}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                        {note.created_at ? formatDate(note.created_at) : ''}
                      </Text>
                    </div>
                    <Text style={{ fontSize: 'var(--text-body-sm-size)' }}>
                      {note.content || '-'}
                    </Text>
                  </div>
                ))}
              </Space>
            ) : (
              <Text type="secondary" style={{ fontSize: 'var(--text-body-sm-size)', display: 'block', marginBottom: 16 }}>
                暂无备注/讨论
              </Text>
            )}
            {canManageMeetings && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Input.TextArea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="添加备注..."
                  maxLength={500}
                  autoSize={{ minRows: 1, maxRows: 3 }}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      void handleAddNote();
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <Button
                  type="primary"
                  onClick={() => void handleAddNote()}
                  loading={saving}
                  disabled={!newNoteText.trim()}
                  style={{ height: 'auto' }}
                >
                  添加
                </Button>
              </div>
            )}
          </div>
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
              {canManageMeetings && (
                <>
                  <Button
                    type="link"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setPendingProposalId(null);
                      setAddProposalVisible(true);
                    }}
                  >
                    添加已有
                  </Button>
                  <Button
                    type="link"
                    icon={<PlusOutlined />}
                    onClick={() => setCreateProposalVisible(true)}
                  >
                    新建并关联
                  </Button>
                </>
              )}
            </Space>
            {canManageMeetings ? (
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
              <Empty description="您没有交流管理权限，无法关联提案" />
            )}
          </div>
          <Divider />
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
              {canManageMeetings && (
                <>
                  <Button
                    type="link"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setPendingTodoId(null);
                      setAddTodoVisible(true);
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
            {canManageMeetings ? (
              linkedTodos.length > 0 ? (
                <List
                  dataSource={linkedTodos}
                  renderItem={(todo) => (
                    <List.Item
                      className={styles.linkedItem ?? ''}
                      onClick={() => {
                        if (projectId) navigate(`/projects/${projectId}/todo/${todo.id}`);
                      }}
                      style={{ cursor: 'pointer' }}
                      actions={[
                        <Button
                          key="disconnect-todo"
                          type="link"
                          danger
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDisconnectTodo();
                          }}
                        >
                          断开关联
                        </Button>
                        ,
                      ]}
                    >
                      <div className={styles.linkedContent ?? ''}>
                        <Space className={styles.linkedLink ?? ''} wrap>
                          <Text strong>{todo.number}</Text>
                          <Text>{todo.title}</Text>
                        </Space>
                        <Space size={4} style={{ marginTop: 'var(--spacing-xxs)' }} wrap>
                          <Tag
                            color={PRIORITY_COLOR[todo.priority] ?? 'default'}
                            style={{ marginRight: 0 }}
                          >
                            {getLabel(priorityOptions, todo.priority)}
                          </Tag>
                          <Tag
                            color={TODO_STATUS_COLOR[todo.status] ?? 'default'}
                            style={{ marginRight: 0 }}
                          >
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
              <Empty description="您没有交流管理权限，无法关联待办" />
            )}
          </div>
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回
          </Button>
          <Tooltip title={contentTitle || typeLabel}>
            <Title level={4} className={styles.title ?? ''}>
              {typeLabel}（{meeting ? formatDate(meeting.started_at) : '-'}）
            </Title>
          </Tooltip>
        </Space>
      </div>

      <Card>
        <Tabs items={tabItems} />
      </Card>

      {/* ── 基础信息编辑弹窗 ── */}
      <Modal
        title="编辑基础信息"
        open={editBasicVisible}
        onOk={() => void handleSaveBasic()}
        onCancel={() => setEditBasicVisible(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        destroyOnClose
        width={520}
        styles={{ body: { paddingBottom: 24 } }}
      >
        <Form form={basicForm} layout="vertical">
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={[...MEETING_TYPE_OPTIONS]} />
          </Form.Item>
          <Form.Item name="title" label="主题" rules={[{ required: true, message: '请输入交流主题' }]}>
            <TextArea rows={3} placeholder="请输入交流主题" maxLength={500} showCount />
          </Form.Item>
          <Form.Item name="started_at" label="时间" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="speaker" label="发言人">
            <Input placeholder="请输入发言人（可选）" maxLength={100} />
          </Form.Item>
          <Form.Item name="participants" label="参与人">
            <Select
              mode="multiple"
              placeholder="选择参与人（可选）"
              allowClear
              showSearch
              optionFilterProp="label"
              options={userOptions}
              maxTagCount="responsive"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── 交流正文编辑弹窗 ── */}
      <Modal
        title="编辑交流正文"
        open={editContentVisible}
        onOk={() => void handleSaveContent()}
        onCancel={() => setEditContentVisible(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        destroyOnClose
        width={560}
        styles={{ body: { paddingBottom: 24 } }}
      >
        <TextArea
          rows={10}
          value={editContentBody}
          onChange={(e) => setEditContentBody(e.target.value)}
          placeholder="请输入交流正文（换行保留）"
          maxLength={5000}
          showCount
        />
      </Modal>

      {/* 备注采用追加式，无需编辑弹窗 */}

      {/* ── 关联提案/待办弹窗 ── */}
      <MeetingModal
        project={project ?? ({} as Project)}
        open={false}
        onClose={() => {}}
        onSaved={() => {}}
        existingMeetings={[]}
      />

      <Modal
        title="添加关联提案"
        open={addProposalVisible}
        onOk={handleConfirmAddProposal}
        onCancel={() => {
          setAddProposalVisible(false);
          setPendingProposalId(null);
        }}
        okText="确认关联"
        cancelText="取消"
        destroyOnClose
        width={560}
        okButtonProps={{ disabled: !pendingProposalId }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>
          交流仅能关联一个提案，确认关联将替换原有提案：
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

      <Modal
        title="添加关联待办"
        open={addTodoVisible}
        onOk={handleConfirmAddTodo}
        onCancel={() => {
          setAddTodoVisible(false);
          setPendingTodoId(null);
        }}
        okText="确认关联"
        cancelText="取消"
        destroyOnClose
        width={560}
        okButtonProps={{ disabled: !pendingTodoId }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>
          交流仅能关联一个待办，确认关联将替换原有待办：
        </Text>
        <Select
          showSearch
          allowClear
          style={{ width: '100%' }}
          placeholder="选择要关联的待办"
          optionFilterProp="label"
          value={pendingTodoId}
          onChange={(value) => setPendingTodoId(value ?? null)}
          options={unlinkedTodos.map((t) => ({
            value: t.id,
            label: `${t.number} ${t.title}`,
          }))}
        />
      </Modal>

      <TodoModal
        project={project ?? ({} as Project)}
        open={createTodoVisible}
        existingTodos={todos}
        onClose={() => setCreateTodoVisible(false)}
        onSaved={() => {
          void fetchMeeting();
        }}
      />
      <ProposalModal
        project={project ?? ({} as Project)}
        open={createProposalVisible}
        existingProposals={proposals}
        onClose={() => setCreateProposalVisible(false)}
        onSaved={() => {
          void fetchMeeting();
        }}
      />
    </div>
    </Spin>
  );
}