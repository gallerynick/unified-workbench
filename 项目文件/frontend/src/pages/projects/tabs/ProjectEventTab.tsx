import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  DatePicker,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import {
  createProjectEvent,
  deleteProjectEvent,
  listProjectEvents,
  updateProjectEvent,
} from '../../../api/project-events';
import { listUsers } from '../../../api/users';
import { EVENT_TYPE_OPTIONS, PROJECT_NUMBER_PREFIX } from '../../../constants/project';
import { useUser } from '../../../contexts/UserContext';
import type { Project } from '../../../types/project';
import type { ProjectEvent } from '../../../types/project-event';
import type { User } from '../../../types/user';
import styles from './ProjectEventTab.module.css';

const { Text } = Typography;

// ─── 常量 ─────────────────────────────────────────────────────────

/** 事件类型标签颜色（由 antd Tag 语义色自适应深浅色模式） */
const EVENT_TYPE_COLOR: Record<string, string> = {
  handover: 'blue',
  archive: 'orange',
  close: 'red',
  reopen: 'green',
  owner_change: 'purple',
  other: 'default',
};

/** 交接类型选项 */
const HANDOVER_TYPE_OPTIONS = [
  { value: 'overall', label: '整体交接' },
  { value: 'module', label: '模块交接' },
  { value: 'temporary', label: '临时接管' },
  { value: 'other', label: '其他' },
] as const;

/** 四维度能力检查项 */
const DIMENSION_OPTIONS: { key: 'business' | 'tech' | 'data' | 'ops'; label: string; items: string[] }[] = [
  {
    key: 'business',
    label: '业务功能',
    items: ['需求理解', '功能迭代', '疑问解答', '产品对接', '故障处理', '体验优化'],
  },
  {
    key: 'tech',
    label: '技术架构',
    items: ['数据库', '缓存', '搜索', '对象存储', '配置中心', '负载均衡'],
  },
  {
    key: 'data',
    label: '数据规范',
    items: ['库结构维护', 'API规范', '数据迁移', '三方集成', '数据一致性', '消息协议'],
  },
  {
    key: 'ops',
    label: '运维支撑',
    items: ['监控', '告警', '部署回滚', '备份恢复', '网络安全', '资源成本'],
  },
];

/** 资产清单选项 */
const ASSET_OPTIONS = ['代码仓库', '文档', '服务器权限', '数据库权限', '第三方账号'];

/** 签字方选项 */
const SIGN_OPTIONS = [
  { key: 'transfer', label: '移交方' },
  { key: 'assignee', label: '承接方' },
  { key: 'supervisor', label: '监督方' },
] as const;

/** details 中预留的移交表单键，不进入键值对列表 */
const HANDOVER_DETAIL_KEYS = new Set([
  'handover_transfer',
  'assignee',
  'supervisor',
  'handover_type',
  'handover_date',
  'transition_days',
  'checked_dimensions',
  'asset_list',
  'signatures',
]);

/** 事件类型选项转可变数组（as const 只读数组无法直接赋给 Select options） */
const eventTypeOptions: { value: string; label: string }[] = EVENT_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));
const handoverTypeOptions: { value: string; label: string }[] = HANDOVER_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

// ─── 工具函数 ─────────────────────────────────────────────────────

/**
 * 生成事件编号：EVT-{项目编号}-{项目内序号}
 * 序号 = 当前列表中该前缀下最大序号 + 1
 */
