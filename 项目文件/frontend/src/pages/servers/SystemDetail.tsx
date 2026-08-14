import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Breadcrumb,
  Button,
  Card,
  Empty,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useParams, useNavigate } from 'react-router-dom';
import { getServer } from '../../api/servers';
import { getSystem, listSystems, deleteSystem } from '../../api/systems';
import { listServices, deleteService } from '../../api/services';
import { listUsers } from '../../api/users';
import type { ServerRecord } from '../../types/server';
import type { SystemRecord, SystemStatus, SystemEnvironment } from '../../types/system';
import type { ServiceRecord, TargetType, ServiceStatus, ServiceProtocol } from '../../types/service';
import type { User } from '../../types/user';
import SystemForm from './SystemForm';
import ServiceForm from './ServiceForm';
import styles from './SystemDetail.module.css';

const { Title, Text } = Typography;

const SYSTEM_STATUS_MAP: Record<SystemStatus, { color: string; text: string }> = {
  running: { color: 'success', text: '运行中' },
  stopped: { color: 'default', text: '已停止' },
  paused: { color: 'warning', text: '已暂停' },
  error: { color: 'error', text: '错误' },
};

const ENVIRONMENT_MAP: Record<SystemEnvironment, { color: string; text: string }> = {
  production: { color: 'red', text: '生产' },
  staging: { color: 'orange', text: '预发布' },
  development: { color: 'blue', text: '开发' },
  testing: { color: 'purple', text: '测试' },
};

const SERVICE_STATUS_MAP: Record<ServiceStatus, { color: string; text: string }> = {
  running: { color: 'success', text: '运行中' },
  stopped: { color: 'default', text: '已停止' },
  error: { color: 'error', text: '异常' },
};

const TARGET_TYPE_MAP: Record<TargetType, string> = {
  DEVICE: '设备',
  PERSONNEL: '人员',
  ORGANIZATION: '组织',
};

const PROTOCOL_MAP: Record<ServiceProtocol, string> = {
  tcp: 'TCP',
  udp: 'UDP',
  http: 'HTTP',
  https: 'HTTPS',
};

