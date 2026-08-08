import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Table, Typography, Space, message, Alert } from 'antd';
import {
  DesktopOutlined,
  MobileOutlined,
  TabletOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { request } from '../../utils/request';
import styles from './DevicesPage.module.css';

const { Title, Text } = Typography;

interface SessionRecord {
  id: string;
  device_name: string | null;
  device_type: string | null;
  ip_address: string | null;
  last_active_at: string;
  created_at: string;
}

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  desktop: <DesktopOutlined />,
  mobile: <MobileOutlined />,
  tablet: <TabletOutlined />,
};

const DEVICE_LABELS: Record<string, string> = {
  desktop: '桌面端',
  mobile: '手机端',
  tablet: '平板',
};

export default function DevicesPage() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request<SessionRecord[]>('/me/sessions');
      if (res.code === 0 && res.data) {
        setSessions(res.data);
      } else {
        message.error(res.msg || '获取设备列表失败');
      }
    } catch {
      message.error('获取设备列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleLogoutDevice = async (session: SessionRecord) => {
    setRevokingId(session.id);
    try {
      const res = await request(`/me/sessions/${session.id}`, { method: 'DELETE' });
      if (res.code === 0) {
        setSessions((prev) => prev.filter((s) => s.id !== session.id));
        message.success('设备已退出登录');
      } else {
        message.error(res.msg || '操作失败');
      }
    } catch {
      message.error('操作失败');
    } finally {
      setRevokingId(null);
    }
  };

  const columns = [
    {
      title: '设备',
      key: 'device',
      width: 220,
      render: (_: unknown, record: SessionRecord) => (
        <Space>
          {DEVICE_ICONS[record.device_type || 'desktop']}
          <div>
            <div>
              {record.device_name || '未知设备'}
            </div>
            <Text type="secondary">
              {DEVICE_LABELS[record.device_type || 'desktop'] || record.device_type}
              {record.ip_address ? ` · ${record.ip_address}` : ''}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: '登录时间',
      dataIndex: 'created_at' as const,
      key: 'created_at',
      width: 170,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '最后活跃',
      dataIndex: 'last_active_at' as const,
      key: 'last_active_at',
      width: 170,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, record: SessionRecord) => (
        <Button
          type="link"
          danger
          icon={<LogoutOutlined />}
          onClick={() => handleLogoutDevice(record)}
          loading={revokingId === record.id}
        >
          退出登录
        </Button>
      ),
    },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>设备终端</Title>
        <Button
          danger
          icon={<LogoutOutlined />}
          onClick={async () => {
            for (const s of sessions) {
              try {
                await request(`/me/sessions/${s.id}`, { method: 'DELETE' });
              } catch { /* continue */ }
            }
            setSessions([]);
            message.success('已注销所有设备');
          }}
          disabled={sessions.length === 0}
        >
          注销所有设备
        </Button>
      </div>

      <Alert
        message="查看和管理当前账号的登录设备。退出设备后该设备下次请求将被要求重新登录。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card>
        <Table<SessionRecord>
          className={styles.table ?? ''}
          columns={columns}
          dataSource={sessions}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  );
}
