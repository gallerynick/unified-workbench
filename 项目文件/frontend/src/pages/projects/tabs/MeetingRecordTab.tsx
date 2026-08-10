import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AutoComplete,
  Button,
  DatePicker,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Pagination,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  PlusOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Project } from '../../../types/project';
import type { ProjectMeeting } from '../../../types/project-meeting';
import {
  createProjectMeeting,
  deleteProjectMeeting,
  listProjectMeetings,
  updateProjectMeeting,
} from '../../../api/project-meetings';
import type { ProjectMeetingListParams } from '../../../api/project-meetings';
import { listUsers } from '../../../api/users';
import { MEETING_TYPE_OPTIONS, PROJECT_NUMBER_PREFIX } from '../../../constants/project';
import { getUserId, isAdmin } from '../../../utils/auth';
import type { User } from '../../../types/user';
import styles from './MeetingRecordTab.module.css';

const { Text } = Typography;
const { TextArea } = Input;

const PAGE_SIZE = 10;

/** 类型标签配色（未命中时回退 default） */
const TYPE_TAG_COLOR: Record<string, string> = {
  meeting: 'blue',
  communication: 'green',
};

/** 类型筛选选项：全部 + 预设类型 */
const FILTER_OPTIONS = [
  { label: '全部', value: 'all' },
  ...MEETING_TYPE_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
];