function buildEventNumber(project: Project, events: ProjectEvent[]): string {
  const projTag = project.number ?? project.id.slice(0, 8).toUpperCase();
  const prefix = `${PROJECT_NUMBER_PREFIX.event}${projTag}-`;
  let maxSeq = 0;
  for (const ev of events) {
    if (ev.number?.startsWith(prefix)) {
      const seq = parseInt(ev.number.slice(prefix.length), 10);
      if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

/** 根据选项数组反查中文标签，查不到则原样返回 */
function getLabel(
  options: { value: string; label: string }[],
  value: string | null | undefined,
): string {
  if (!value) return '-';
  return options.find((o) => o.value === value)?.label ?? value;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface DetailsPair {
  key?: string;
  value?: string;
}

interface EventFormValues {
  event_type: string;
  title: string;
  details?: DetailsPair[];
  assignee?: string;
  supervisor?: string;
  handover_type?: string;
  handover_date?: Dayjs;
  transition_days?: number;
  checked_dimensions?: Record<string, string[]>;
  asset_list?: string[];
  signatures?: Record<string, boolean>;
}

export default function ProjectEventTab({ project }: { project: Project }) {
  const { user } = useUser();
  const [form] = Form.useForm<EventFormValues>();

  // ── 数据状态 ──
  const [events, setEvents] = useState<ProjectEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  // ── Modal 状态 ──
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<ProjectEvent | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 权限：负责人 + 管理员全权限；普通成员按 member_permissions.events 分区，readonly 时只读
  const isOwner = !!user && user.id === project.owner_id;
  const isAdmin = user?.role === 'admin';
  const eventsPerm = project.member_permissions?.[user?.id ?? '']?.events;
  const canOperate = isOwner || isAdmin || eventsPerm !== 'readonly';

  // 当前选中类型（用于动态渲染移交表单）
  const selectedType = Form.useWatch('event_type', form);
  const isHandover = selectedType === 'handover';

  // ── 数据加载 ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [eventRes, userRes] = await Promise.all([
        listProjectEvents({ project_id: project.id, page_size: 100 }),
        listUsers({ page_size: 100 }),
      ]);
      if (eventRes.code === 0) {
        setEvents(eventRes.data.items);
      } else {
        message.error(eventRes.msg || '获取项目事件失败');
      }
      if (userRes.code === 0) {
        setUsers(userRes.data.items);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取项目事件失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ── 派生数据 ──
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

  /** 用户下拉选项 */
  const userOptions = useMemo(
    () =>
      users.map((u) => ({
        value: u.id,
        label: u.nickname || u.username,
      })),
    [users],
  );

  const filteredEvents = useMemo(() => {
    const kw = searchText.trim().toLowerCase();
    if (!kw) return events;
    return events.filter((ev) => {
      const detailsText = Object.values(ev.details ?? {})
        .map((v) => (typeof v === 'string' ? v : JSON.stringify(v ?? '')))
        .join(' ');
      return (
        ev.title.toLowerCase().includes(kw) ||
        (ev.number ?? '').toLowerCase().includes(kw) ||
        detailsText.toLowerCase().includes(kw)
      );
    });
  }, [events, searchText]);

  // ── 打开新建 ──
  const handleCreate = useCallback(() => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ event_type: 'other', details: [] });
    setModalVisible(true);
  }, [form]);

  // ── 打开编辑（回填 title/event_type/details，移交事件回填移交字段） ──
  const handleEdit = useCallback(
    (record: ProjectEvent) => {
      setEditing(record);
      form.resetFields();
      const pairs: DetailsPair[] = [];
      for (const [k, v] of Object.entries(record.details ?? {})) {
        if (!HANDOVER_DETAIL_KEYS.has(k)) pairs.push({ key: k, value: String(v ?? '') });
      }
      const initValues: EventFormValues = {
        title: record.title,
        event_type: record.event_type,
        details: pairs,
      };
      if (record.event_type === 'handover') {
        const d = record.details ?? {};
        if (typeof d.assignee === 'string') initValues.assignee = d.assignee;
        if (typeof d.supervisor === 'string') initValues.supervisor = d.supervisor;
        if (typeof d.handover_type === 'string') initValues.handover_type = d.handover_type;
        if (typeof d.handover_date === 'string' && d.handover_date) {
          initValues.handover_date = dayjs(d.handover_date);
        }
        if (typeof d.transition_days === 'number') initValues.transition_days = d.transition_days;
        const dims = (d.checked_dimensions ?? {}) as Record<string, unknown>;
        initValues.checked_dimensions = {
          business: Array.isArray(dims.business) ? (dims.business as string[]) : [],
          tech: Array.isArray(dims.tech) ? (dims.tech as string[]) : [],
          data: Array.isArray(dims.data) ? (dims.data as string[]) : [],
          ops: Array.isArray(dims.ops) ? (dims.ops as string[]) : [],
        };
        if (Array.isArray(d.asset_list)) initValues.asset_list = d.asset_list as string[];
        const sigs = (d.signatures ?? {}) as Record<string, unknown>;
        initValues.signatures = {
          transfer: !!sigs.transfer,
          assignee: !!sigs.assignee,
          supervisor: !!sigs.supervisor,
        };
      }
      form.setFieldsValue(initValues);
      setModalVisible(true);
    },
    [form],
  );

  // ── 提交 ──
  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      // details 基础：键值对列表 → 对象
      const details: Record<string, unknown> = {};
      for (const pair of values.details ?? []) {
        const k = pair?.key?.trim();
        if (k) details[k] = pair.value ?? '';
      }

      // handover：合并移交表单字段（details 结构键用英文）
      if (values.event_type === 'handover') {
        details.handover_transfer = project.owner_id;
        details.assignee = values.assignee;
        details.supervisor = values.supervisor ?? null;
        details.handover_type = values.handover_type;
        details.handover_date = values.handover_date
          ? values.handover_date.format('YYYY-MM-DD')
          : null;
        details.transition_days = values.transition_days ?? null;
        details.checked_dimensions = {
          business: values.checked_dimensions?.business ?? [],
          tech: values.checked_dimensions?.tech ?? [],
          data: values.checked_dimensions?.data ?? [],
          ops: values.checked_dimensions?.ops ?? [],
        };
        details.asset_list = values.asset_list ?? [];
        details.signatures = {
          transfer: !!values.signatures?.transfer,
          assignee: !!values.signatures?.assignee,
          supervisor: !!values.signatures?.supervisor,
        };
      }

      const base = {
        event_type: values.event_type,
        title: values.title.trim(),
        details,
      };

      if (editing) {
        const res = await updateProjectEvent(editing.id, base);
        if (res.code === 0) {
          message.success('事件已更新');
          setModalVisible(false);
          void fetchData();
        } else {
          message.error(res.msg || '更新失败');
        }
      } else {
        const res = await createProjectEvent({
          project_id: project.id,
          number: buildEventNumber(project, events),
          ...base,
        });
        if (res.code === 0) {
          message.success('事件已创建');
          setModalVisible(false);
          void fetchData();
        } else {
          message.error(res.msg || '创建失败');
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }, [form, editing, project, events, fetchData]);

  // ── 删除 ──
  const handleDelete = useCallback(
    (record: ProjectEvent) => {
      Modal.confirm({
        title: '确认删除事件',
        icon: <ExclamationCircleOutlined />,
        content: `确定要删除事件「${record.number} ${record.title}」吗？此操作不可恢复。`,
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          try {
            const res = await deleteProjectEvent(record.id);
            if (res.code === 0) {
              message.success('事件已删除');
              void fetchData();
            } else {
              message.error(res.msg || '删除失败');
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '删除失败';
            message.error(msg);
          }
        },
      });
    },
    [fetchData],
  );

  // ── 列定义 ──
  const columns = useMemo<ColumnsType<ProjectEvent>>(
    () => [
      {
        title: '编号',
        dataIndex: 'number',
        key: 'number',
        width: 200,
        render: (number: string) => <Text strong>{number}</Text>,
      },
      {
        title: '标题',
        dataIndex: 'title',
        key: 'title',
        ellipsis: true,
        render: (title: string) => <span className={styles.titleCell ?? ''}>{title}</span>,
      },
      {
        title: '事件类型',
        dataIndex: 'event_type',
        key: 'event_type',
        width: 120,
        render: (eventType: string) => (
          <Tag color={EVENT_TYPE_COLOR[eventType] ?? 'default'}>
            {getLabel(eventTypeOptions, eventType)}
          </Tag>
        ),
      },
      {
        title: '操作人',
        dataIndex: 'operator_id',
        key: 'operator_id',
        width: 140,
        render: (id: string) => displayName(id),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 170,
        render: (time: string) => formatDate(time),
      },
      {
        title: '操作',
        key: 'actions',
        width: 100,
        align: 'right',
        render: (_, record) => {
          if (!canOperate) return null;
          return (
            <Space size={4} wrap>
              <Tooltip title="编辑">
                <Button
                  size="small"
                  type="text"
                  icon={<EditOutlined />}
                  aria-label="编辑"
                  onClick={() => handleEdit(record)}
                />
              </Tooltip>
              <Tooltip title="删除">
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label="删除"
                  onClick={() => handleDelete(record)}
                />
              </Tooltip>
            </Space>
          );
        },
      },
    ],
    [canOperate, displayName, handleEdit, handleDelete],
  );

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.toolbar ?? ''}>
        <Space>
          <span className={styles.toolbarLeft ?? ''}>
            <SwapOutlined style={{ color: 'var(--text-secondary)' }} />
            <Text type="secondary">共 {events.length} 条事件记录</Text>
          </span>
          <Input
            className={styles.searchInput ?? ''}
            variant="filled"
            placeholder="搜索事件..."
            prefix={<SearchOutlined style={{ color: 'var(--text-secondary)' }} />}
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
            }}
            allowClear
          />
        </Space>
        <Space>
          {canOperate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新增事件
            </Button>
          )}
        </Space>
      </div>

      <Table<ProjectEvent>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={filteredEvents}
        pagination={{
          pageSize: 8,
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 条`,
        }}
        scroll={{ x: 880 }}
        locale={{ emptyText: <Empty description="暂无项目事件" /> }}
      />

      {/* 新建 / 编辑事件 Modal */}
      <Modal
        title={editing ? '编辑事件' : '新增事件'}
        open={modalVisible}
        onOk={() => void handleSubmit()}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        destroyOnClose
        width={isHandover ? 720 : 560}
        styles={{
          body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' },
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="event_type"
            label="事件类型"
            rules={[{ required: true, message: '请选择事件类型' }]}
          >
            <Select options={eventTypeOptions} placeholder="请选择事件类型" />
          </Form.Item>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, whitespace: true, message: '请输入事件标题' }]}
          >
            <Input placeholder="请输入事件标题" maxLength={200} showCount />
          </Form.Item>

          {/* 项目移交表单（event_type = handover 时展示） */}
          {isHandover && (
            <div className={styles.handoverPanel ?? ''}>
              <h4 className={styles.sectionTitle ?? ''}>项目移交信息</h4>

              <Form.Item label="移交方" tooltip="默认当前项目负责人">
                <Input value={displayName(project.owner_id)} disabled />
              </Form.Item>
              <Form.Item
                name="assignee"
                label="承接方"
                rules={[{ required: true, message: '请选择承接方' }]}
              >
                <Select
                  showSearch
                  placeholder="选择承接方"
                  optionFilterProp="label"
                  options={userOptions}
                />
              </Form.Item>
              <Form.Item name="supervisor" label="监督方">
                <Select
                  allowClear
                  showSearch
                  placeholder="选择监督方（可选）"
                  optionFilterProp="label"
                  options={userOptions}
                />
              </Form.Item>
              <Form.Item
                name="handover_type"
                label="交接类型"
                rules={[{ required: true, message: '请选择交接类型' }]}
              >
                <Radio.Group options={handoverTypeOptions} />
              </Form.Item>
              <Space size="large" wrap>
                <Form.Item name="handover_date" label="交接日期">
                  <DatePicker format="YYYY-MM-DD" placeholder="选择日期" style={{ width: 170 }} />
                </Form.Item>
                <Form.Item name="transition_days" label="过渡期（天）">
                  <InputNumber min={0} max={365} placeholder="天数" style={{ width: 170 }} />
                </Form.Item>
              </Space>

              <Divider style={{ margin: 0 }} />

              {/* 四维度能力检查 */}
              <div className={styles.sectionBlock ?? ''}>
                <h4 className={styles.sectionTitle ?? ''}>四维度能力检查</h4>
                {DIMENSION_OPTIONS.map((dim) => (
                  <Form.Item
                    key={dim.key}
                    name={['checked_dimensions', dim.key]}
                    label={dim.label}
                  >
                    <Checkbox.Group options={dim.items} />
                  </Form.Item>
                ))}
              </div>

              <Divider style={{ margin: 0 }} />

              {/* 资产清单 */}
              <div className={styles.sectionBlock ?? ''}>
                <h4 className={styles.sectionTitle ?? ''}>资产清单</h4>
                <Form.Item name="asset_list">
                  <Checkbox.Group options={ASSET_OPTIONS} />
                </Form.Item>
              </div>

              <Divider style={{ margin: 0 }} />

              {/* 签字状态 */}
              <div className={styles.sectionBlock ?? ''}>
                <h4 className={styles.sectionTitle ?? ''}>签字状态</h4>
                <div className={styles.signRow ?? ''}>
                  {SIGN_OPTIONS.map((s) => (
                    <Form.Item
                      key={s.key}
                      name={['signatures', s.key]}
                      valuePropName="checked"
                      noStyle
                    >
                      <Checkbox>{s.label}（已签字）</Checkbox>
                    </Form.Item>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* details 附加字段（键值对） */}
          <Form.List name="details">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <div key={field.key} className={styles.kvRow ?? ''}>
                    <Form.Item
                      name={[field.name, 'key']}
                      rules={[{ required: true, whitespace: true, message: '请输入键' }]}
                      style={{ flex: 1 }}
                    >
                      <Input placeholder="键（如 remark）" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'value']} style={{ flex: 2 }}>
                      <Input placeholder="值" />
                    </Form.Item>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label="删除键值"
                      onClick={() => remove(field.name)}
                    />
                  </div>
                ))}
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => add({ key: '', value: '' })}
                  block
                >
                  添加附加字段
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