export default function SystemDetail() {
  const { serverId, systemId } = useParams<{ serverId: string; systemId: string }>();
  const navigate = useNavigate();

  // 数据状态
  const [server, setServer] = useState<ServerRecord | null>(null);
  const [system, setSystem] = useState<SystemRecord | null>(null);
  const [vmSystems, setVmSystems] = useState<SystemRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [vmLoading, setVmLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);

  // 弹窗状态
  const [systemFormVisible, setSystemFormVisible] = useState(false);
  const [systemFormMode, setSystemFormMode] = useState<'create' | 'edit'>('create');
  const [editingSystem, setEditingSystem] = useState<SystemRecord | null>(null);
  const [serviceFormVisible, setServiceFormVisible] = useState(false);
  const [serviceFormMode, setServiceFormMode] = useState<'create' | 'edit'>('create');
  const [editingService, setEditingService] = useState<ServiceRecord | null>(null);

  // 维护人员 id → 昵称映射
  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => {
      map.set(u.id, u.nickname || u.username);
    });
    return map;
  }, [users]);

  // 当前系统是否为深度 1 的虚拟机（parent_system_id 非空，API 层已归一化到 is_vm）
  const isVm = system?.is_vm ?? false;

  const fetchServer = useCallback(async () => {
    if (!serverId) return;
    try {
      const res = await getServer(serverId);
      if (res.code === 0) {
        setServer(res.data);
      } else {
        message.error(res.msg || '获取服务器详情失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取服务器详情失败';
      message.error(msg);
    }
  }, [serverId]);

  const fetchSystem = useCallback(async () => {
    if (!systemId) return;
    try {
      const res = await getSystem(systemId);
      if (res.code === 0) {
        setSystem(res.data);
      } else {
        message.error(res.msg || '获取系统详情失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取系统详情失败';
      message.error(msg);
    }
  }, [systemId]);

  const fetchVmSystems = useCallback(async () => {
    if (!serverId || !systemId) return;
    setVmLoading(true);
    try {
      const res = await listSystems({
        server_id: serverId,
        parent_system_id: systemId,
        page: 1,
        page_size: 100,
      });
      if (res.code === 0) {
        setVmSystems(res.data.items);
      } else {
        message.error(res.msg || '获取虚拟机列表失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取虚拟机列表失败';
      message.error(msg);
    } finally {
      setVmLoading(false);
    }
  }, [serverId, systemId]);

  const fetchServices = useCallback(async () => {
    if (!systemId) {
      setServices([]);
      return;
    }
    setServicesLoading(true);
    try {
      const res = await listServices({ system_id: systemId, page: 1, page_size: 100 });
      if (res.code === 0) {
        setServices(res.data.items);
      } else {
        message.error(res.msg || '获取服务列表失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取服务列表失败';
      message.error(msg);
    } finally {
      setServicesLoading(false);
    }
  }, [systemId]);

  // 首次加载：服务器 + 系统详情 + 成员列表
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([fetchServer(), fetchSystem()]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    listUsers({ page: 1, page_size: 100 })
      .then((res) => {
        if (!cancelled && res.code === 0) {
          setUsers(res.data.items);
        }
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchServer, fetchSystem]);

  // 系统就绪后：深度 0 加载 VM 列表，始终加载服务列表
  useEffect(() => {
    if (!system) return;
    fetchServices();
    if (system.is_vm) {
      setVmSystems([]);
      return;
    }
    fetchVmSystems();
  }, [system, fetchServices, fetchVmSystems]);

  // ── 虚拟机操作 ──────────────────────────────────────
  const handleVmCreate = () => {
    setSystemFormMode('create');
    setEditingSystem(null);
    setSystemFormVisible(true);
  };

  const handleVmEdit = (record: SystemRecord) => {
    setSystemFormMode('edit');
    setEditingSystem(record);
    setSystemFormVisible(true);
  };

  const handleVmDelete = (record: SystemRecord) => {
    Modal.confirm({
      title: '确认删除虚拟机',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除虚拟机「${record.name}」吗？该虚拟机下的所有服务将一并删除，此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteSystem(record.id);
          if (res.code === 0) {
            message.success('虚拟机已删除');
            fetchVmSystems();
          } else {
            message.error(res.msg || '删除失败');
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '删除失败';
          message.error(msg);
        }
      },
    });
  };

  const handleSystemFormClose = () => {
    setSystemFormVisible(false);
    setEditingSystem(null);
  };

  const handleSystemFormSuccess = () => {
    setSystemFormVisible(false);
    setEditingSystem(null);
    fetchVmSystems();
  };

  // ── 服务操作 ────────────────────────────────────────
  const handleServiceCreate = () => {
    setServiceFormMode('create');
    setEditingService(null);
    setServiceFormVisible(true);
  };

  const handleServiceEdit = (record: ServiceRecord) => {
    setServiceFormMode('edit');
    setEditingService(record);
    setServiceFormVisible(true);
  };

  const handleServiceDelete = (record: ServiceRecord) => {
    Modal.confirm({
      title: '确认删除服务',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除服务「${record.name}」吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteService(record.id);
          if (res.code === 0) {
            message.success('服务已删除');
            fetchServices();
          } else {
            message.error(res.msg || '删除失败');
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '删除失败';
          message.error(msg);
        }
      },
    });
  };

  const handleServiceFormClose = () => {
    setServiceFormVisible(false);
    setEditingService(null);
  };

  const handleServiceFormSuccess = () => {
    setServiceFormVisible(false);
    setEditingService(null);
    fetchServices();
  };

  // ── 服务列表列定义 ──────────────────────────────────
  const serviceColumns: ColumnsType<ServiceRecord> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      ellipsis: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string | null) => desc || '-',
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      key: 'protocol',
      width: 80,
      render: (protocol: ServiceProtocol | null) =>
        protocol ? (PROTOCOL_MAP[protocol] ?? protocol) : '-',
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port',
      width: 80,
      render: (port: number | null) => port ?? '-',
    },
    {
      title: '服务目标',
      key: 'target',
      width: 180,
      ellipsis: true,
      render: (_: unknown, record: ServiceRecord) => {
        if (!record.target_type) return '-';
        const typeText = TARGET_TYPE_MAP[record.target_type] ?? record.target_type;
        return record.target_name ? `${typeText} · ${record.target_name}` : typeText;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: ServiceStatus) => (
        <Tag color={(SERVICE_STATUS_MAP[status] ?? { color: 'default', text: status }).color}>
          {SERVICE_STATUS_MAP[status]?.text ?? status}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, record: ServiceRecord) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              aria-label="编辑服务"
              onClick={() => handleServiceEdit(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label="删除服务"
              onClick={() => handleServiceDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ── 系统信息卡 ──────────────────────────────────────
  const renderInfoCard = () => {
    if (!system) return null;
    const statusCfg = SYSTEM_STATUS_MAP[system.status] ?? { color: 'default', text: system.status };
    const envCfg = ENVIRONMENT_MAP[system.environment] ?? { color: 'default', text: system.environment };
    const osText = [system.os_type, system.os_version].filter(Boolean).join(' ') || '-';
    const resourceText = [
      system.cpu_allocated != null ? `CPU ${system.cpu_allocated} 核` : null,
      system.ram_allocated != null ? `内存 ${system.ram_allocated} GB` : null,
      system.disk_allocated != null ? `磁盘 ${system.disk_allocated} GB` : null,
    ]
      .filter(Boolean)
      .join(' · ') || '-';
    return (
      <div className={styles.infoCard}>
        <div className={styles.infoHeader}>
          <div className={styles.infoHeaderLeft}>
            <Breadcrumb
              className={styles.breadcrumb ?? ''}
              items={[
                { title: '服务器管理' },
                { title: server?.name ?? '服务器' },
                { title: system.name },
              ]}
            />
            <Space align="center" size="middle" wrap>
              <Title level={4} className={styles.title ?? ''}>
                {system.name}
              </Title>
              {isVm && <Tag color="purple">虚拟机</Tag>}
              <Tag color={statusCfg.color}>{statusCfg.text}</Tag>
              <Tag color={envCfg.color}>{envCfg.text}</Tag>
            </Space>
          </div>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/servers')}>
            返回列表
          </Button>
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <Text className={styles.infoLabel ?? ''}>描述</Text>
            <Text className={styles.infoValue ?? ''}>{system.description || '-'}</Text>
          </div>
          <div className={styles.infoItem}>
            <Text className={styles.infoLabel ?? ''}>IP</Text>
            <Text className={styles.infoValue ?? ''}>{system.ip || '-'}</Text>
          </div>
          <div className={styles.infoItem}>
            <Text className={styles.infoLabel ?? ''}>操作系统</Text>
            <Text className={styles.infoValue ?? ''}>{osText}</Text>
          </div>
          <div className={styles.infoItem}>
            <Text className={styles.infoLabel ?? ''}>资源分配</Text>
            <Text className={styles.infoValue ?? ''}>{resourceText}</Text>
          </div>
          <div className={styles.infoItem}>
            <Text className={styles.infoLabel ?? ''}>维护人员</Text>
            <span className={styles.infoValue}>
              {system.maintainer_ids.length > 0 ? (
                <Space size={[4, 4]} wrap>
                  {system.maintainer_ids.map((uid) => (
                    <Tag key={uid} className={styles.maintainerTag ?? ''}>
                      {userNameMap.get(uid) ?? '未知成员'}
                    </Tag>
                  ))}
                </Space>
              ) : (
                '-'
              )}
            </span>
          </div>
          <div className={styles.infoItem}>
            <Text className={styles.infoLabel ?? ''}>标签</Text>
            {system.tags.length > 0 ? (
              <span className={styles.tagsWrap}>
                {system.tags.map((tag) => (
                  <Tag key={tag} color="blue">
                    {tag}
                  </Tag>
                ))}
              </span>
            ) : (
              <Text className={styles.infoValue ?? ''}>-</Text>
            )}
          </div>
          <div className={styles.infoItem}>
            <Text className={styles.infoLabel ?? ''}>备注</Text>
            <Text className={styles.infoValue ?? ''}>{system.notes || '-'}</Text>
          </div>
        </div>
      </div>
    );
  };

  // ── 虚拟机卡片网格（仅深度 0 显示） ─────────────────
  const renderVmSection = () => {
    if (!system || system.is_vm) return null;
    return (
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <Title level={5} className={styles.sectionTitle ?? ''}>
            虚拟机列表
          </Title>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleVmCreate}>
            新增虚拟机
          </Button>
        </div>
        <Spin spinning={vmLoading}>
          {vmSystems.length === 0 ? (
            <Empty description="暂无虚拟机" />
          ) : (
            <div className={styles.systemCardGrid}>
              {vmSystems.map((vm) => (
                <Card
                  key={vm.id}
                  hoverable
                  className={styles.systemCard ?? ''}
                  onClick={() => navigate(`/servers/${serverId ?? ''}/systems/${vm.id}`)}
                  actions={[
                    <Button
                      key="edit"
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVmEdit(vm);
                      }}
                    >
                      编辑
                    </Button>,
                    <Button
                      key="delete"
                      type="link"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVmDelete(vm);
                      }}
                    >
                      删除
                    </Button>,
                  ]}
                >
                  <Card.Meta title={vm.name} description={vm.description || '暂无描述'} />
                </Card>
              ))}
            </div>
          )}
        </Spin>
      </div>
    );
  };

  // ── 服务列表区域 ────────────────────────────────────
  const renderServicesSection = () => (
    <div className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <Title level={5} className={styles.sectionTitle ?? ''}>
          服务列表
        </Title>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleServiceCreate}>
          新增服务
        </Button>
      </div>
      <Table<ServiceRecord>
        className={styles.table ?? ''}
        rowKey="id"
        columns={serviceColumns}
        dataSource={services}
        loading={servicesLoading}
        pagination={false}
        locale={{ emptyText: <Empty description="该系统下暂无服务" /> }}
      />
    </div>
  );

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <Spin size="large" />
      </div>
    );
  }

  if (!system) {
    return (
      <div className={styles.container}>
        <Empty description="系统不存在或已被删除">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/servers')}>
            返回列表
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {renderInfoCard()}
      {renderVmSection()}
      {renderServicesSection()}

      <SystemForm
        visible={systemFormVisible}
        mode={systemFormMode}
        record={editingSystem}
        serverId={serverId ?? ''}
        {...(systemFormMode === 'create' && system ? { parentSystemId: system.id } : {})}
        onClose={handleSystemFormClose}
        onSuccess={handleSystemFormSuccess}
      />

      <ServiceForm
        visible={serviceFormVisible}
        mode={serviceFormMode}
        record={editingService}
        systemId={systemId ?? ''}
        onClose={handleServiceFormClose}
        onSuccess={handleServiceFormSuccess}
      />
    </div>
  );
}
