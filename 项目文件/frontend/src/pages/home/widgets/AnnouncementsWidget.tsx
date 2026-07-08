import { useState, useEffect } from 'react';
import { Card, List, Typography, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import { SoundOutlined } from '@ant-design/icons';
import { listAnnouncements } from '../../../api/announcements';
import type { Announcement } from '../../../types/announcement';

const { Text } = Typography;

export default function AnnouncementsWidget() {
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await listAnnouncements({ page: 1, page_size: 5 });
        if (res.code === 0) {
          setList(res.data.items);
        }
      } catch {
        // 保持空列表
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  return (
    <Card
      title={
        <span>
          <SoundOutlined style={{ marginRight: "var(--spacing-xs)" }} />
          最新公告
        </span>
      }
      size="small"
      extra={<a onClick={() => navigate('/announcements')}>查看全部</a>}
    >
      {loading ? <Spin /> : (
        <List
          size="small"
          dataSource={list}
          locale={{ emptyText: '暂无公告' }}
          renderItem={(item) => (
            <List.Item style={{ cursor: 'pointer' }} onClick={() => navigate('/announcements')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: "var(--spacing-xs)", width: '100%' }}>
                <Text ellipsis style={{ flex: 1 }}>{item.title}</Text>
                <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)', whiteSpace: 'nowrap' }}>
                  {new Date(item.created_at).toLocaleDateString('zh-CN')}
                </Text>
              </div>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
