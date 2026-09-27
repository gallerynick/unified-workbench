import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Checkbox,
  Descriptions,
  message,
  Modal,
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
} from '@ant-design/icons';
import {
  deleteProjectEvent,
  getProjectEvent,
} from '../../api/project-events';
import { getProject } from '../../api/projects';
import { listUsers } from '../../api/users';
import { EVENT_TYPE_OPTIONS } from '../../constants/project';
import { useUser } from '../../contexts/UserContext';
import EventModal from './components/EventModal';
import type { Project } from '../../types/project';
import type { ProjectEvent } from '../../types/project-event';
import type { User } from '../../types/user';
import styles from './EventDetailPage.module.css';

const { Text, Title } = Typography;

const EVENT_TYPE_COLOR: Record<string, string> = {
  handover: 'blue',
  archive: 'orange',
  close: 'red',
  reopen: 'green',
  owner_change: 'purple',
  other: 'default',
};

const eventTypeOptions: { value: string; label: string }[] = EVENT_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

const HANDOVER_TYPE_LABEL: Record<string, string> = {
  overall: '整体交接',
  module: '模块交接',
  temporary: '临时接管',
  other: '其他',
};

const DIMENSION_LABEL: Record<string, string> = {
  business: '业务功能',
  tech: '技术架构',
  data: '数据规范',
  ops: '运维支撑',
};

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

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** details 中移交表单的保留键（不进入键值对列表） */
const HANDOVER_DETAIL_KEYS = new Set([
  'handover_transfer', 'assignee', 'supervisor', 'handover_type',
  'handover_date', 'transition_days', 'checked_dimensions', 'asset_list', 'signatures',
]);

