import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Modal, Typography, message, Tooltip } from 'antd';
import {
  LeftOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  RightOutlined,
} from '@ant-design/icons';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import zhLocale from '@fullcalendar/core/locales/zh-cn';
import type {
  DateSelectArg,
  DayCellContentArg,
  EventClickArg,
  EventDropArg,
  EventInput,
  EventMountArg,
  ViewApi,
} from '@fullcalendar/core';
import dayjs from 'dayjs';
import { deleteCalendarEvent, listCalendarEvents, updateCalendarEvent } from '../../api/calendar';
import type { CalendarEvent } from '../../types/calendar';
import CalendarEventModal from './CalendarEventModal';
import ColorFilterBar from './ColorFilterBar';
import { DEFAULT_COLOR, loadActiveColors, saveActiveColors } from './CalendarColors';
import styles from './CalendarPage.module.css';
import './CalendarPage.global.css';

const { Title, Paragraph, Text } = Typography;

/** 拼接 CSS Module 类名（styles 索引访问后类型为 string | undefined，需收敛为 string） */
const cx = (...parts: Array<string | undefined | false>) => parts.filter(Boolean).join(' ');

/** 日历支持的四个视图键（含新增的列表视图） */
type CalViewKey = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';

/** 分段视图切换项 */
const VIEW_OPTIONS: Array<{ key: CalViewKey; label: string }> = [
  { key: 'dayGridMonth', label: '月' },
  { key: 'timeGridWeek', label: '周' },
  { key: 'timeGridDay', label: '日' },
  { key: 'listWeek', label: '列表' },
];

const WEEK_DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

function formatDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes())
  );
}

/**
 * 按视图类型格式化工具条标题
 *
 * 不依赖 FullCalendar 内置 title 文案（内置工具条已隐藏），
 * 周/列表视图使用视图实际渲染区间（firstDay=1 时为周一至周日）。
 */
function formatToolbarTitle(
  viewType: string,
  current: Date,
  activeStart: Date,
  activeEnd: Date,
): string {
  if (viewType === 'dayGridMonth') {
    return dayjs(current).format('YYYY年M月');
  }
  if (viewType === 'timeGridDay') {
    return ['星期', WEEK_DAY_NAMES[dayjs(current).day()], dayjs(current).format('M月D日')].join(
      ' ',
    );
  }
  const start = dayjs(activeStart);
  const end = dayjs(activeEnd);
  if (start.isSame(end, 'year') && start.isSame(end, 'month')) {
    return start.format('YYYY年M月') + ' ' + start.format('D日') + ' – ' + end.format('D日');
  }
  if (start.isSame(end, 'year')) {
    return start.format('YYYY年M月D日') + ' – ' + end.format('M月D日');
  }
  return start.format('YYYY年M月D日') + ' – ' + end.format('YYYY年M月D日');
}

/**
 * CalendarEvent → FullCalendar EventInput
 *
 * 事件颜色同时写入 DOM 自定义属性 --cal-event-color，
 * 供 CalendarPage.global.css 用 color-mix() 派生浅彩底与左侧色条。
 * extendedProps.color 存「显示色」（未着色回退默认蓝），
 * 与日历上的呈现口径一致——看到的即筛选所得。
 */
function toEventInput(e: CalendarEvent): EventInput {
  const displayColor = e.color || DEFAULT_COLOR;
  const event: EventInput = {
    id: e.id,
    title: e.title,
    start: e.start_time,
    allDay: e.all_day,
    backgroundColor: displayColor,
    borderColor: displayColor,
    classNames: [e.all_day ? 'cal-event-all-day' : 'cal-event-timed'],
    extendedProps: {
      color: displayColor,
      description: e.description,
      location: e.location,
      repeat: e.repeat,
      reminder_enabled: e.reminder_enabled,
      reminder_minutes: e.reminder_minutes,
    },
    eventDidMount: (arg: EventMountArg) => {
      arg.el.style.setProperty('--cal-event-color', displayColor);
    },
  };
  if (e.end_time) {
    event.end = e.end_time;
  }
  return event;
}

/** 从 FullCalendar 事件回构 CalendarEvent（供编辑弹窗使用） */
function eventToCalendarEvent(ev: EventClickArg['event']): CalendarEvent {
  return {
    id: ev.id,
    title: ev.title,
    description: ev.extendedProps?.description || null,
    start_time: ev.start ? ev.start.toISOString() : '',
    end_time: ev.end ? ev.end.toISOString() : null,
    all_day: ev.allDay,
    location: ev.extendedProps?.location || null,
    repeat: ev.extendedProps?.repeat || 'none',
    color: ev.extendedProps?.color === 'none' ? null : ev.extendedProps?.color || null,
    reminder_enabled: ev.extendedProps?.reminder_enabled || false,
    reminder_minutes: ev.extendedProps?.reminder_minutes || 15,
    reminded: false,
    owner_id: '',
    created_at: '',
    updated_at: '',
  };
}

