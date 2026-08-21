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
  deleteProjectMeeting,
  getProjectMeeting,
  updateProjectMeeting,
} from '../../api/project-meetings';
import { listProjectProposals } from '../../api/project-proposals';
import { listProjectTodos } from '../../api/project-todos';
import { getProject } from '../../api/projects';
import { listUsers } from '../../api/users';
import { MEETING_TYPE_OPTIONS } from '../../constants/project';
import { useUser } from '../../contexts/UserContext';
import type { Project } from '../../types/project';
import type { ProjectMeeting } from '../../types/project-meeting';
import type { ProjectProposal } from '../../types/project-proposal';
import type { ProjectTodo } from '../../types/project-todo';
import type { User } from '../../types/user';
import styles from './MeetingDetailPage.module.css';

const { Text, Title } = Typography;

function getLabel(
  options: { value: string; label: string }[],
  value: string | null | undefined,
): string {
  if (!value) return '-';
  return options.find((o) => o.value === value)?.label ?? value;
}

const typeOptions: { value: string; label: string }[] = MEETING_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

/** 格式化时间 */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 备注对象的最小可用字段（从 unknown[] 中安全解析） */
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

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editUsers, setEditUsers] = useState<User[]>([]);

  const [addProposalVisible, setAddProposalVisible] = useState(false);
  const [pendingProposalId, setPendingProposalId] = useState<string | null>(null);
  const [addTodoVisible, setAddTodoVisible] = useState(false);
  const [pendingTodoId, setPendingTodoId] = useState<string | null>(null);

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

  const unlinkedTodos = useMemo(() => {
    if (!meeting) return todos;
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

  const handleDisconnectProposal = useCallback(async () => {
    if (!meeting) return;
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
  }, [meeting]);

  const handleConfirmAddProposal = useCallback(async () => {
    if (!meeting) return;
    try {
      const res = await updateProjectMeeting(meeting.id, { proposal_id: pendingProposalId ?? null });
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

  const handleDisconnectTodo = useCallback(async () => {
    if (!meeting) return;
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
  }, [meeting]);

  const handleConfirmAddTodo = useCallback(async () => {
    if (!meeting) return;
    try {
      const res = await updateProjectMeeting(meeting.id, { todo_id: pendingTodoId ?? null });
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

  const openEdit = useCallback(() => {
    if (!meeting) return;
    setEditModalVisible(true);
  }, [meeting]);

  useEffect(() => {
    if (!editModalVisible) return;
    listUsers({ page_size: 100 })
      .then((res) => {
        if (res.code === 0) setEditUsers(res.data.items);
      })
      .catch(() => {});
  }, [editModalVisible]);

  useEffect(() => {
    if (!editModalVisible || !meeting) return;
    const body = meeting.content?.split('\n\n', 2)[1] || '';
    editForm.setFieldsValue({
      speaker: meeting.speaker ?? '',
      participants: meeting.participants ?? [],
      content: body,
    });
  }, [editModalVisible, meeting, editForm]);

  const handleEditSubmit = useCallback(async () => {
    if (!meeting) return;
    try {
      const values = await editForm.validateFields();
      setEditSubmitting(true);
      const title = meeting.content?.split('\n\n')[0] || '';
      const newContent = title ? `${title}\n\n${values.content || ''}` : (values.content || '');
      const res = await updateProjectMeeting(meeting.id, {
        speaker: values.speaker || null,
        participants: values.participants || [],
        content: newContent,
      });
      if (res.code === 0) {
        message.success('交流记录已更新');
        setEditModalVisible(false);
        await fetchMeeting();
      } else {
        message.error(res.msg || '更新失败');
      }
    } catch (err: unknown) {
      if (err instanceof Error) message.error(err.message);
    } finally {
      setEditSubmitting(false);
    }
  }, [meeting, editForm, fetchMeeting]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!meeting) return null;

  const typeLabel = getLabel(typeOptions, meeting.type);
  const participantNames = (meeting.participants ?? []).map((id) => displayName(id));
  const notes = (Array.isArray(meeting.notes) ? meeting.notes : []).map(parseNote);

  const tabItems = [
    {
      key: 'detail',
      label: '交流详情',
      children: (
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="编号">{meeting.number}</Descriptions.Item>
          <Descriptions.Item label="类型">{typeLabel}</Descriptions.Item>
          <Descriptions.Item label="会议主题" span={2}>
            <Text>{meeting.content ? meeting.content.split('\n\n')[0] || meeting.content : '-'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="开始时间">
            {formatDate(meeting.started_at)}
          </Descriptions.Item>
          <Descriptions.Item label="发言人">
            {meeting.speaker || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="参与人">
            {participantNames.length > 0 ? (
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                {(meeting.participants ?? []).map((id) => (
                  <Text key={id || `p-${id}`}>{displayName(id)}</Text>
                ))}
              </Space>
            ) : (
              <Text>-</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="交流内容" span={2}>
            <Text>{meeting.content || '-'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="备注">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              {notes.length > 0 ? (
                 notes.map((note) => (
                  <Text key={`${note.author}-${note.created_at}-${note.content}`} style={{ fontSize: 'var(--text-body-xs-size)' }}>
                    {note.content || '-'}
                    {note.author ? (
                      <Text type="secondary" style={{ marginLeft: 'var(--spacing-xs)' }}>
                        （{note.author}{note.created_at ? ` · ${formatDate(note.created_at)}` : ''}）
                      </Text>
                    ) : null}
                  </Text>
                ))
              ) : (
                <Text>-</Text>
              )}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="关联提案 ID">
            {meeting.proposal_id || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {formatDate(meeting.created_at)}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {formatDate(meeting.updated_at)}
          </Descriptions.Item>
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
                {meeting.proposal_id && (
                  <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                    （1）
                  </Text>
                )}
              </Title>
              {canManageMeetings && (
                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setPendingProposalId(null);
                    setAddProposalVisible(true);
                  }}
                >
                  添加
                </Button>
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
              <Empty description="您没有交流管理权限，无法关联提案" />
            )}
          </div>
          <Divider />
          <div>
            <Space size="small" style={{ marginBottom: 'var(--spacing-sm)' }}>
              <Title level={5} style={{ margin: 0 }}>
                关联待办
                {meeting.todo_id && (
                  <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                    （1）
                  </Text>
                )}
              </Title>
              {canManageMeetings && (
                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setPendingTodoId(null);
                    setAddTodoVisible(true);
                  }}
                >
                  添加
                </Button>
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
                            void handleDisconnectTodo();
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
              <Empty description="您没有交流管理权限，无法关联待办" />
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
          <Title level={4} className={styles.title ?? ''}>
            {meeting.number} {typeLabel}（{formatDate(meeting.started_at)}）
          </Title>
        </Space>
        <Space>
          <Tooltip title="编辑">
            <Button
              icon={<EditOutlined />}
              onClick={openEdit}
              disabled={!canManageMeetings}
            />
          </Tooltip>
          {canManageMeetings ? (
            <Tooltip title="删除">
              <Button danger icon={<DeleteOutlined />} onClick={handleDeleteMeeting} />
            </Tooltip>
          ) : (
            <Tooltip title="只读权限，无法删除">
              <Button danger icon={<DeleteOutlined />} disabled />
            </Tooltip>
          )}
        </Space>
      </div>

      <Card>
        <Tabs items={tabItems} />
      </Card>

      <Modal
        title="编辑交流内容"
        open={editModalVisible}
        onOk={() => void handleEditSubmit()}
        onCancel={() => setEditModalVisible(false)}
        confirmLoading={editSubmitting}
        destroyOnClose
        width={600}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="speaker"
            label="发言人"
            rules={[{ required: true, message: '请输入发言人' }]}
          >
            <Input placeholder="请输入发言人" />
          </Form.Item>
          <Form.Item name="participants" label="参与人">
            <Select
              mode="multiple"
              options={editUsers.map((u) => ({
                value: u.id,
                label: `${u.nickname} (${u.username})`,
              }))}
              placeholder="选择参与人（可选）"
              allowClear
              maxTagCount="responsive"
            />
          </Form.Item>
          <Form.Item
            name="content"
            label="交流内容"
            rules={[{ required: true, message: '请输入交流内容' }]}
          >
            <Input.TextArea rows={8} placeholder="请输入交流内容" maxLength={5000} showCount />
          </Form.Item>
        </Form>
      </Modal>

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
      >
        <Select
          style={{ width: '100%' }}
          placeholder="选择要关联的待办"
          value={pendingTodoId}
          onChange={setPendingTodoId}
          options={unlinkedTodos.map((t) => ({
            value: t.id,
            label: `${t.number} ${t.title}`,
          }))}
        />
      </Modal>
    </div>
  );
}