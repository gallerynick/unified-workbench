import { useState, useRef, useCallback } from 'react';
import { Button, Typography, Modal, message, Space, Input, Switch, Select, Form } from 'antd';
import { PlusOutlined, DeleteOutlined, EnvironmentOutlined } from '@ant-design/icons';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import zhLocale from '@fullcalendar/core/locales/zh-cn';
import type { DateSelectArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core';
import { listCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../../api/calendar';
import type { CalendarEvent, EventRepeat } from '../../types/calendar';
import styles from './CalendarPage.module.css';
import './CalendarPage.global.css';

const { Title } = Typography;
const { Option } = Select;

const REPEAT_OPTIONS: { label: string; value: EventRepeat }[] = [
  { label: '不重复', value: 'none' },
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
  { label: '每年', value: 'yearly' },
];

const PRESET_COLORS = ['#1677ff', '#52c41a', '#fa8c16', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa541c'];

function formatDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [form] = Form.useForm();
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [formAllDay, setFormAllDay] = useState(false);
  const [formLocation, setFormLocation] = useState('');
  const [formColor, setFormColor] = useState(PRESET_COLORS[0]);
  const [formRepeat, setFormRepeat] = useState<EventRepeat>('none');
  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(() => {
    setFormTitle('');
    setFormDescription('');
    setFormStartTime('');
    setFormEndTime('');
    setFormAllDay(false);
    setFormLocation('');
    setFormColor(PRESET_COLORS[0]);
    setFormRepeat('none');
    setEditingEvent(null);
  }, []);

  const openCreateModal = useCallback((startStr?: string) => {
    resetForm();
    const start = startStr ? new Date(startStr) : new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setFormStartTime(formatDateTimeLocal(start));
    setFormEndTime(formatDateTimeLocal(end));
    setModalVisible(true);
  }, [resetForm]);

  const openEditModal = useCallback((event: CalendarEvent) => {
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormDescription(event.description || '');
    setFormStartTime(event.start_time ? event.start_time.slice(0, 16) : '');
    setFormEndTime(event.end_time ? event.end_time.slice(0, 16) : '');
    setFormAllDay(event.all_day);
    setFormLocation(event.location || '');
    setFormColor(event.color || PRESET_COLORS[0]);
    setFormRepeat(event.repeat || 'none');
    setModalVisible(true);
  }, []);

  const handleSave = async () => {
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
      };
      if (editingEvent) {
        const res = await updateCalendarEvent(editingEvent.id, payload);
        if (res.code === 0) { message.success('事件已更新'); setModalVisible(false); resetForm(); }
      } else {
        const res = await createCalendarEvent(payload);
        if (res.code === 0) { message.success('事件已创建'); setModalVisible(false); resetForm(); }
      }
      // Refresh calendar events
      const api = calendarRef.current?.getApi();
      if (api) api.refetchEvents();
    } catch { message.error('操作失败'); }
    finally { setSaving(false); }
  };

  const handleDelete = (event: CalendarEvent) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除事件「${event.title}」吗？`,
      okText: '删除', okType: 'danger', cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteCalendarEvent(event.id);
          if (res.code === 0) { message.success('事件已删除');
            const api = calendarRef.current?.getApi();
            if (api) api.refetchEvents();
          }
        } catch { message.error('删除失败'); }
      },
    });
  };

  const fetchEvents = useCallback(async (fetchInfo: { startStr: string; endStr: string }, successCallback: (events: EventInput[]) => void) => {
    try {
      const res = await listCalendarEvents({ start_date: fetchInfo.startStr, end_date: fetchInfo.endStr, page_size: 100 });
      if (res.code === 0) {
        const mapped: EventInput[] = res.data.items.map((e: CalendarEvent) => {
          const event: EventInput = {
            id: e.id,
            title: e.title,
            start: e.start_time,
            allDay: e.all_day,
            backgroundColor: e.color || '#1677ff',
            borderColor: e.color || '#1677ff',
            extendedProps: {
              description: e.description,
              location: e.location,
              repeat: e.repeat,
            },
          };
          if (e.end_time) event.end = e.end_time;
          return event;
        });
        successCallback(mapped);
      } else {
        successCallback([]);
      }
    } catch {
      message.error('加载日历事件失败');
      successCallback([]);
    }
  }, []);

  const handleEventDrop = useCallback(async (dropInfo: EventDropArg) => {
    const event = dropInfo.event;
    try {
      const res = await updateCalendarEvent(event.id, {
        start_time: event.start ? event.start.toISOString() : undefined,
        end_time: event.end ? event.end.toISOString() : undefined,
      });
      if (res.code !== 0) {
        dropInfo.revert();
        message.error('移动失败');
      }
    } catch {
      dropInfo.revert();
      message.error('移动失败');
    }
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title level={4} className={styles.title ?? ''}>日程日历</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateModal()}>新建事件</Button>
      </div>

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale={zhLocale}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        height="auto"
        selectable
        selectMirror
        editable
        dayMaxEvents
        events={fetchEvents}
        select={(selectInfo: DateSelectArg) => {
          openCreateModal(selectInfo.startStr);
        }}
        eventClick={(clickInfo: EventClickArg) => {
          const ev = clickInfo.event;
          const calEvent: CalendarEvent = {
            id: ev.id,
            title: ev.title,
            description: ev.extendedProps?.description || null,
            start_time: ev.start ? ev.start.toISOString() : '',
            end_time: ev.end ? ev.end.toISOString() : null,
            all_day: ev.allDay,
            location: ev.extendedProps?.location || null,
            repeat: ev.extendedProps?.repeat || 'none',
            color: ev.backgroundColor || null,
            owner_id: '',
            created_at: '',
            updated_at: '',
          };
          openEditModal(calEvent);
        }}
        eventDrop={handleEventDrop}
      />

      <Modal title={editingEvent ? '编辑事件' : '新建事件'} open={modalVisible} onOk={handleSave}
        onCancel={() => { setModalVisible(false); resetForm(); }} okText="保存" cancelText="取消"
        okButtonProps={{ loading: saving }} confirmLoading={saving} width={560} styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}>
        <Form form={form} layout="vertical">
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
            <span style={{ marginTop: 30 }}>至</span>
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
                    width: 24, height: 24, borderRadius: '50%', border: formColor === c ? '2px solid #000' : '2px solid transparent',
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
          {editingEvent && (
            <Button danger onClick={() => { setModalVisible(false); handleDelete(editingEvent); }} icon={<DeleteOutlined />}>
              删除此事件
            </Button>
          )}
        </Form>
      </Modal>
    </div>
  );
}
