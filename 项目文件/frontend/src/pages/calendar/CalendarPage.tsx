import { useState, useEffect, useCallback } from 'react';
import { Button, Typography, Modal, message, Space, Input, Card, Tag } from 'antd';
import { PlusOutlined, LeftOutlined, RightOutlined, DeleteOutlined, EditOutlined, CalendarOutlined } from '@ant-design/icons';
import { listCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../../api/calendar';
import type { CalendarEvent } from '../../types/calendar';
import styles from './CalendarPage.module.css';

const { Title, Text } = Typography;

const DAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const fetchEvents = useCallback(async () => {
    try {
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${daysInMonth}`;
      const res = await listCalendarEvents({ start_date: startDate, end_date: endDate, page_size: 100 });
      if (res.code === 0) {
        setEvents(res.data.items);
      }
    } catch {
      message.error('获取事件失败');
    }
  }, [year, month, daysInMonth]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const getEventsForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => e.start_time.startsWith(dateStr));
  };

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleCreate = (date: string = today) => {
    setEditingEvent(null);
    setFormTitle('');
    setFormDescription('');
    setFormDate(date ?? today);
    setFormTime('09:00');
    setModalVisible(true);
  };

  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormDescription(event.description || '');
    setFormDate(event.start_time.split('T')[0] ?? '');
    setFormTime(event.start_time.split('T')[1]?.substring(0, 5) ?? '09:00');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) { message.warning('请输入事件标题'); return; }
    if (!formDate) { message.warning('请选择日期'); return; }
    setSaving(true);
    try {
      const start_time = `${formDate}T${formTime}:00`;
      if (editingEvent) {
        const res = await updateCalendarEvent(editingEvent.id, { title: formTitle, description: formDescription, start_time });
        if (res.code === 0) { message.success('事件已更新'); setModalVisible(false); fetchEvents(); }
      } else {
        const res = await createCalendarEvent({ title: formTitle, description: formDescription, start_time });
        if (res.code === 0) { message.success('事件已创建'); setModalVisible(false); fetchEvents(); }
      }
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
          if (res.code === 0) { message.success('事件已删除'); fetchEvents(); }
        } catch { message.error('删除失败'); }
      },
    });
  };

  const renderCalendarDays = () => {
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className={styles.emptyDay ?? ''} />);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = getEventsForDate(day);
      const isToday = dateStr === today;
      const isSelected = dateStr === selectedDate;
      days.push(
          <button
            key={day}
            type="button"
            className={`${styles.day ?? ''} ${isToday ? styles.today ?? '' : ''} ${isSelected ? styles.selected ?? '' : ''}`}
            onClick={() => setSelectedDate(dateStr)}
            onDoubleClick={() => handleCreate(dateStr)}
          >
          <div className={styles.dayNumber ?? ''}>{day}</div>
          <div className={styles.dayEvents ?? ''}>
            {dayEvents.slice(0, 2).map((e) => (
              <div key={e.id} className={styles.eventDot ?? ''} style={{ background: e.color || '#1677ff' }}>
                {e.title}
              </div>
            ))}
            {dayEvents.length > 2 && <div className={styles.moreEvents ?? ''}>+{dayEvents.length - 2}</div>}
          </div>
          </button>
      );
    }
    return days;
  };

  const selectedEvents = selectedDate ? events.filter((e) => e.start_time.startsWith(selectedDate)) : [];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4}><CalendarOutlined /> 日历</Title>
        <Space>
          <Button icon={<LeftOutlined />} onClick={handlePrevMonth} />
          <Text strong>{year}年{month + 1}月</Text>
          <Button icon={<RightOutlined />} onClick={handleNextMonth} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleCreate()}>新建事件</Button>
        </Space>
      </div>

      <div className={styles.calendar ?? ''}>
        <div className={styles.weekdays ?? ''}>
          {DAYS.map((d) => <div key={d} className={styles.weekday ?? ''}>{d}</div>)}
        </div>
        <div className={styles.days ?? ''}>
          {renderCalendarDays()}
        </div>
      </div>

      {selectedDate && (
        <Card title={`${selectedDate} 的事件`} className={styles.eventList ?? ''}>
          {selectedEvents.length === 0 ? (
            <Text type="secondary">暂无事件</Text>
          ) : (
            selectedEvents.map((e) => (
              <div key={e.id} className={styles.eventItem ?? ''}>
                <div className={styles.eventInfo ?? ''}>
                  <Tag color={e.color || 'blue'}>{e.start_time.split('T')[1]?.substring(0, 5)}</Tag>
                  <Text strong>{e.title}</Text>
                  {e.description && <Text type="secondary"> - {e.description}</Text>}
                </div>
                <Space size="small">
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(e)} />
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(e)} />
                </Space>
              </div>
            ))
          )}
        </Card>
      )}

      <Modal title={editingEvent ? '编辑事件' : '新建事件'} open={modalVisible} onOk={handleSave}
        onCancel={() => setModalVisible(false)} okText="保存" cancelText="取消"
        okButtonProps={{ loading: saving }} confirmLoading={saving}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Input placeholder="事件标题" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
          <Input.TextArea placeholder="事件描述（可选）" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} />
          <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
          <Input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} />
        </Space>
      </Modal>
    </div>
  );
}
