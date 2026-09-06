import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Empty,
  Input,
  message,
  Modal,
  Pagination,
  Segmented,
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
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { Project } from '../../../types/project';
import type { ProjectMeeting } from '../../../types/project-meeting';
import {
  deleteProjectMeeting,
  listProjectMeetings,
} from '../../../api/project-meetings';
import type { ProjectMeetingListParams } from '../../../api/project-meetings';
import { listUsers } from '../../../api/users';
import { MEETING_TYPE_OPTIONS } from '../../../constants/project';
import { getUserId, isAdmin } from '../../../utils/auth';
import { useUser } from '../../../contexts/UserContext';
import MeetingModal from '../components/MeetingModal';
import type { User } from '../../../types/user';
import styles from './MeetingRecordTab.module.css';

const { Text } = Typography;

const PAGE_SIZE = 10;

/** 类型标签配色（未命中时回退 default） */
const TYPE_TAG_COLOR: Record<string, string> = {
  '会议纪要': 'blue',
  '沟通记录': 'green',
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

/** 用户选项（下拉选择使用） */
interface UserOption {
  id: string;
  nickname: string;
  username: string;
}

export default function MeetingRecordTab({ project }: { project: Project }) {
  const { user } = useUser();
  const navigate = useNavigate();
  // ── 数据状态 ──
  const [meetings, setMeetings] = useState<ProjectMeeting[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  // ── 弹窗状态（共用组件 MeetingModal） ──
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<ProjectMeeting | null>(null);

  // ── 用户选项 ──
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);

  // ── 权限 ──
  const currentUserId = getUserId();
  const isOwner = !!currentUserId && project.owner_id === currentUserId;
  const isAdminUser = isAdmin();
  const meetingPermission = project.member_permissions?.[user?.id ?? '']?.['meetings'];
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
          page_size: pageSize,
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
  }, [project.id, page, pageSize, filterType]);

  useEffect(() => {
    void fetchMeetings();
  }, [fetchMeetings]);

  // ── 类型筛选切换 ──
  const handleFilterChange = useCallback((value: string | number) => {
    setFilterType(String(value));
    setPage(1);
  }, []);

  const filteredMeetings = useMemo(() => {
    const kw = searchText.trim().toLowerCase();
    if (!kw) return meetings;
    return meetings.filter((m) => {
      const { title, body } = splitTitleContent(m.content);
      return (
        title.toLowerCase().includes(kw) ||
        body.toLowerCase().includes(kw) ||
        m.number.toLowerCase().includes(kw)
      );
    });
  }, [meetings, searchText]);

  // ── 打开新建/编辑（弹窗共用 MeetingModal） ──
  const openCreate = useCallback(() => {
    setEditingMeeting(null);
    setMeetingModalOpen(true);
  }, []);

  const openEdit = useCallback((m: ProjectMeeting) => {
    setEditingMeeting(m);
    setMeetingModalOpen(true);
  }, []);

  // ── 新建/编辑统一由共用组件 MeetingModal 处理，见组件底部渲染 ──

  // ── 删除记录 ──
  const handleDelete = useCallback(
    (m: ProjectMeeting) => {
      Modal.confirm({
        title: '确认删除',
        icon: <ExclamationCircleOutlined />,
        content: `确定要删除交流记录「${m.number}」吗？此操作不可撤销。`,
        okText: '删除',
        okButtonProps: { danger: true },
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

  // ── 进入详情页 ──
  const handleGoToDetail = useCallback(
    (m: ProjectMeeting) => {
      navigate(`/projects/${project.id}/meeting/${m.id}`);
    },
    [project.id, navigate],
  );

  // ── 分页切换 ──
  const handlePageChange = useCallback((p: number, ps?: number) => {
    setPage(p);
    if (ps) setPageSize(ps);
  }, []);

  // ── 渲染 ──
  return (
    <div className={styles.flexColumnFill ?? ''}>
      {/* 顶栏：类型筛选 + 搜索 + 新建 */}
      <div className={styles.listToolbar ?? ''}>
        <Space>
          <Segmented
            options={FILTER_OPTIONS}
            value={filterType}
            onChange={handleFilterChange}
            className={styles.filterSegmented ?? ''}
          />
          <Input
            className={styles.searchInput ?? ''}
            variant="filled"
            placeholder="搜索交流记录..."
            prefix={<SearchOutlined style={{ color: 'var(--text-secondary)' }} />}
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
            }}
            allowClear
          />
        </Space>
        <Space>
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
        </Space>
      </div>

      {/* 记录列表 */}
      <div className={styles.meetingList ?? ''}>
        <Spin spinning={loading}>
          {filteredMeetings.length === 0 ? (
            <Empty
              description={
                meetings.length === 0
                  ? loading
                    ? '加载中...'
                    : '暂无交流记录'
                  : '无匹配的交流记录'
              }
              className={styles.emptyState ?? ''}
            >
              {meetings.length === 0 && !loading && canManage && (
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                  创建第一条记录
                </Button>
              )}
            </Empty>
          ) : (
            filteredMeetings.map((m) => {
              const { title, body } = splitTitleContent(m.content);
              const summary = title || body || '无内容';
              const typeLabel = getTypeLabel(m.type);
              const typeColor = TYPE_TAG_COLOR[m.type] ?? 'default';
              const participantText = (m.participants ?? []).map(
                (id) => userLabelMap[id] ?? id,
              );

              return (
                <div key={m.id} className={styles.meetingCard ?? ''}>
                  <button
                    type="button"
                    className={styles.meetingRow ?? ''}
                    tabIndex={0}
                    onClick={() => handleGoToDetail(m)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleGoToDetail(m);
                      }
                    }}
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
            pageSize={pageSize}
            onChange={handlePageChange}
            showSizeChanger
            showQuickJumper
            pageSizeOptions={[10, 20, 50]}
            showTotal={(t) => `共 ${t} 条`}
          />
        </div>
      )}

      {/* 新建/编辑 交流记录（共用组件） */}
      <MeetingModal
        project={project}
        open={meetingModalOpen}
        editingMeeting={editingMeeting}
        existingMeetings={meetings}
        onClose={() => setMeetingModalOpen(false)}
        onSaved={() => void fetchMeetings()}
      />
    </div>
  );
}
