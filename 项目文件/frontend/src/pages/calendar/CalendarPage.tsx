import { useState, useRef, useCallback } from 'react';
import { Button, Typography, Modal, message, Space, Tooltip } from 'antd';
import { PlusOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import zhLocale from '@fullcalendar/core/locales/zh-cn';
import type { DateSelectArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core';
import { listCalendarEvents, updateCalendarEvent, deleteCalendarEvent } from '../../api/calendar';
import type { CalendarEvent } from '../../types/calendar';
import CalendarEventModal from './CalendarEventModal';
import styles from './CalendarPage.module.css';
import './CalendarPage.global.css';

const { Title, Paragraph, Text } = Typography;

function formatDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  // 新建事件时的默认起止时间（由打开方计算，交给弹窗初始化表单）
  const [createDefaultStart, setCreateDefaultStart] = useState('');
  const [createDefaultEnd, setCreateDefaultEnd] = useState('');
  const [permissionVisible, setPermissionVisible] = useState(false);

  const openCreateModal = useCallback((startStr?: string) => {
    setEditingEvent(null);
    const start = startStr ? new Date(startStr) : new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setCreateDefaultStart(formatDateTimeLocal(start));
    setCreateDefaultEnd(formatDateTimeLocal(end));
    setModalVisible(true);
  }, []);

  const openEditModal = useCallback((event: CalendarEvent) => {
    setEditingEvent(event);
    setModalVisible(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalVisible(false);
    setEditingEvent(null);
    setCreateDefaultStart('');
    setCreateDefaultEnd('');
  }, []);

  const handleSaved = useCallback(() => {
    // 保存成功后刷新日历事件
    const api = calendarRef.current?.getApi();
    if (api) api.refetchEvents();
  }, []);

  const handleDelete = (event: CalendarEvent) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除事件「${event.title}」吗？`,
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
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
            backgroundColor: e.color || 'var(--color-info)',
            borderColor: e.color || 'var(--color-info)',
            extendedProps: {
              description: e.description,
              location: e.location,
              repeat: e.repeat,
              reminder_enabled: e.reminder_enabled,
              reminder_minutes: e.reminder_minutes,
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
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateModal()}>新建事件</Button>
          <Tooltip title="权限说明">
            <Button
              type="text"
              size="small"
              icon={<QuestionCircleOutlined />}
              onClick={() => setPermissionVisible(true)}
            />
          </Tooltip>
        </Space>
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
              reminder_enabled: ev.extendedProps?.reminder_enabled || false,
              reminder_minutes: ev.extendedProps?.reminder_minutes || 15,
              reminded: false,
              owner_id: '',
              created_at: '',
              updated_at: '',
            };
          openEditModal(calEvent);
        }}
        eventDrop={handleEventDrop}
      />

      <CalendarEventModal
        open={modalVisible}
        editingEvent={editingEvent}
        {...(editingEvent ? {} : { defaultStart: createDefaultStart, defaultEnd: createDefaultEnd })}
        onClose={handleModalClose}
        onSaved={handleSaved}
        onDelete={handleDelete}
      />

      <Modal
        title="权限说明"
        open={permissionVisible}
        width={560}
        footer={null}
        onCancel={() => setPermissionVisible(false)}
      >
        <div className={styles.permissionContent ?? ''}>
          <Title level={5}>创建者权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>创建者拥有日程事件的完整管理权限，可以编辑事件信息、删除事件和设置可见范围。</Paragraph>
          <Title level={5}>成员/指定用户权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>可见范围内的成员可以查看日程事件；被指定的用户只能查看被授权给自己的事件。</Paragraph>
          <Title level={5}>可见范围</Title>
          <ul className={styles.permissionList ?? ''}>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                公开：所有成员都可以查看该日程事件
              </Text>
            </li>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                私有：仅创建者和被授权成员可以查看
              </Text>
            </li>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                指定用户：仅被指定的用户可以看到该日程事件
              </Text>
            </li>
          </ul>
          <Title level={5}>管理员</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>系统管理员可以管理自己创建以及被指定给自己的日程事件。</Paragraph>
          <Title level={5}>创建权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>所有成员都可以创建日程事件，创建时需设定可见范围。</Paragraph>
        </div>
      </Modal>
    </div>
  );
}
