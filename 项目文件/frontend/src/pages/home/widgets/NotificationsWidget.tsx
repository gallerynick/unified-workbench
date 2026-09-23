import { List, Typography, Badge } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../../../hooks/useWebSocket';

const { Text } = Typography;

function timeAgo(ts: number): string {
  const now = new Date().getTime();
  const diffMs = now - ts;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

// 外壳与标题行由 SortableWidget 统一渲染（标题与「查看全部」见 Home.tsx 的 WIDGET_META）
export default function NotificationsWidget() {
  const { notifications, markAsRead } = useWebSocket();
  const navigate = useNavigate();
  const displayList = notifications.slice(0, 5);

  const handleMarkAsRead = (id: string) => {
    markAsRead(id);
    navigate('/notifications');
  };

  return (
    <List
      size="small"
      dataSource={displayList}
      locale={{ emptyText: '暂无通知' }}
      renderItem={(item) => (
        <List.Item
          style={{ cursor: 'pointer' }}
          onClick={() => handleMarkAsRead(item.id)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', width: '100%' }}>
            {!item.read && <Badge status="processing" />}
            <Text {...(item.read ? { type: 'secondary' } : {})} ellipsis style={{ flex: 1 }}>
              {item.title || item.content}
            </Text>
            <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)', whiteSpace: 'nowrap' }}>
              {timeAgo(item.timestamp)}
            </Text>
          </div>
        </List.Item>
      )}
    />
  );
}