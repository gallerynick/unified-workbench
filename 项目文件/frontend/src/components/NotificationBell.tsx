import { Badge, Dropdown, List, Typography, Button, Empty } from 'antd';
import { BellOutlined, CheckOutlined, ExpandOutlined } from '@ant-design/icons';
import type { Notification } from '../hooks/useWebSocket';

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onOpenDrawer: () => void;
}

export default function NotificationBell({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onOpenDrawer,
}: NotificationBellProps) {
  const recentNotifications = notifications.slice(0, 10);

  const dropdownContent = (
    <div
      style={{
        width: 320,
        maxHeight: 400,
        overflow: 'auto',
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography.Text strong>通知</Typography.Text>
        {unreadCount > 0 && (
          <Button
            type="link"
            size="small"
            icon={<CheckOutlined />}
            onClick={onMarkAllAsRead}
          >
            全部已读
          </Button>
        )}
      </div>
      {recentNotifications.length === 0 ? (
        <Empty description="暂无通知" style={{ padding: 24 }} />
      ) : (
        <>
          <List
            dataSource={recentNotifications}
            renderItem={(item) => (
              <List.Item
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: item.read ? 'transparent' : '#f6ffed',
                }}
                onClick={() => onMarkAsRead(item.id)}
              >
                <List.Item.Meta
                  title={
                    <Typography.Text strong={!item.read}>
                      {item.title}
                    </Typography.Text>
                  }
                  description={
                    <div>
                      <Typography.Paragraph
                        ellipsis={{ rows: 2 }}
                        style={{ margin: 0, fontSize: 12 }}
                      >
                        {item.content}
                      </Typography.Paragraph>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {new Date(item.timestamp).toLocaleTimeString('zh-CN')}
                      </Typography.Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
          {notifications.length > 10 && (
            <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
              <Button type="link" size="small" icon={<ExpandOutlined />} onClick={onOpenDrawer}>
                查看全部通知
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <Dropdown
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
    >
      <Badge count={unreadCount} size="small">
        <BellOutlined style={{ fontSize: 20, cursor: 'pointer' }} />
      </Badge>
    </Dropdown>
  );
}