/** 类型标签文案（自由填写类型原样展示） */
function getTypeLabel(type: string): string {
  return MEETING_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

/**
 * 内容字段约定：后端无独立 title 字段，若填写了标题则按「标题\n\n正文」存储于 content，
 * 展示时再拆分还原，避免臆造不存在的 API 字段。
 */
function splitTitleContent(content: string | null): { title: string; body: string } {
  const raw = content ?? '';
  const idx = raw.indexOf('\n\n');
  if (idx === -1) return { title: '', body: raw };
  return { title: raw.slice(0, idx).trim(), body: raw.slice(idx + 2) };
}

function joinTitleContent(title: string, body: string): string {
  const t = title.trim();
  const b = body.trim();
  if (t) return b ? `${t}\n\n${b}` : t;
  return b;
}

/** 格式化时间 */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 安全解析 notes 数组元素 */
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

/** 用户选项（下拉选择使用） */
interface UserOption {
  id: string;
  nickname: string;
  username: string;
}

export default function MeetingRecordTab({ project }: { project: Project }) {
  // ── 数据状态 ──
  const [meetings, setMeetings] = useState<ProjectMeeting[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── 表单状态 ──
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<ProjectMeeting | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // ── 备注输入 ──
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  // ── 用户选项 ──
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);

  // ── 权限 ──
  const currentUserId = getUserId();
  const isOwner = !!currentUserId && project.owner_id === currentUserId;
  const isAdminUser = isAdmin();
  const meetingPermission = project.member_permissions?.['meetings'];
  const canManage = isAdminUser || isOwner || meetingPermission !== 'readonly';

  // ── 加载用户列表（静默失败） ──
  useEffect(() => {
    listUsers({ page: 1, page_size: 100 })
      .then((res) => {
        if (res.code === 0 && Array.isArray(res.data.items)) {
          setUserOptions(
            res.data.items.map((u: User) => ({
              id: u.id,
              nickname: u.nickname,
              username: u.username,
            })),
          );
        }
      })
      .catch(() => {
        /* 静默失败 */
      });
  }, []);

  // ── 用户 id → 显示名 映射 ──
  const userLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of userOptions) {
      map[u.id] = `${u.nickname} (${u.username})`;
    }
    return map;
  }, [userOptions]);

  // ── 拉取交流记录列表 ──
  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const params: ProjectMeetingListParams = {
        project_id: project.id,
        page,
        page_size: PAGE_SIZE,
      };
      if (filterType !== 'all') params.type = filterType;
      const res = await listProjectMeetings(params);
      if (res.code === 0) {
        setMeetings(res.data.items);
        setTotal(res.data.total);
      } else {
        void message.error(res.msg || '获取交流记录失败');
      }
    } catch {
      void message.error('获取交流记录失败');
    } finally {
      setLoading(false);
    }
  }, [project.id, page, filterType]);

  useEffect(() => {
    void fetchMeetings();
  }, [fetchMeetings]);

  // ── 类型筛选切换 ──
  const handleFilterChange = useCallback((value: string | number) => {
    setFilterType(String(value));
    setPage(1);
    setExpandedId(null);
  }, []);

  // ── 展开/收起详情 ──
  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // ── 打开新建 ──
  const openCreate = useCallback(() => {
    setEditing(null);
    setModalVisible(true);
  }, []);

  // ── 打开编辑 ──
  const openEdit = useCallback((m: ProjectMeeting) => {
    setEditing(m);
    setModalVisible(true);
  }, []);

  // ── 弹窗打开时填充/重置表单 ──
  useEffect(() => {
    if (!modalVisible) return;
    if (editing) {
      const { title, body } = splitTitleContent(editing.content);
      form.setFieldsValue({
        type: editing.type,
        title,
        speaker: editing.speaker ?? '',
        participants: editing.participants ?? [],
        content: body,
        started_at: editing.started_at ? dayjs(editing.started_at) : undefined,
      });
    } else {
      form.resetFields();
    }
  }, [modalVisible, editing, form]);

  // ── 提交新建/编辑 ──
  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const content = joinTitleContent(values.title ?? '', values.content ?? '');
      const common = {
        type: values.type as string,
        started_at: (values.started_at as dayjs.Dayjs).toISOString(),
        speaker: values.speaker as string,
        participants: (values.participants as string[] | undefined) ?? [],
        content,
      };

      if (editing) {
        const res = await updateProjectMeeting(editing.id, common);
        if (res.code === 0) {
          void message.success('交流记录已更新');
          setModalVisible(false);
          void fetchMeetings();
        } else {
          void message.error(res.msg || '更新失败');
        }
      } else {
        // 编号：MTG-{项目编号}-{项目内序号}，序号 = 当前总数 + 1
        const numRes = await listProjectMeetings({ project_id: project.id, page: 1, page_size: 1 });
        const seq = (numRes.code === 0 ? numRes.data.total : 0) + 1;
        const projTag = project.number ?? project.id.slice(0, 8).toUpperCase();
        const number = `${PROJECT_NUMBER_PREFIX.meeting}${projTag}-${String(seq).padStart(3, '0')}`;

        const res = await createProjectMeeting({ project_id: project.id, number, ...common });
        if (res.code === 0) {
          void message.success('交流记录已创建');
          setModalVisible(false);
          void fetchMeetings();
        } else {
          void message.error(res.msg || '创建失败');
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        void message.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [form, editing, project.id, project.number, fetchMeetings]);

  // ── 删除记录 ──
  const handleDelete = useCallback(
    (m: ProjectMeeting) => {
      Modal.confirm({
        title: '确认删除',
        icon: <ExclamationCircleOutlined />,
        content: `确定要删除交流记录「${m.number}」吗？此操作不可撤销。`,
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          try {
            const res = await deleteProjectMeeting(m.id);
            if (res.code === 0) {
              void message.success('交流记录已删除');
              void fetchMeetings();
            } else {
              void message.error(res.msg || '删除失败');
            }
          } catch (err: unknown) {
            void message.error(err instanceof Error ? err.message : '删除失败');
          }
        },
      });
    },
    [fetchMeetings],
  );

  // ── 追加备注（在 notes 末尾 push 后整组提交） ──
  const handleAppendNote = useCallback(
    async (m: ProjectMeeting) => {
      if (!canManage) return;
      const text = (noteDrafts[m.id] ?? '').trim();
      if (!text) {
        void message.warning('请输入备注内容');
        return;
      }
      const currentNotes = Array.isArray(m.notes) ? m.notes : [];
      const note = {
        content: text,
        author: currentUserId ?? 'unknown',
        created_at: new Date().toISOString(),
      };
      try {
        const res = await updateProjectMeeting(m.id, { notes: [...currentNotes, note] });
        if (res.code === 0) {
          void message.success('备注已添加');
          setNoteDrafts((prev) => ({ ...prev, [m.id]: '' }));
          void fetchMeetings();
        } else {
          void message.error(res.msg || '添加备注失败');
        }
      } catch (err: unknown) {
        void message.error(err instanceof Error ? err.message : '添加备注失败');
      }
    },
    [canManage, currentUserId, noteDrafts, fetchMeetings],
  );

  // ── 分页切换 ──
  const handlePageChange = useCallback((p: number) => {
    setPage(p);
    setExpandedId(null);
  }, []);

  // ── 渲染 ──
  return (
    <div className={styles.flexColumnFill ?? ''}>
      {/* 顶栏：类型筛选 + 新建 */}
      <div className={styles.listToolbar ?? ''}>
        <Segmented
          options={FILTER_OPTIONS}
          value={filterType}
          onChange={handleFilterChange}
          className={styles.filterSegmented ?? ''}
        />
        <Tooltip title={canManage ? undefined : '只读权限，无法新建记录'}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
            disabled={!canManage}
          >
            新建记录
          </Button>
        </Tooltip>
      </div>

      {/* 记录列表 */}
      <div className={styles.meetingList ?? ''}>
        <Spin spinning={loading}>
          {meetings.length === 0 ? (
            <Empty
              description={loading ? '加载中...' : '暂无交流记录'}
              className={styles.emptyState ?? ''}
            >
              {!loading && canManage && (
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                  创建第一条记录
                </Button>
              )}
            </Empty>
          ) : (
            meetings.map((m) => {
              const { title, body } = splitTitleContent(m.content);
              const summary = title || body || '无内容';
              const isExpanded = expandedId === m.id;
              const typeLabel = getTypeLabel(m.type);
              const typeColor = TYPE_TAG_COLOR[m.type] ?? 'default';
              const notes = (Array.isArray(m.notes) ? m.notes : []).map(parseNote);
              const participantText = (m.participants ?? []).map(
                (id) => userLabelMap[id] ?? id,
              );

              return (
                <div key={m.id} className={styles.meetingCard ?? ''}>
                  <button
                    type="button"
                    className={styles.meetingRow ?? ''}
                    onClick={() => toggleExpand(m.id)}
                  >
                    <FileTextOutlined
                      style={{
                        fontSize: 'var(--text-heading-4-size)',
                        color: 'var(--color-info)',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className={styles.meetingTitleLine ?? ''}>
                        <Text strong style={{ fontSize: 'var(--text-body-sm-size)' }} ellipsis>
                          {title || summary}
                        </Text>
                        <Tag color={typeColor}>{typeLabel}</Tag>
                        <Text
                          type="secondary"
                          style={{ fontSize: 'var(--text-caption-size)', flexShrink: 0 }}
                        >
                          {m.number}
                        </Text>
                      </div>
                      <div className={styles.meetingMetaLine ?? ''}>
                        <span className={styles.metaItem ?? ''}>
                          <UserOutlined />
                          {m.speaker || '未指定'}
                        </span>
                        <span className={styles.metaItem ?? ''}>
                          <TeamOutlined />
                          {participantText.length > 0 ? participantText.join('、') : '无参与人'}
                        </span>
                        <span className={styles.metaItem ?? ''}>
                          <ClockCircleOutlined />
                          {formatDate(m.started_at)}
                        </span>
                      </div>
                      {!title && (
                        <div className={styles.meetingSummary ?? ''}>
                          <Text
                            type="secondary"
                            style={{ fontSize: 'var(--text-body-xs-size)' }}
                            ellipsis
                          >
                            {summary}
                          </Text>
                        </div>
                      )}
                    </div>
                    {canManage ? (
                      <Space size={2} onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="编辑">
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            aria-label="编辑"
                            onClick={() => openEdit(m)}
                          />
                        </Tooltip>
                        <Tooltip title="删除">
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            aria-label="删除"
                            onClick={() => handleDelete(m)}
                          />
                        </Tooltip>
                      </Space>
                    ) : (
                      <Tooltip title="只读权限，无法操作">
                        <Space size={2} onClick={(e) => e.stopPropagation()}>
                          <Button type="text" size="small" icon={<EditOutlined />} disabled />
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} disabled />
                        </Space>
                      </Tooltip>
                    )}
                  </button>

                  {/* 展开详情：完整内容 + 备注 + 追加 */}
                  {isExpanded && (
                    <div className={styles.expandArea ?? ''}>
                      {title && (
                        <Text
                          strong
                          style={{
                            display: 'block',
                            marginBottom: 'var(--spacing-xs)',
                            fontSize: 'var(--text-body-sm-size)',
                          }}
                        >
                          {title}
                        </Text>
                      )}
                      <div className={styles.fullContent ?? ''}>{body || '无内容'}</div>

                      {notes.length > 0 && (
                        <div className={styles.notesSection ?? ''}>
                          <Text
                            strong
                            style={{
                              fontSize: 'var(--text-body-xs-size)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            备注（{notes.length}）
                          </Text>
                          {notes.map((n) => (
                            <div
                              key={`${n.created_at}-${n.content}`}
                              className={styles.noteItem ?? ''}
                            >
                              <div className={styles.noteText ?? ''}>{n.content || '-'}</div>
                              <div className={styles.noteMeta ?? ''}>
                                {(userLabelMap[n.author] ?? n.author) || '未知'} ·{' '}
                                {formatDate(n.created_at)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {canManage && (
                        <div className={styles.noteInputRow ?? ''}>
                          <TextArea
                            rows={2}
                            placeholder="添加备注..."
                            value={noteDrafts[m.id] ?? ''}
                            onChange={(e) =>
                              setNoteDrafts((prev) => ({
                                ...prev,
                                [m.id]: e.target.value,
                              }))
                            }
                          />
                          <Button type="primary" onClick={() => void handleAppendNote(m)}>
                            添加备注
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </Spin>
      </div>

      {/* 分页 */}
      {total > PAGE_SIZE && (
        <div className={styles.footer ?? ''}>
          <Pagination
            current={page}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={handlePageChange}
            showSizeChanger={false}
            showTotal={(t) => `共 ${t} 条`}
          />
        </div>
      )}

      {/* 新建/编辑 Modal */}
      <Modal
        title={editing ? '编辑交流记录' : '新建交流记录'}
        open={modalVisible}
        onOk={() => void handleSubmit()}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        destroyOnClose
        width={600}
        styles={{
          body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' },
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: '请选择或输入类型' }]}
          >
            <AutoComplete
              options={MEETING_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              placeholder="选择或输入类型"
              allowClear
            />
          </Form.Item>
          <Form.Item name="title" label="标题（可选）">
            <Input placeholder="请输入标题（可选）" maxLength={200} showCount />
          </Form.Item>
          <Form.Item
            name="speaker"
            label="发言人"
            rules={[{ required: true, message: '请输入发言人' }]}
          >
            <AutoComplete
              options={userOptions.map((u) => ({
                value: u.nickname,
                label: `${u.nickname} (${u.username})`,
              }))}
              placeholder="选择用户或自由输入"
              allowClear
            />
          </Form.Item>
          <Form.Item name="participants" label="参与人">
            <Select
              mode="multiple"
              options={userOptions.map((u) => ({
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
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <TextArea rows={5} placeholder="请输入交流记录内容" maxLength={5000} showCount />
          </Form.Item>
          <Form.Item
            name="started_at"
            label="时间"
            rules={[{ required: true, message: '请选择时间' }]}
          >
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              placeholder="请选择时间"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
