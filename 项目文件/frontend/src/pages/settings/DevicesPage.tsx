import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Table,
  Typography,
  Space,
  message,
  Modal,
  Tag,
  Empty,
  Alert,
} from 'antd';
import {
  DesktopOutlined,
  MobileOutlined,
  TabletOutlined,
  QuestionCircleOutlined,
  RedoOutlined,
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
  device_token: string | null;
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

const getDeviceIcon = (deviceType: string | null): React.ReactNode =>
  DEVICE_ICONS[deviceType || ''] ?? <QuestionCircleOutlined />;

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request<DeviceRecord[]>('/me/devices');
      if (res.code === 0 && res.data) {
        setDevices(res.data);
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
    fetchDevices();
  }, [fetchDevices]);

  const fetchSessions = useCallback(async (token: string) => {
    setSessionsLoading(true);
    setSessions([]);
    try {
      const res = await request<SessionRecord[]>(
        `/me/devices/${encodeURIComponent(token)}/sessions`
      );
      if (res.code === 0) {
        setSessions(res.data ?? []);
      } else {
        message.error(res.msg || '获取会话记录失败');
      }
    } catch {
      message.error('获取会话记录失败');
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const handleToggleDevice = (device: DeviceRecord) => {
    if (device.device_token === '') {
      return;
    }
    if (expandedToken === device.device_token) {
      setExpandedToken(null);
      setSessions([]);
      return;
    }
    setExpandedToken(device.device_token);
    fetchSessions(device.device_token);
  };

  const handleDeleteDevice = (device: DeviceRecord) => {
    Modal.confirm({
      title: '注销设备',
      content: `确定要注销该设备上的 ${device.session_count} 个会话吗？注销后该设备所有会话将被强制下线，需要重新登录。`,
      okText: '注销',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await request<{ affected_count: number }>(
            `/me/devices/${encodeURIComponent(device.device_token)}`,
            { method: 'DELETE' }
          );
          if (res.code === 0) {
            const count = res.data?.affected_count ?? 0;
            message.success(`已注销 ${count} 个会话`);
            setExpandedToken(null);
            setSessions([]);
            await fetchDevices();
          } else {
            message.error(res.msg || '操作失败');
          }
        } catch {
          message.error('操作失败');
        }
      },
    });
  };

  const sessionColumns = [
    {
      title: '设备',
      key: 'device',
      render: (_: unknown, record: SessionRecord) => (
        <Space>
          {getDeviceIcon(record.device_type)}
          <span>{record.device_name || '未知设备'}</span>
        </Space>
      ),
    },
    {
      title: 'IP 地址',
      dataIndex: 'ip_address' as const,
      key: 'ip_address',
      render: (ip: string | null) => ip || '-',
    },
    {
      title: '创建时间',
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
      title: '状态',
      key: 'status',
      width: 110,
      render: (_: unknown, _record: SessionRecord, index: number) =>
        index === 0 ? <Tag color="processing">当前会话</Tag> : null,
    },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>设备终端</Title>
      </div>

      <Alert
        message="按设备分组展示当前账号的登录记录。点击设备卡片可查看该设备的会话明细；注销设备会将该设备上的所有会话强制下线，需要重新登录。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {loading ? (
        <Card loading />
      ) : devices.length === 0 ? (
        <Card>
          <Empty description="暂无登录设备记录" />
        </Card>
      ) : (
        <>
          <Card className={styles.deviceGridWrap ?? ''} bordered={false}>
            {devices.map((device) => {
              const expanded = expandedToken === device.device_token;
              const isLegacy = device.device_token === '';
              return (
                <Card.Grid
                  key={device.device_token}
                  hoverable={false}
                  className={`${styles.deviceCard ?? ''} ${
                    isLegacy ? (styles.deviceCardStatic ?? '') : ''
                  } ${expanded ? (styles.deviceCardExpanded ?? '') : ''}`}
                  onClick={() => handleToggleDevice(device)}
                >
                  <div className={styles.deviceCardBody ?? ''}>
                    <div className={styles.deviceCardTop ?? ''}>
                      <span className={styles.deviceIcon ?? ''}>
                        {getDeviceIcon(device.device_type)}
                      </span>
                      <span className={styles.deviceName ?? ''}>
                        {device.device_name || '未知设备'}
                      </span>
                      {!isLegacy && (
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<RedoOutlined />}
                          title="注销设备"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDevice(device);
                          }}
                        />
                      )}
                    </div>
                    <div className={styles.deviceInfo ?? ''}>
                      {DEVICE_LABELS[device.device_type || ''] || device.device_type || ''}
                      {device.ip_address ? ` · ${device.ip_address}` : ''}
                    </div>
                    <div className={styles.deviceStats ?? ''}>
                      <Text type="secondary">
                        {device.session_count} 条登录
                      </Text>
                      <Text type="secondary">
                        {new Date(device.last_active_at).toLocaleString('zh-CN')}
                      </Text>
                    </div>
                  </div>
                </Card.Grid>
              );
            })}
          </Card>

          {expandedToken !== null && (
            <Card className={styles.sessionPanel ?? ''}>
              <Title level={5} className={styles.sessionTitle ?? ''}>
                最近 20 条会话记录
              </Title>
              <Table<SessionRecord>
                className={styles.table ?? ''}
                columns={sessionColumns}
                dataSource={sessions}
                rowKey="id"
                loading={sessionsLoading}
                pagination={false}
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
