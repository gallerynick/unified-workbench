import { Drawer, List, Typography, Button, Empty, Tag } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import type { Notification } from '../hooks/useWebSocket';
import styles from './NotificationDrawer.module.css';

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

export default function NotificationDrawer({
  open,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
}: NotificationDrawerProps) {
  return (
    <Drawer
      title="通知中心"
      open={open}
      onClose={onClose}
      width={420}
      extra={
        <Button
          type="link"
          icon={<CheckOutlined />}
          onClick={onMarkAllAsRead}
        >
          全部已读
        </Button>
      }
    >
      {notifications.length === 0 ? (
        <Empty description="暂无通知" />
      ) : (
        <List
          dataSource={notifications}
          renderItem={(item) => (
            <List.Item
              className={`${styles.notificationItem || ''} ${!item.read ? styles.unread || '' : ''}`}
              onClick={() => onMarkAsRead(item.id)}
              actions={[!item.read ? <Tag key="unread" color="green">未读</Tag> : null]}
            >
              <List.Item.Meta
                className={styles.notificationContent || ''}
                title={
                  <div className={styles.notificationTitle}>
                    <Typography.Text strong={!item.read}>
                      {item.title}
                    </Typography.Text>
                  </div>
                }
                description={
                  <div>
                    <Typography.Paragraph style={{ margin: 0 }}>
                      {item.content}
                    </Typography.Paragraph>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(item.timestamp).toLocaleString('zh-CN')}
                    </Typography.Text>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Drawer>
  );
}
