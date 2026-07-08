import { useState, useEffect } from 'react';
import { Card, Badge, List, Typography, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import { CalendarOutlined } from '@ant-design/icons';
import { listCalendarEvents } from '../../../api/calendar';
import type { CalendarEvent } from '../../../types/calendar';

const { Text } = Typography;

function getEventType(event: CalendarEvent): 'success' | 'warning' | 'error' | 'processing' {
  if (event.all_day) return 'success';
  const start = new Date(event.start_time);
  const now = new Date();
  const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (diffHours < 0) return 'error';
  if (diffHours < 24) return 'warning';
  return 'processing';
}

export default function CalendarWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const res = await listCalendarEvents({
          page: 1,
          page_size: 5,
          start_date: now.toISOString(),
          end_date: nextWeek.toISOString(),
        });
        if (res.code === 0) {
          setEvents(res.data.items);
        }
      } catch {
        // 保持空列表
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  return (
    <Card
      title={
        <span>
          <CalendarOutlined style={{ marginRight: "var(--spacing-xs)" }} />
          近期日程
        </span>
      }
      size="small"
      extra={<a onClick={() => navigate('/calendar')}>查看全部</a>}
    >
      {loading ? <Spin /> : (
        <List
          size="small"
          dataSource={events}
          locale={{ emptyText: '近期无日程' }}
          renderItem={(item) => (
            <List.Item style={{ cursor: 'pointer' }} onClick={() => navigate('/calendar')}>
              <Badge status={getEventType(item)} text={item.title} />
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                {new Date(item.start_time).toLocaleDateString('zh-CN')}
              </Text>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