export default function EventDetailPage() {
  const { id: projectId, eventId } = useParams<{ id: string; eventId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();

  const [event, setEvent] = useState<ProjectEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [editVisible, setEditVisible] = useState(false);
  const [allEvents, setAllEvents] = useState<ProjectEvent[]>([]);

  const isOwner = !!user && user.id === project?.owner_id;
  const isAdmin = user?.role === 'admin';
  const eventsPerm = project?.member_permissions?.[user?.id ?? '']?.events;
  const canOperate = isOwner || isAdmin || eventsPerm !== 'readonly';

  const fetchEvent = useCallback(async () => {
    if (!projectId || !eventId) return;
    setLoading(true);
    try {
      const [eventRes, projectRes, userRes] = await Promise.all([
        getProjectEvent(eventId),
        getProject(projectId),
        listUsers({ page_size: 100 }),
      ]);
      if (eventRes.code === 0) {
        setEvent(eventRes.data);
      } else {
        message.error(eventRes.msg || '获取事件失败');
        navigate(`/projects/${projectId}`);
      }
      if (projectRes.code === 0) setProject(projectRes.data);
      if (userRes.code === 0) setUsers(userRes.data.items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取事件失败';
      message.error(msg);
      navigate(`/projects/${projectId}`);
    } finally {
      setLoading(false);
    }
  }, [projectId, eventId, navigate]);

  useEffect(() => {
    void fetchEvent();
  }, [fetchEvent]);

  // 加载项目所有事件（用于 EventModal 编号生成）
  useEffect(() => {
    if (!projectId) return;
    import('../../api/project-events').then(({ listProjectEvents }) => {
      listProjectEvents({ project_id: projectId, page_size: 100 }).then((res) => {
        if (res.code === 0) setAllEvents(res.data.items);
      }).catch(() => {});
    });
  }, [projectId]);

  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  const displayName = useCallback(
    (id: string | null | undefined): string => {
      if (!id) return '-';
      const u = userMap.get(id);
      if (u) return u.nickname || u.username;
      return `${id.slice(0, 8)}...`;
    },
    [userMap],
  );

  const handleBack = () => {
    if (projectId) navigate(`/projects/${projectId}`);
  };

  const handleDelete = useCallback(() => {
    if (!event) return;
    Modal.confirm({
      title: '确认删除事件',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除事件「${event.number} ${event.title}」吗？此操作不可恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteProjectEvent(event.id);
          if (res.code === 0) {
            message.success('事件已删除');
            if (projectId) navigate(`/projects/${projectId}`);
          } else {
            message.error(res.msg || '删除失败');
          }
        } catch (err: unknown) {
          message.error(err instanceof Error ? err.message : '删除失败');
        }
      },
    });
  }, [event, projectId, navigate]);

  if (!event && !loading) return null;

  const typeColor = EVENT_TYPE_COLOR[event?.event_type ?? ''] ?? 'default';
  const typeLabel = getLabel(eventTypeOptions, event?.event_type);
  const isHandover = event?.event_type === 'handover';
  const details = event?.details ?? {};

  // 非移交事件的键值对列表
  const kvPairs = isHandover ? [] : Object.entries(details).filter(
    ([k]) => !HANDOVER_DETAIL_KEYS.has(k),
  );

  const renderDefItem = (label: string, value: React.ReactNode) => (
    <div className={styles.defItem ?? ''}>
      <span className={styles.defLabel ?? ''}>{label}</span>
      <span className={styles.defValue ?? ''}>{value}</span>
    </div>
  );

  const tabItems = [
    {
      key: 'detail',
      label: '事件详情',
      children: (
        <div className={styles.tabContent ?? ''}>
          {/* 基础信息 */}
          <div className={styles.textBlock ?? ''}>
            <div className={styles.sectionHeader ?? ''}>
              <span className={styles.sectionTitle ?? ''}>基础信息</span>
              {canOperate && (
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => setEditVisible(true)}>
                  编辑
                </Button>
              )}
            </div>
            <div className={styles.definitionList ?? ''}>
              {renderDefItem('编号', event?.number ?? '-')}
              {renderDefItem('事件类型', <Tag color={typeColor}>{typeLabel}</Tag>)}
              {renderDefItem('标题', event?.title ?? '-')}
              {renderDefItem('操作人', displayName(event?.operator_id))}
              {renderDefItem('创建时间', event ? formatDate(event.created_at) : '-')}
            </div>
          </div>

          {/* 移交事件：结构化展示 */}
          {isHandover && (
            <>
              <div className={styles.textBlock ?? ''}>
                <div className={styles.sectionTitle ?? ''}>移交信息</div>
                <Descriptions column={2} size="small" bordered>
                  <Descriptions.Item label="移交方">{displayName(details.handover_transfer as string)}</Descriptions.Item>
                  <Descriptions.Item label="承接方">{displayName(details.assignee as string)}</Descriptions.Item>
                  <Descriptions.Item label="监督方">{details.supervisor ? displayName(details.supervisor as string) : '-'}</Descriptions.Item>
                  <Descriptions.Item label="交接类型">{HANDOVER_TYPE_LABEL[details.handover_type as string] ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="交接日期">{formatDateOnly(details.handover_date as string)}</Descriptions.Item>
                  <Descriptions.Item label="过渡期（天）">{details.transition_days ?? '-'}</Descriptions.Item>
                </Descriptions>
              </div>

              <div className={styles.textBlock ?? ''}>
                <div className={styles.sectionTitle ?? ''}>四维度能力检查</div>
                {(['business', 'tech', 'data', 'ops'] as const).map((dimKey) => {
                  const checked = (details.checked_dimensions as Record<string, string[]> | undefined)?.[dimKey] ?? [];
                  return (
                    <div key={dimKey} style={{ marginBottom: 12 }}>
                      <Text strong style={{ marginRight: 8 }}>{DIMENSION_LABEL[dimKey]}：</Text>
                      {checked.length > 0 ? (
                        <Checkbox.Group value={checked} disabled options={[] as never}>
                          {checked.map((item) => <Checkbox key={item} value={item}>{item}</Checkbox>)}
                        </Checkbox.Group>
                      ) : (
                        <Text type="secondary">未勾选</Text>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className={styles.textBlock ?? ''}>
                <div className={styles.sectionTitle ?? ''}>资产清单</div>
                {Array.isArray(details.asset_list) && details.asset_list.length > 0 ? (
                  <Space wrap>
                    {(details.asset_list as string[]).map((a) => <Tag key={a}>{a}</Tag>)}
                  </Space>
                ) : (
                  <Text type="secondary">暂无</Text>
                )}
              </div>

              <div className={styles.textBlock ?? ''}>
                <div className={styles.sectionTitle ?? ''}>签字状态</div>
                <Space size="middle">
                  {(['transfer', 'assignee', 'supervisor'] as const).map((key) => {
                    const labelMap = { transfer: '移交方', assignee: '承接方', supervisor: '监督方' };
                    const signed = !!(details.signatures as Record<string, boolean> | undefined)?.[key];
                    return (
                      <Tag key={key} color={signed ? 'success' : 'default'}>
                        {labelMap[key]}：{signed ? '已签字' : '未签字'}
                      </Tag>
                    );
                  })}
                </Space>
              </div>
            </>
          )}

          {/* 非移交事件：键值对详情 */}
          {!isHandover && (
            <div className={styles.textBlock ?? ''}>
              <div className={styles.sectionTitle ?? ''}>事件详情</div>
              {kvPairs.length > 0 ? (
                <Descriptions column={1} size="small" bordered>
                  {kvPairs.map(([k, v]) => (
                    <Descriptions.Item key={k} label={k}>
                      {typeof v === 'string' ? v : (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v))}
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              ) : (
                <Text type="secondary">暂无附加详情</Text>
              )}
            </div>
          )}
        </div>
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
          <Tooltip title={event?.number + ' ' + (event?.title ?? '')}>
            <Title level={4} className={styles.title ?? ''}>
              {event?.number} {event?.title ?? ''}
            </Title>
          </Tooltip>
          <Tag color={typeColor}>{typeLabel}</Tag>
        </Space>
        <Space>
          {canOperate ? (
            <>
              <Tooltip title="编辑">
                <Button icon={<EditOutlined />} onClick={() => setEditVisible(true)} />
              </Tooltip>
              <Tooltip title="删除">
                <Button danger icon={<DeleteOutlined />} onClick={handleDelete} />
              </Tooltip>
            </>
          ) : (
            <Tooltip title="只读权限，无法编辑或删除">
              <Button danger icon={<DeleteOutlined />} disabled />
            </Tooltip>
          )}
        </Space>
      </div>

      <Card>
        <Tabs items={tabItems} />
      </Card>

      {/* 新建/编辑事件（共用组件 EventModal） */}
      <EventModal
        project={project ?? ({} as Project)}
        open={editVisible}
        editingEvent={event}
        existingEvents={allEvents}
        onClose={() => setEditVisible(false)}
        onSaved={() => void fetchEvent()}
      />
    </div>
    </Spin>
  );
}
