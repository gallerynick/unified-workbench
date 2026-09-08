import { useEffect, useState } from 'react';
import {
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Tooltip,
  message,
} from 'antd';
import { DeleteOutlined, EnvironmentOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import type { CalendarEvent, EventRepeat } from '../../types/calendar';
import type { Visibility } from '../../utils/visibility';
import VisibilitySetting from '@/components/VisibilitySetting/VisibilitySetting';
import { createCalendarEvent, updateCalendarEvent } from '../../api/calendar';
import { CALENDAR_COLORS, DEFAULT_COLOR, colorName } from './CalendarColors';
import styles from './CalendarEventModal.module.css';

const { Option } = Select;

const REPEAT_OPTIONS: { label: string; value: EventRepeat }[] = [
  { label: '不重复', value: 'none' },
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
  { label: '每年', value: 'yearly' },
];

const REMINDER_OPTIONS = [5, 10, 15, 30, 60];

/** 拼接 CSS Module 类名（styles 索引访问后类型为 string | undefined，需收敛为 string） */
const cx = (...parts: Array<string | undefined | false>) => parts.filter(Boolean).join(' ');

interface CalendarEventModalProps {
  open: boolean;
  /** 非空表示编辑模式；null 表示新建 */
  editingEvent?: CalendarEvent | null;
  /** 新建模式下的默认开始时间（本地时间字符串，形如 "YYYY-MM-DDTHH:mm"） */
  defaultStart?: string;
  /** 新建模式下的默认结束时间（本地时间字符串，形如 "YYYY-MM-DDTHH:mm"） */
  defaultEnd?: string;
  /** 新建模式下的默认颜色（默认 DEFAULT_COLOR；筛选条选中单一颜色时由页面传入） */
  defaultColor?: string;
  onClose: () => void;
  /** 保存成功回调（父组件刷新日历事件） */
  onSaved: () => void;
  /** 删除事件回调（仅编辑模式显示删除按钮） */
  onDelete?: (event: CalendarEvent) => void;
}

/**
 * 日程事件 新建/编辑 共用弹窗
 *
 * 供「日程日历」页（CalendarPage）复用，表单与提交逻辑内聚于此，
 * 页面只负责打开/关闭/刷新，一处修改、多处以一。
 *
 * 视觉依据：项目基定/UI设计规范.md
 *   容器：canvas 底 + rounded-sm + shadow-md + padding 24
 *   标题：heading-3；标签：caption-strong
 *   输入：高 36 / rounded-sm / border-primary；焦点 color-info 边框 + 光晕
 *   时间：antd DatePicker showTime（与站内其他模块统一）
 *   颜色：28px 圆点 + 选中双层环 + 色名 tooltip
 *   footer：保存 = button-primary 胶囊；取消 = 次级胶囊
 */
export default function CalendarEventModal({
  open,
  editingEvent = null,
  defaultStart,
  defaultEnd,
  defaultColor = DEFAULT_COLOR,
  onClose,
  onSaved,
  onDelete,
}: CalendarEventModalProps) {
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStartTime, setFormStartTime] = useState<Dayjs | null>(null);
  const [formEndTime, setFormEndTime] = useState<Dayjs | null>(null);
  const [formAllDay, setFormAllDay] = useState(false);
  const [formLocation, setFormLocation] = useState('');
  const [formColor, setFormColor] = useState<string>(DEFAULT_COLOR);
  const [formRepeat, setFormRepeat] = useState<EventRepeat>('none');
  const [formReminderEnabled, setFormReminderEnabled] = useState(false);
  const [formReminderMinutes, setFormReminderMinutes] = useState(15);
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [restrictedUsers, setRestrictedUsers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingEvent) {
      setFormTitle(editingEvent.title);
      setFormDescription(editingEvent.description || '');
      setFormStartTime(editingEvent.start_time ? dayjs(editingEvent.start_time) : null);
      setFormEndTime(editingEvent.end_time ? dayjs(editingEvent.end_time) : null);
      setFormAllDay(editingEvent.all_day);
      setFormLocation(editingEvent.location || '');
      setFormColor(editingEvent.color || DEFAULT_COLOR);
      setFormRepeat(editingEvent.repeat || 'none');
      setFormReminderEnabled(editingEvent.reminder_enabled || false);
      setFormReminderMinutes(editingEvent.reminder_minutes || 15);
      setVisibility((editingEvent.visibility as Visibility) || 'private');
      setRestrictedUsers(editingEvent.restricted_users || []);
    } else {
      setFormTitle('');
      setFormDescription('');
      setFormStartTime(defaultStart ? dayjs(defaultStart) : null);
      setFormEndTime(defaultEnd ? dayjs(defaultEnd) : null);
      setFormAllDay(false);
      setFormLocation('');
      setFormColor(defaultColor);
      setFormRepeat('none');
      setFormReminderEnabled(false);
      setFormReminderMinutes(15);
      setVisibility('private');
      setRestrictedUsers([]);
    }
  }, [open, editingEvent, defaultStart, defaultEnd, defaultColor]);

  const handleSubmit = async () => {
    if (!formTitle.trim()) {
      message.warning('请输入事件标题');
      return;
    }
    if (!formStartTime) {
      message.warning('请选择开始时间');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        start_time: formStartTime.toISOString(),
        end_time: formEndTime ? formEndTime.toISOString() : undefined,
        all_day: formAllDay,
        location: formLocation.trim() || undefined,
        color: formColor,
        repeat: formRepeat,
        reminder_enabled: formReminderEnabled,
        reminder_minutes: formReminderMinutes,
        visibility,
        ...(visibility === 'restricted' && restrictedUsers.length > 0
          ? { restricted_users: restrictedUsers }
          : {}),
      };
      if (editingEvent) {
        const res = await updateCalendarEvent(editingEvent.id, payload);
        if (res.code === 0) {
          message.success('事件已更新');
          onClose();
          onSaved();
        }
      } else {
        const res = await createCalendarEvent(payload);
        if (res.code === 0) {
          message.success('事件已创建');
          onClose();
          onSaved();
        }
      }
    } catch {
      message.error('操作失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      className={cx(styles.modal)}
      title={<span className={styles.modalTitle}>{editingEvent ? '编辑事件' : '新建事件'}</span>}
      open={open}
      onCancel={onClose}
      width={560}
      destroyOnClose
      styles={{ body: { padding: 24, maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' } }}
      footer={
        <div className={styles.footer}>
          {editingEvent && (
            <Button
              danger
              className={cx(styles.deleteBtn)}
              icon={<DeleteOutlined />}
              onClick={() => {
                onClose();
                onDelete?.(editingEvent);
              }}
            >
              删除此事件
            </Button>
          )}
          <span className={styles.footerSpacer} />
          <Button className={cx(styles.cancelBtn)} onClick={onClose}>
            取消
          </Button>
          <Button
            type="primary"
            className={cx(styles.submitBtn)}
            loading={saving}
            onClick={handleSubmit}
          >
            保存
          </Button>
        </div>
      }
    >
      <Form layout="vertical" className={cx(styles.form)} colon={false} requiredMark="optional">
        <Form.Item label="事件标题" required className={cx(styles.field)}>
          <Input
            placeholder="请输入事件标题"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            className={cx(styles.input)}
            autoFocus
          />
        </Form.Item>

        <Form.Item label="事件描述" className={cx(styles.field)}>
          <Input.TextArea
            placeholder="请输入事件描述（可选）"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            rows={2}
            className={cx(styles.input)}
          />
        </Form.Item>

        <div className={styles.row}>
          <Form.Item label="开始时间" required className={cx(styles.field)}>
            <DatePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              value={formStartTime}
              onChange={(v) => setFormStartTime(v)}
              className={cx(styles.picker)}
              placeholder="选择开始时间"
            />
          </Form.Item>
          <Form.Item label="结束时间" className={cx(styles.field)}>
            <DatePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              value={formEndTime}
              onChange={(v) => setFormEndTime(v)}
              className={cx(styles.picker)}
              placeholder="选择结束时间（可选）"
            />
          </Form.Item>
        </div>

        <div className={styles.row}>
          <Form.Item label="全天事件" className={cx(styles.field)}>
            <Switch checked={formAllDay} onChange={setFormAllDay} />
          </Form.Item>
          <Form.Item label="地点" className={cx(styles.field)}>
            <Input
              placeholder="请输入地点（可选）"
              prefix={<EnvironmentOutlined />}
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
              className={styles.inputWide}
            />
          </Form.Item>
        </div>

        <Form.Item label="颜色" className={cx(styles.field)}>
          <div className={styles.colorRow}>
            {CALENDAR_COLORS.map((c) => {
              const active = formColor === c.value;
              return (
                <Tooltip key={c.value} title={c.name} placement="top" mouseEnterDelay={0.2}>
                  <button
                    type="button"
                    className={active ? styles.colorDotActive : styles.colorDot}
                    onClick={() => setFormColor(c.value)}
                    aria-label={c.name}
                    aria-pressed={active}
                  >
                    <span className={styles.colorInner} style={{ backgroundColor: c.value }} />
                  </button>
                </Tooltip>
              );
            })}
            <span className={styles.colorName}>{colorName(formColor)}</span>
          </div>
        </Form.Item>

        <div className={styles.row}>
          <Form.Item label="重复" className={cx(styles.field)}>
            <Select
              value={formRepeat}
              onChange={(v) => setFormRepeat(v as EventRepeat)}
              className={cx(styles.select)}
            >
              {REPEAT_OPTIONS.map((o) => (
                <Option key={o.value} value={o.value}>
                  {o.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="提醒" className={cx(styles.field)}>
            <Space size={10} align="center">
              <Switch checked={formReminderEnabled} onChange={setFormReminderEnabled} />
              {formReminderEnabled && (
                <>
                  <span className={styles.reminderText}>提前</span>
                  <Select
                    value={formReminderMinutes}
                    onChange={setFormReminderMinutes}
                    className={cx(styles.selectSmall)}
                  >
                    {REMINDER_OPTIONS.map((m) => (
                      <Option key={m} value={m}>
                        {m} 分钟
                      </Option>
                    ))}
                  </Select>
                </>
              )}
            </Space>
          </Form.Item>
        </div>

        <Form.Item label="可见性" className={cx(styles.field)}>
          <VisibilitySetting
            value={visibility}
            restrictedUsers={restrictedUsers}
            onChange={setVisibility}
            onRestrictedUsersChange={setRestrictedUsers}
            showRestrictedTags={false}
            label=""
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
