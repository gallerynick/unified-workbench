import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Typography, message, Space, Tag, Alert, Modal, Result } from 'antd';
import { DesktopOutlined, MobileOutlined, TabletOutlined, DeleteOutlined, LogoutOutlined, LockOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { clearTokens, isAdmin } from '../../utils/auth';
import styles from './DeviceManagement.module.css';

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

export default function DeviceManagement() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDevices();
  }, []);

  if (!isAdmin()) {
    return <Result status="403" title="权限不足" subTitle="只有管理员可以管理设备" icon={<LockOutlined />} />;
  }

  const fetchDevices = async () => {
    setLoading(true);
    // Mock data for now - in production, this would call a backend API
    const mockDevices: Device[] = [
      {
        id: '1',
        device_type: 'desktop',
        browser: 'Chrome 120',
        os: 'macOS 14.2',
        ip: '192.168.1.100',
        last_active: new Date().toISOString(),
        is_current: true,
      },
    ];
    setDevices(mockDevices);
    setLoading(false);
  };

  const handleRevoke = (device: Device) => {
    if (device.is_current) {
      message.warning('不能撤销当前设备');
      return;
    }
    // In production, this would call a backend API
    message.success('设备已撤销');
    fetchDevices();
  };

  const handleLogout = () => {
    Modal.confirm({
      title: '退出登录',
      content: '确定要退出当前设备的登录吗？退出后需要重新输入密码登录。',
      okText: '确定退出',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        clearTokens();
        message.success('已退出登录');
        navigate('/login', { replace: true });
      },
    });
  };

  const columns: ColumnsType<Device> = [
    {
      title: '设备',
      key: 'device',
      render: (_, record) => (
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
      title: 'IP 地址',
      dataIndex: 'ip',
      key: 'ip',
    },
    {
      title: '最后活跃',
      dataIndex: 'last_active',
      key: 'last_active',
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => (
        record.is_current ? (
          <Tag color="green">当前设备</Tag>
        ) : (
          <Tag color="default">其他设备</Tag>
        )
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        record.is_current ? (
          <Button
            type="link"
            danger
            icon={<LogoutOutlined />}
            onClick={handleLogout}
          >
            退出登录
          </Button>
        ) : (
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleRevoke(record)}
          >
            撤销
          </Button>
        )
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1000 }}>
      <Title level={4} className={styles.title ?? ''}>设备管理</Title>
      <Alert
        message="设备管理"
        description="查看和管理已登录的设备。撤销设备将强制该设备重新登录。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card>
        <Table<Device>
          columns={columns}
          dataSource={devices}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  );
}