export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  /** 新建事件时的默认起止时间（由打开方计算，交给弹窗初始化表单） */
  const [createDefaultStart, setCreateDefaultStart] = useState('');
  const [createDefaultEnd, setCreateDefaultEnd] = useState('');
  /** 新建事件时的默认颜色（仅当筛选条选中单一颜色时套用） */
  const [createDefaultColor, setCreateDefaultColor] = useState<string>(DEFAULT_COLOR);
  const [permissionVisible, setPermissionVisible] = useState(false);

  // ── 自绘工具条状态 ──────────────────────────────────────────────
  const [titleText, setTitleText] = useState<string>(() => dayjs().format('YYYY年M月'));
  const [activeView, setActiveView] = useState<CalViewKey>('dayGridMonth');
  const segRef = useRef<HTMLDivElement>(null);
  const [segThumb, setSegThumb] = useState<{ left: number; width: number } | null>(null);

  // ── 颜色筛选状态（偏好持久化到 localStorage） ─────────────────────
  const [activeColors, setActiveColors] = useState<string[]>(() => loadActiveColors());
  /** 当前视图范围内的全部事件（未过滤），供筛选条计数 */
  const [allEvents, setAllEvents] = useState<Array<{ color: string | null | undefined }>>([]);

  const getApi = useCallback(() => calendarRef.current?.getApi(), []);

  const goPrev = useCallback(() => getApi()?.prev(), [getApi]);
  const goNext = useCallback(() => getApi()?.next(), [getApi]);
  const goToday = useCallback(() => getApi()?.today(), [getApi]);

  const changeView = useCallback((key: CalViewKey) => getApi()?.changeView(key), [getApi]);

  /** 视图切换 / 日期变化后同步工具条标题与当前视图 */
  const syncView = useCallback((view: ViewApi) => {
    setActiveView(view.type as CalViewKey);
    setTitleText(
      formatToolbarTitle(view.type, view.currentStart, view.activeStart, view.activeEnd),
    );
  }, []);

  const handleDatesSet = useCallback((arg: { view: ViewApi }) => syncView(arg.view), [syncView]);

  const handleViewDidMount = useCallback(
    (arg: { view: ViewApi }) => syncView(arg.view),
    [syncView],
  );

  useEffect(() => {
    const api = getApi();
    if (api) syncView(api.view);
  }, [getApi, syncView]);

  // ── 分段切换滑块（跟随选中项平滑滑动） ───────────────────────────
  useEffect(() => {
    const seg = segRef.current;
    if (!seg) return;
    const active = seg.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    if (!active) {
      setSegThumb(null);
      return;
    }
    const segRect = seg.getBoundingClientRect();
    const btnRect = active.getBoundingClientRect();
    setSegThumb({ left: btnRect.left - segRect.left, width: btnRect.width });
  }, [activeView]);

  // ── 事件弹窗 ────────────────────────────────────────────────────
  const openCreateModal = useCallback(
    (startStr?: string) => {
      setEditingEvent(null);
      const start = startStr ? new Date(startStr) : new Date();
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() + 1);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      setCreateDefaultStart(formatDateTimeLocal(start));
      setCreateDefaultEnd(formatDateTimeLocal(end));
      setCreateDefaultColor(activeColors.length === 1 ? activeColors[0]! : DEFAULT_COLOR);
      setModalVisible(true);
    },
    [activeColors],
  );

  const openEditModal = useCallback((event: CalendarEvent) => {
    setEditingEvent(event);
    setModalVisible(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalVisible(false);
    setEditingEvent(null);
    setCreateDefaultStart('');
    setCreateDefaultEnd('');
    setCreateDefaultColor(DEFAULT_COLOR);
  }, []);

  const handleSaved = useCallback(() => {
    // 保存成功后刷新日历事件
    getApi()?.refetchEvents();
  }, [getApi]);

  const handleDelete = (event: CalendarEvent) => {
    Modal.confirm({
      title: '确认删除',
      content: ['确定要删除事件「', event.title, '」吗？'].join(''),
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteCalendarEvent(event.id);
          if (res.code === 0) {
            message.success('事件已删除');
            getApi()?.refetchEvents();
          }
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

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

  // ── 颜色筛选 ────────────────────────────────────────────────────
  const handleToggleColor = useCallback((value: string) => {
    setActiveColors((prev) => {
      const next = prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value];
      saveActiveColors(next);
      return next;
    });
  }, []);

  const handleShowAll = useCallback(() => {
    setActiveColors([]);
    saveActiveColors([]);
  }, []);

  // ── 事件拉取 ────────────────────────────────────────────────────
  const fetchEvents = useCallback(
    async (
      fetchInfo: { startStr: string; endStr: string },
      successCallback: (events: EventInput[]) => void,
    ) => {
      try {
        const res = await listCalendarEvents({
          start_date: fetchInfo.startStr,
          end_date: fetchInfo.endStr,
          page_size: 100,
        });
        if (res.code === 0) {
          const events = res.data.items;
          setAllEvents(events);
          const mapped = events.map(toEventInput);
          // 筛选：activeColors 为空表示显示全部
          const visible =
            activeColors.length === 0
              ? mapped
              : mapped.filter((ev) => activeColors.includes(ev.extendedProps?.color ?? ''));
          successCallback(visible);
        } else {
          setAllEvents([]);
          successCallback([]);
        }
      } catch {
        message.error('加载日历事件失败');
        setAllEvents([]);
        successCallback([]);
      }
    },
    [activeColors],
  );

  return (
    <div className={styles.container}>
      {/* ── 页面标题 + 工具条（标准表头：标题居左 + 操作居右） ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Title level={4} className={cx(styles.pageTitle)}>
            日程
          </Title>
          <span className={styles.monthLabel}>{titleText}</span>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.navGroup}>
            <button type="button" className={styles.navBtn} onClick={goPrev} aria-label="上一周期">
              <LeftOutlined />
            </button>
            <button type="button" className={styles.todayBtn} onClick={goToday}>
              今天
            </button>
            <button type="button" className={styles.navBtn} onClick={goNext} aria-label="下一周期">
              <RightOutlined />
            </button>
          </div>

          <div className={styles.segmented} ref={segRef} role="tablist" aria-label="视图切换">
            {segThumb && (
              <span
                className={styles.segThumb}
                style={{
                  transform: `translateX(${segThumb.left}px)`,
                  width: `${segThumb.width}px`,
                }}
                aria-hidden
              />
            )}
            {VIEW_OPTIONS.map((v) => (
              <button
                key={v.key}
                type="button"
                role="tab"
                aria-selected={activeView === v.key}
                className={activeView === v.key ? styles.segmentActive : ''}
                onClick={() => changeView(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>

          <Button
            type="primary"
            className={cx(styles.createBtn)}
            icon={<PlusOutlined />}
            onClick={() => openCreateModal()}
          >
            新建事件
          </Button>

          <Tooltip title="权限说明">
            <Button
              type="text"
              className={cx(styles.infoBtn)}
              icon={<QuestionCircleOutlined />}
              aria-label="权限说明"
              onClick={() => setPermissionVisible(true)}
            />
          </Tooltip>
        </div>
      </div>

      {/* ── 颜色筛选条 ── */}
      <ColorFilterBar
        events={allEvents}
        activeColors={activeColors}
        onToggleColor={handleToggleColor}
        onShowAll={handleShowAll}
      />

      {/* ── 日历主体（内置工具条已隐藏） ── */}
      <div className={styles.calendar}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          firstDay={1}
          locale={zhLocale}
          headerToolbar={false}
          dayCellContent={(arg: DayCellContentArg) => String(arg.date.getDate())}
          height="auto"
          selectable
          selectMirror
          editable
          dayMaxEvents={3}
          nowIndicator
          events={fetchEvents}
          datesSet={handleDatesSet}
          viewDidMount={handleViewDidMount}
          select={(selectInfo: DateSelectArg) => openCreateModal(selectInfo.startStr)}
          eventClick={(clickInfo: EventClickArg) =>
            openEditModal(eventToCalendarEvent(clickInfo.event))
          }
          eventDrop={handleEventDrop}
        />
      </div>

      <CalendarEventModal
        open={modalVisible}
        editingEvent={editingEvent}
        {...(editingEvent
          ? {}
          : {
              defaultStart: createDefaultStart,
              defaultEnd: createDefaultEnd,
              defaultColor: createDefaultColor,
            })}
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
        <div className={styles.permissionContent}>
          <Title level={5}>创建者权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>
            创建者拥有日程事件的完整管理权限，可以编辑事件信息、删除事件和设置可见范围。
          </Paragraph>
          <Title level={5}>成员/指定用户权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>
            可见范围内的成员可以查看日程事件；被指定的用户只能查看被授权给自己的事件。
          </Paragraph>
          <Title level={5}>可见范围</Title>
          <ul className={styles.permissionList}>
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
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>
            系统管理员可以管理自己创建以及被指定给自己的日程事件。
          </Paragraph>
          <Title level={5}>创建权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>
            所有成员都可以创建日程事件，创建时需设定可见范围。
          </Paragraph>
        </div>
      </Modal>
    </div>
  );
}
