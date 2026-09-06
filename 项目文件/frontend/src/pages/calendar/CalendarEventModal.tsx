import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Switch, message } from 'antd';
import { DeleteOutlined, EnvironmentOutlined } from '@ant-design/icons';
import type { CalendarEvent, EventRepeat } from '../../types/calendar';
import type { Visibility } from '../../utils/visibility';
import VisibilitySetting from '@/components/VisibilitySetting/VisibilitySetting';
import { createCalendarEvent, updateCalendarEvent } from '../../api/calendar';

const { Option } = Select;

const REPEAT_OPTIONS: { label: string; value: EventRepeat }[] = [
  { label: '不重复', value: 'none' },
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
  { label: '每年', value: 'yearly' },
];

const PRESET_COLORS = ['var(--color-info)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-error)', 'var(--color-purple)', 'var(--color-cyan)', 'var(--color-magenta)', 'var(--color-orange-bright)'];

const REMINDER_OPTIONS = [5, 10, 15, 30, 60];

interface CalendarEventModalProps {
  open: boolean;
  /** 非空表示编辑模式；null 表示新建 */
  editingEvent?: CalendarEvent | null;
  /** 新建模式下的默认开始时间（本地时间字符串，形如 "YYYY-MM-DDTHH:mm"） */
  defaultStart?: string;
  /** 新建模式下的默认结束时间（本地时间字符串，形如 "YYYY-MM-DDTHH:mm"） */
  defaultEnd?: string;
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
 */
export default function CalendarEventModal({
  open,
  editingEvent = null,
  defaultStart,
  defaultEnd,
  onClose,
  onSaved,
  onDelete,
}: CalendarEventModalProps) {
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [formAllDay, setFormAllDay] = useState(false);
  const [formLocation, setFormLocation] = useState('');
  const [formColor, setFormColor] = useState(PRESET_COLORS[0]);
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
      setFormStartTime(editingEvent.start_time ? editingEvent.start_time.slice(0, 16) : '');
      setFormEndTime(editingEvent.end_time ? editingEvent.end_time.slice(0, 16) : '');
      setFormAllDay(editingEvent.all_day);
      setFormLocation(editingEvent.location || '');
      setFormColor(editingEvent.color || PRESET_COLORS[0]);
      setFormRepeat(editingEvent.repeat || 'none');
      setFormReminderEnabled(editingEvent.reminder_enabled || false);
      setFormReminderMinutes(editingEvent.reminder_minutes || 15);
      setVisibility((editingEvent.visibility as Visibility) || 'private');
      setRestrictedUsers(editingEvent.restricted_users || []);
    } else {
      setFormTitle('');
      setFormDescription('');
      setFormStartTime(defaultStart ?? '');
      setFormEndTime(defaultEnd ?? '');
      setFormAllDay(false);
      setFormLocation('');
      setFormColor(PRESET_COLORS[0]);
      setFormRepeat('none');
      setFormReminderEnabled(false);
      setFormReminderMinutes(15);
      setVisibility('private');
      setRestrictedUsers([]);
    }
  }, [open, editingEvent, defaultStart, defaultEnd]);

  const handleSubmit = async () => {
    if (!formTitle.trim()) { message.warning('请输入事件标题'); return; }
    if (!formStartTime) { message.warning('请选择开始时间'); return; }
    setSaving(true);
    try {
      const payload = {
        title: formTitle,
        description: formDescription || undefined,
        start_time: new Date(formStartTime).toISOString(),
        end_time: formEndTime ? new Date(formEndTime).toISOString() : undefined,
        all_day: formAllDay,
        location: formLocation || undefined,
        color: formColor,
        repeat: formRepeat,
        reminder_enabled: formReminderEnabled,
        reminder_minutes: formReminderMinutes,
        visibility,
        ...(visibility === 'restricted' && restrictedUsers.length > 0 ? { restricted_users: restrictedUsers } : {}),
      };
      if (editingEvent) {
        const res = await updateCalendarEvent(editingEvent.id, payload);
        if (res.code === 0) { message.success('事件已更新'); onClose(); onSaved(); }
      } else {
        const res = await createCalendarEvent(payload);
        if (res.code === 0) { message.success('事件已创建'); onClose(); onSaved(); }
      }
    } catch { message.error('操作失败'); }
    finally { setSaving(false); }
  };

  return (
    <Modal
      title={editingEvent ? '编辑事件' : '新建事件'}
      open={open}
      onOk={() => void handleSubmit()}
      onCancel={onClose}
      okButtonProps={{ loading: saving }}
      confirmLoading={saving}
      okText="保存"
      cancelText="取消"
      destroyOnClose
      width={560}
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Form layout="vertical">
        <Form.Item label="事件标题" required>
          <Input placeholder="请输入事件标题" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
        </Form.Item>
        <Form.Item label="事件描述">
          <Input.TextArea placeholder="请输入事件描述（可选）" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} />
        </Form.Item>
        <Space style={{ width: '100%' }}>
          <Form.Item label="开始时间">
            <Input type="datetime-local" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} style={{ width: 200 }} />
          </Form.Item>
          <span style={{ marginTop: 'var(--spacing-xl)' }}>至</span>
          <Form.Item label="结束时间">
            <Input type="datetime-local" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} style={{ width: 200 }} />
          </Form.Item>
        </Space>
        <Space style={{ width: '100%' }}>
          <Form.Item label="全天事件">
            <Switch checked={formAllDay} onChange={setFormAllDay} checkedChildren="全天" unCheckedChildren="非全天" />
          </Form.Item>
          <Form.Item label="地点">
            <Input placeholder="请输入地点（可选）" prefix={<EnvironmentOutlined />} value={formLocation} onChange={(e) => setFormLocation(e.target.value)} style={{ width: 220 }} />
          </Form.Item>
        </Space>
        <Form.Item label="颜色">
          <Space align="center">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFormColor(c)}
                style={{
                  width: 24, height: 24, borderRadius: '50%', border: formColor === c ? '2px solid var(--ink)' : '2px solid transparent',
                  backgroundColor: c, cursor: 'pointer', padding: 0,
                }}
              />
            ))}
          </Space>
        </Form.Item>
        <Form.Item label="重复">
          <Select value={formRepeat} onChange={(v) => setFormRepeat(v as EventRepeat)} style={{ width: 160 }}>
            {REPEAT_OPTIONS.map((o) => <Option key={o.value} value={o.value}>{o.label}</Option>)}
          </Select>
        </Form.Item>
        <Form.Item label="提醒">
          <Space>
            <Switch
              checked={formReminderEnabled}
              onChange={setFormReminderEnabled}
              checkedChildren="开启提醒"
              unCheckedChildren="关闭"
            />
            {formReminderEnabled && (
              <Space>
                <span>提前</span>
                <Select
                  value={formReminderMinutes}
                  onChange={setFormReminderMinutes}
                  style={{ width: 100 }}
                  suffixIcon={<span>分钟</span>}
                >
                  {REMINDER_OPTIONS.map((m) => <Option key={m} value={m}>{m}</Option>)}
                </Select>
              </Space>
            )}
          </Space>
        </Form.Item>
        <Form.Item label="可见性">
          <VisibilitySetting
            value={visibility}
            restrictedUsers={restrictedUsers}
            onChange={setVisibility}
            onRestrictedUsersChange={setRestrictedUsers}
            showRestrictedTags={false}
            label=""
          />
        </Form.Item>
        {editingEvent && (
          <Button danger onClick={() => { onClose(); onDelete?.(editingEvent); }} icon={<DeleteOutlined />}>
            删除此事件
          </Button>
        )}
      </Form>
    </Modal>
  );
}
