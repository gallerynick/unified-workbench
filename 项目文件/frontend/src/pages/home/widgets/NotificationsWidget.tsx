import { useState, useEffect } from 'react';
import { Card, List, Typography, Badge, Spin, message } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { listNotifications, markAsRead } from '../../../api/notifications';
import type { Notification } from '../../../api/notifications';

const { Text } = Typography;

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString('zh-CN');
}

export default function NotificationsWidget() {
  const [list, setList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await listNotifications({ page: 1, page_size: 5 });
        if (res.code === 0) {
          setList(res.data.items);
        }
      } catch {
        // 保持空列表
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await markAsRead(id);
      if (res.code === 0) {
        setList((prev) =>
          prev.map((item) => (item.id === id ? { ...item, read: true } : item))
        );
      }
    } catch {
      message.error('标记失败');
    }
  };

  return (
    <Card
      title={
        <span>
          <BellOutlined style={{ marginRight: 8 }} />
          通知提醒
        </span>
      }
      size="small"
    >
      {loading ? <Spin /> : (
        <List
          size="small"
          dataSource={list}
          locale={{ emptyText: '暂无通知' }}
          renderItem={(item) => (
            <List.Item
              style={{ cursor: 'pointer' }}
              onClick={() => {
                if (!item.read) handleMarkAsRead(item.id);
                if (item.message.includes('投票')) {
                  navigate('/votes');
                } else if (item.message.includes('表单')) {
                  navigate('/forms');
                } else if (item.message.includes('公告')) {
                  navigate('/announcements');
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                {!item.read && <Badge status="processing" />}
                <Text {...(item.read ? { type: 'secondary' } : {})} ellipsis style={{ flex: 1 }}>
                  {item.message}
                </Text>
                <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                  {timeAgo(item.created_at)}
                </Text>
              </div>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
