import { Badge, Dropdown, List, Typography, Button, Empty } from 'antd';
import { BellOutlined, CheckOutlined, ExpandOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const recentNotifications = notifications.slice(0, 10);

  const dropdownContent = (
    <div
      style={{
        width: 320,
        maxHeight: 400,
        overflow: 'auto',
        background: 'var(--bg-primary)',
        borderRadius: 'var(--rounded-sm)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-secondary)',
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
                    background: item.read ? 'transparent' : 'var(--color-success-bg)',
                }}
                onClick={() => {
                  onMarkAsRead(item.id);
                  if (item.title.includes('投票') || item.content.includes('投票')) {
                    navigate('/votes');
                  } else if (item.title.includes('表单') || item.content.includes('表单')) {
                    navigate('/forms');
                  } else if (item.title.includes('公告') || item.content.includes('公告')) {
                    navigate('/announcements');
                  }
                }}
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
                        style={{ margin: 0, fontSize: 'var(--text-body-xs-size)' }}
                      >
                        {item.content}
                      </Typography.Paragraph>
                      <Typography.Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                        {new Date(item.timestamp).toLocaleTimeString('zh-CN')}
                      </Typography.Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
          {notifications.length > 10 && (
            <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-secondary)', textAlign: 'center' }}>
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
        <BellOutlined style={{ fontSize: 'var(--text-heading-3-size)', cursor: 'pointer' }} />
      </Badge>
    </Dropdown>
  );
}
