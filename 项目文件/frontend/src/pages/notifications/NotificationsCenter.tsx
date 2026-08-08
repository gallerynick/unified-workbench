import { useState, useEffect, useCallback } from 'react';
import { Card, List, Typography, Tag, Button, message, Empty, Space } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { request } from '../../utils/request';
import styles from './NotificationsCenter.module.css';

const { Title, Text, Paragraph } = Typography;

interface NotificationItem {
  id: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

export default function NotificationsCenter() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request<{ items: NotificationItem[]; total: number }>(
        `/notifications/?page=${page}&page_size=20`,
      );
      if (res.code === 0 && res.data) {
        setNotifications(res.data.items);
        setTotal(res.data.total);
      }
    } catch {
      message.error('获取通知失败');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await request(`/notifications/${id}/read`, { method: 'PUT' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      message.error('操作失败');
    }
  };

  const markAllAsRead = async () => {
    try {
      await request('/notifications/read-all', { method: 'PUT' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      message.success('全部标记为已读');
    } catch {
      message.error('操作失败');
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>
          <BellOutlined /> 通知中心
        </Title>
        <Space>
          {unreadCount > 0 && (
            <Text type="secondary">{unreadCount} 条未读</Text>
          )}
          <Button icon={<CheckOutlined />} onClick={markAllAsRead} disabled={unreadCount === 0}>
            全部已读
          </Button>
        </Space>
      </div>

      <Card className={styles.card ?? ''} loading={loading}>
        {notifications.length === 0 ? (
          <Empty description="暂无通知" />
        ) : (
          <List
            dataSource={notifications}
            pagination={{
              current: page,
              pageSize: 20,
              total,
              showSizeChanger: false,
              showTotal: (t) => `共 ${t} 条`,
              onChange: (p) => setPage(p),
            }}
            renderItem={(item) => {
              const lines = item.message.split('\n');
              const title = lines[0]?.replace('提醒：', '');
              const content = lines.slice(1).join('\n');
              return (
                <List.Item
                  key={item.id}
                  className={item.read ? styles.readItem ?? '' : styles.unreadItem ?? ''}
                  actions={
                    !item.read
                      ? [<Button key="read" type="link" size="small" onClick={() => markAsRead(item.id)}>标为已读</Button>]
                      : []
                  }
                >
                  <List.Item.Meta
                    avatar={
                      <Tag color={item.read ? 'default' : 'blue'}>
                        {item.read ? '已读' : '未读'}
                      </Tag>
                    }
                    title={title || item.message}
                    description={
                      <>
                        {content ? <Paragraph type="secondary" style={{ margin: 0 }}>{content}</Paragraph> : null}
                        <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                          {new Date(item.created_at).toLocaleString('zh-CN')}
                        </Text>
                      </>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>
    </div>
  );
}
