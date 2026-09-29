import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  message,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import type { Project } from '../../../types/project';
import type {
  ProjectEvent,
  ProjectEventCreate,
  ProjectEventUpdate,
} from '../../../types/project-event';
import type { User } from '../../../types/user';
import { createProjectEvent, updateProjectEvent } from '../../../api/project-events';
import { listUsers } from '../../../api/users';
import { EVENT_TYPE_OPTIONS, PROJECT_NUMBER_PREFIX } from '../../../constants/project';
import styles from './EventModal.module.css';

// ─── 常量 ─────────────────────────────────────────────────────────

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

const eventTypeOptions: { value: string; label: string }[] = EVENT_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));
const handoverTypeOptions: { value: string; label: string }[] = HANDOVER_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

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

interface EventModalProps {
  project: Project;
  /** 控制弹窗显隐 */
  open: boolean;
  /** 非空表示编辑模式；null 表示新建 */
  editingEvent?: ProjectEvent | null;
  /** 项目现有事件（用于生成下一个编号） */
  existingEvents: ProjectEvent[];
  onClose: () => void;
  /** 保存成功回调（父组件刷新列表） */
  onSaved: () => void;
}

/**
 * 生成事件编号：EVT-{项目编号}-{项目内序号}
 * 序号 = 现有列表中该前缀下最大序号 + 1
 */
function buildEventNumber(project: Project, existing: ProjectEvent[]): string {
  const projTag = project.number ?? project.id.slice(0, 8).toUpperCase();
  const prefix = `${PROJECT_NUMBER_PREFIX.event}${projTag}-`;
  let maxSeq = 0;
  for (const ev of existing) {
    if (ev.number?.startsWith(prefix)) {
      const seq = parseInt(ev.number.slice(prefix.length), 10);
      if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

/**
 * 项目事件 新建/编辑 共用弹窗
 *
 * 供「事件 Tab」（ProjectEventTab）使用；事件类型为 handover 时动态渲染移交表单
 * （移交方/承接方/监督方/交接类型/日期/过渡期/四维度检查/资产清单/签字状态），
 * 抽取后保证事件表单与移交动态逻辑全局一致。
 */
export default function EventModal({
  project,
  open,
  editingEvent = null,
  existingEvents,
  onClose,
  onSaved,
}: EventModalProps) {
  const [form] = Form.useForm<EventFormValues>();
  const [users, setUsers] = useState<User[]>([]);

  // 当前选中类型（用于动态渲染移交表单）
  const selectedType = Form.useWatch('event_type', form);
  const isHandover = selectedType === 'handover';

  // 打开弹窗时：重置表单、回填编辑值、加载用户选项
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editingEvent) {
      const pairs: DetailsPair[] = [];
      for (const [k, v] of Object.entries(editingEvent.details ?? {})) {
        if (!HANDOVER_DETAIL_KEYS.has(k)) pairs.push({ key: k, value: String(v ?? '') });
      }
      const initValues: EventFormValues = {
        title: editingEvent.title,
        event_type: editingEvent.event_type,
        details: pairs,
      };
      if (editingEvent.event_type === 'handover') {
        const d = editingEvent.details ?? {};
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
    } else {
      form.setFieldsValue({ event_type: 'other', details: [] });
    }

    listUsers({ page_size: 100 }).then((res) => {
      if (res.code === 0) setUsers(res.data.items);
    }).catch(() => {});
  }, [open, editingEvent, form]);

  const userOptions = useMemo(() => users.map((u) => ({
    value: u.id,
    label: u.username ? `${u.nickname} (${u.username})` : u.nickname,
  })), [users]);

  const handleSubmit = async () => {
    let values: EventFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验未通过，Modal 会显示错误
    }
    try {
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

      if (editingEvent) {
        const payload: ProjectEventUpdate = { ...base };
        const res = await updateProjectEvent(editingEvent.id, payload);
        if (res.code === 0) {
          message.success('事件已更新');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '更新事件失败');
        }
      } else {
        const payload: ProjectEventCreate = {
          project_id: project.id,
          number: buildEventNumber(project, existingEvents),
          ...base,
        };
        const res = await createProjectEvent(payload);
        if (res.code === 0) {
          message.success('事件已创建');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '创建事件失败');
        }
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '保存事件失败');
    }
  };

  return (
    <Modal
      title={editingEvent ? '编辑事件' : '新增事件'}
      open={open}
      onOk={() => void handleSubmit()}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      destroyOnClose
      width={isHandover ? 720 : 560}
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 } }}
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
              <Input
                value={project.owner_id ? (users.find((u) => u.id === project.owner_id)?.nickname || project.owner_id) : '-'}
                disabled
              />
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
  );
}
