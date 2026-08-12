import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Table, Typography, Space, message, Alert, Modal } from 'antd';
import {
  DesktopOutlined,
  MobileOutlined,
  TabletOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { request } from '../../utils/request';
import styles from './DevicesPage.module.css';

const { Title, Text } = Typography;

interface DeviceRecord {
  device_token: string;
  device_name: string | null;
  device_type: string | null;
  ip_address: string | null;
  session_count: number;
  last_active_at: string;
}

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

const getDeviceIcon = (t: string | null) => DEVICE_ICONS[t ?? ''] ?? <QuestionCircleOutlined />;

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Record<string, SessionRecord[]>>({});
  const [loadingSessions, setLoadingSessions] = useState<Record<string, boolean>>({});
  const [revokingToken, setRevokingToken] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request<DeviceRecord[]>('/me/devices');
      if (res.code === 0 && res.data) setDevices(res.data);
      else message.error(res.msg || '获取设备列表失败');
    } catch {
      message.error('获取设备列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const handleExpand = async (expanded: boolean, record: DeviceRecord) => {
    if (!expanded) return;
    if (expandedSessions[record.device_token]) return;
    setLoadingSessions((prev) => ({ ...prev, [record.device_token]: true }));
    try {
      const res = await request<SessionRecord[]>(`/me/devices/${encodeURIComponent(record.device_token)}/sessions`);
      if (res.code === 0) setExpandedSessions((prev) => ({ ...prev, [record.device_token]: res.data ?? [] }));
    } catch { /* ignore */ }
    finally { setLoadingSessions((prev) => ({ ...prev, [record.device_token]: false })); }
  };

  const handleLogoutDevice = (device: DeviceRecord) => {
    Modal.confirm({
      title: '注销设备',
      content: `确定要注销该设备上的 ${device.session_count} 个会话吗？该设备所有会话将被强制下线。`,
      okText: '注销',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        setRevokingToken(device.device_token);
        try {
          const res = await request<{ affected_count: number }>(`/me/devices/${encodeURIComponent(device.device_token)}`, { method: 'DELETE' });
          if (res.code === 0) {
            message.success(`已注销 ${res.data?.affected_count ?? device.session_count} 个会话`);
            setExpandedSessions((prev) => { const n = { ...prev }; delete n[device.device_token]; return n; });
            await fetchDevices();
          } else {
            message.error(res.msg || '操作失败');
          }
        } catch { message.error('操作失败'); }
        finally { setRevokingToken(null); }
      },
    });
  };

  const columns = [
    {
      title: '设备',
      key: 'device',
      width: 260,
      render: (_: unknown, record: DeviceRecord) => (
        <Space>
          {getDeviceIcon(record.device_type)}
          <div>
            <div>{record.device_name || '未知设备'}</div>
            <Text type="secondary">
              {(record.device_type ? DEVICE_LABELS[record.device_type] || record.device_type : '未知类型')}
              {record.ip_address ? ` · ${record.ip_address}` : ''}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: '登录次数',
      dataIndex: 'session_count' as const,
      key: 'session_count',
      width: 100,
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
      render: (_: unknown, record: DeviceRecord) =>
        record.device_token ? (
          <Button
            type="link"
            danger
            icon={<LogoutOutlined />}
            onClick={() => handleLogoutDevice(record)}
            loading={revokingToken === record.device_token}
          >
            注销设备
          </Button>
        ) : null,
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
            for (const d of devices) {
              if (!d.device_token) continue;
              try { await request(`/me/devices/${encodeURIComponent(d.device_token)}`, { method: 'DELETE' }); } catch { /* continue */ }
            }
            setExpandedSessions({});
            await fetchDevices();
            message.success('已注销所有设备');
          }}
          disabled={devices.length === 0}
        >
          注销所有设备
        </Button>
      </div>
      <Alert
        message="按设备分组展示登录记录。点击设备行可展开查看该设备最近的 15 次登录历史。"
        type="info" showIcon style={{ marginBottom: 16 }}
      />
      <Card>
        <Table<DeviceRecord>
          className={styles.table ?? ''}
          columns={columns}
          dataSource={devices}
          rowKey="device_token"
          loading={loading}
          pagination={false}
          expandable={{
            expandedRowRender: (record) => {
              const list = expandedSessions[record.device_token];
              if (loadingSessions[record.device_token]) return <Text type="secondary">加载中...</Text>;
              if (!list || list.length === 0) return <Text type="secondary">无记录</Text>;
              return (
                <Table<SessionRecord>
                  rowKey="id"
                  dataSource={list}
                  pagination={false}
                  size="small"
                  columns={[
                    { title: '登录时间', dataIndex: 'created_at', width: 170, render: (d: string) => new Date(d).toLocaleString('zh-CN') },
                    { title: 'IP 地址', dataIndex: 'ip_address', width: 160, render: (ip: string | null) => ip ?? '-' },
                    { title: '最后活跃', dataIndex: 'last_active_at', width: 170, render: (d: string) => new Date(d).toLocaleString('zh-CN') },
                  ]}
                />
              );
            },
            onExpand: (expanded, record) => handleExpand(expanded, record),
          }}
        />
      </Card>
    </div>
  );
}
