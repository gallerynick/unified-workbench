import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Collapse, Space, Tag, Typography, message, Alert, Modal, List } from 'antd';
import {
  DesktopOutlined,
  MobileOutlined,
  TabletOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
  CaretRightOutlined,
} from '@ant-design/icons';
import { request } from '../../utils/request';
import { clearTokens } from '../../utils/auth';
import { getDeviceToken } from '../../utils/device';
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

const getIcon = (t: string | null) => DEVICE_ICONS[t ?? ''] ?? <QuestionCircleOutlined />;

export default function DevicesPage() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [sessions, setSessions] = useState<Record<string, SessionRecord[]>>({});
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await request<DeviceRecord[]>('/me/devices');
      if (res.code === 0 && res.data) setDevices(res.data);
      else message.error(res.msg || '获取设备列表失败');
    } catch { message.error('获取设备列表失败'); }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const onCollapseChange = async (key: string | string[]) => {
    const token = Array.isArray(key) ? key[0] : key;
    if (!token || sessions[token]) return;
    try {
      const res = await request<SessionRecord[]>(`/me/devices/${encodeURIComponent(token)}/sessions`);
      if (res.code === 0) setSessions((s) => ({ ...s, [token]: (res.data as SessionRecord[]) ?? [] }));
    } catch { /* ignore */ }
  };

  const handleLogout = (device: DeviceRecord) => {
    Modal.confirm({
      title: '注销设备',
      content: `注销后该设备上的 ${device.session_count} 个会话将全部下线。`,
      okText: '注销',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        setRevoking(device.device_token);
        try {
          const res = await request<{ affected_count: number }>(
            `/me/devices/${encodeURIComponent(device.device_token)}`, { method: 'DELETE' }
          );
          if (res.code === 0) {
            message.success(`已注销 ${res.data?.affected_count ?? device.session_count} 个会话`);
            setSessions((s) => { const n = { ...s }; delete n[device.device_token]; return n; });
            if (device.device_token === getDeviceToken()) {
              clearTokens();
              navigate('/login', { replace: true });
              return;
            }
            await fetchDevices();
          } else { message.error(res.msg || '操作失败'); }
        } catch { message.error('操作失败'); }
        finally { setRevoking(null); }
      },
    });
  };

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>设备终端</Title>
        <Button danger icon={<LogoutOutlined />} disabled={devices.length === 0}
          onClick={() => {
            Modal.confirm({
              title: '注销所有设备',
              content: '所有设备上的全部登录会话将下线，包括当前设备。',
              okText: '注销',
              cancelText: '取消',
              okButtonProps: { danger: true },
              onOk: async () => {
                setRevoking('__all__');
                try {
                  for (const d of devices) {
                    if (!d.device_token) continue;
                    try { await request(`/me/devices/${encodeURIComponent(d.device_token)}`, { method: 'DELETE' }); } catch { /* ignore */ }
                  }
                  setSessions({});
                  clearTokens();
                  navigate('/login', { replace: true });
                } catch { message.error('操作失败'); }
                finally { setRevoking(null); }
              },
            });
          }}
        >注销所有设备</Button>
      </div>
      <Alert message="按设备分组展示登录记录，点击设备可展开查看最近的登录历史。" type="info" showIcon style={{ marginBottom: 16 }} />
      <Collapse
        accordion
        expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
        onChange={(key) => { void onCollapseChange(key); }}
        items={devices.map((d) => ({
          key: d.device_token,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <Space>
                {getIcon(d.device_type)}
                <span style={{ fontWeight: 600 }}>{d.device_name || '未知设备'}</span>
                <Text type="secondary">
                  {d.device_type ? (DEVICE_LABELS[d.device_type] || d.device_type) : ''}
                  {d.ip_address ? ` · ${d.ip_address}` : ''}
                </Text>
              </Space>
              <Space size="middle">
                <Tag>{d.session_count} 次登录</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(d.last_active_at).toLocaleString('zh-CN')}
                </Text>
                {d.device_token ? (
                  <Button type="link" danger size="small" icon={<LogoutOutlined />}
                    loading={revoking === d.device_token}
                    onClick={(e) => { e.stopPropagation(); handleLogout(d); }}
                  >注销</Button>
                ) : null}
              </Space>
            </div>
          ),
          children: sessions[d.device_token] ? (
            <List size="small" dataSource={sessions[d.device_token] ?? []}
              renderItem={(s, i) => (
                <List.Item style={{ paddingLeft: 36 }}>
                  <Text>登录 {i + 1}</Text>
                  <Text type="secondary">{new Date(s.created_at).toLocaleString('zh-CN')}</Text>
                </List.Item>
              )}
            />
          ) : (
            <Text type="secondary" style={{ paddingLeft: 36 }}>加载中...</Text>
          ),
        }))}
      />
    </div>
  );
}
