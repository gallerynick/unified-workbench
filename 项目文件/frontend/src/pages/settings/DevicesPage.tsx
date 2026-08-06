import { useState } from 'react';
import { Card, Table, Typography, Tag, Space, Button, message, Alert } from 'antd';
import { DesktopOutlined, MobileOutlined, TabletOutlined, LoginOutlined, LogoutOutlined } from '@ant-design/icons';
import styles from './DevicesPage.module.css';

const { Title, Text } = Typography;

interface Device {
  id: string;
  device_type: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  ip: string;
  last_active: string;
  is_current: boolean;
}

const DEVICE_ICONS = {
  desktop: <DesktopOutlined />,
  mobile: <MobileOutlined />,
  tablet: <TabletOutlined />,
};

const MOCK_DEVICES: Device[] = [
  {
    id: '1',
    device_type: 'desktop',
    browser: 'Chrome 120',
    os: 'macOS 14.2',
    ip: '192.168.1.100',
    last_active: new Date().toISOString(),
    is_current: true,
  },
  {
    id: '2',
    device_type: 'mobile',
    browser: 'Safari 17',
    os: 'iOS 17.2',
    ip: '192.168.1.101',
    last_active: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    is_current: false,
  },
  {
    id: '3',
    device_type: 'tablet',
    browser: 'Edge 120',
    os: 'Windows 11',
    ip: '10.0.0.5',
    last_active: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    is_current: false,
  },
];

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>(MOCK_DEVICES);

  const handleLogoutDevice = (device: Device) => {
    if (device.is_current) {
      message.warning('不能退出当前设备');
      return;
    }
    setDevices((prev) => prev.filter((d) => d.id !== device.id));
    message.success('设备已退出登录');
  };

  const handleLogoutAll = () => {
    setDevices((prev) => prev.filter((d) => d.is_current));
    message.success('已注销其他设备');
  };

  const columns = [
    {
      title: '设备',
      key: 'device',
      render: (_: unknown, record: Device) => (
        <Space>
          {DEVICE_ICONS[record.device_type]}
          <div>
            <div>{record.browser}</div>
            <Text type="secondary">{record.os}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: '浏览器',
      dataIndex: 'browser' as const,
      key: 'browser',
    },
    {
      title: '操作系统',
      dataIndex: 'os' as const,
      key: 'os',
    },
    {
      title: 'IP地址',
      dataIndex: 'ip' as const,
      key: 'ip',
    },
    {
      title: '最后活跃',
      dataIndex: 'last_active' as const,
      key: 'last_active',
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Device) => (
        <Space>
          {record.is_current ? (
            <Tag color="green">当前设备</Tag>
          ) : (
            <Button type="link" danger icon={<LoginOutlined />} onClick={() => handleLogoutDevice(record)}>
              退出登录
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title level={4} className={styles.title ?? ''}>设备终端</Title>
        <Space>
          <Button type="primary" danger icon={<LogoutOutlined />} onClick={handleLogoutAll}>
            注销所有设备
          </Button>
        </Space>
      </div>

      <Alert
        message="查看和管理已登录的设备，退出设备将强制该设备重新登录。"
        type="info"
        showIcon
      />

      <Card>
        <Table<Device>
          className={styles.table ?? ''}
          columns={columns}
          dataSource={devices}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
}
