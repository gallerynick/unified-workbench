import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Empty,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Tree,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';
import { useParams, useNavigate } from 'react-router-dom';
import { getServer, getServerSystems, updateServerDeployStatus } from '../../api/servers';
import { listServices, deleteService } from '../../api/services';
import { deleteSystem } from '../../api/systems';
import { listUsers } from '../../api/users';
import type { ServerRecord, DeployStatus, ServerType, ServerStatus } from '../../types/server';
import type { SystemRecord } from '../../types/system';
import type { ServiceRecord, TargetType } from '../../types/service';
import type { User } from '../../types/user';
import SystemForm from './SystemForm';
import ServiceForm from './ServiceForm';
import styles from './ServerDetail.module.css';

const { Title, Text, Paragraph } = Typography;

const STATUS_MAP: Record<ServerStatus, { color: string; text: string }> = {
  active: { color: 'success', text: '运行中' },
  maintenance: { color: 'warning', text: '维护中' },
  retired: { color: 'default', text: '已退役' },
};

const SERVER_TYPE_MAP: Record<ServerType, { color: string; text: string }> = {
  SINGLE: { color: 'blue', text: '单系统' },
  MULTI: { color: 'purple', text: '多系统' },
};

const DEPLOY_STATUS_MAP: Record<DeployStatus, { color: string; text: string }> = {
  NORMAL: { color: 'success', text: '正常' },
  PENDING_REDEPLOY: { color: 'error', text: '待重新部署' },
  REDEPLOYING: { color: 'processing', text: '重新部署中' },
};

const TARGET_TYPE_MAP: Record<TargetType, string> = {
  DEVICE: '设备',
  PERSONNEL: '人员',
  ORGANIZATION: '组织',
};

export default function ServerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // 数据状态
  const [server, setServer] = useState<ServerRecord | null>(null);
  const [systems, setSystems] = useState<SystemRecord[]>([]);
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [deployUpdating, setDeployUpdating] = useState(false);

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

  // 当前生效的系统：单系统固定取默认系统，多系统取树选中项
  const activeSystemId = useMemo(() => {
    if (!server) return null;
    if (server.server_type === 'SINGLE') return systems[0]?.id ?? null;
    return selectedSystemId;
  }, [server, systems, selectedSystemId]);

  const fetchServer = useCallback(async () => {
    if (!id) return;
    try {
      const res = await getServer(id);
      if (res.code === 0) {
        setServer(res.data);
      } else {
        message.error(res.msg || '获取服务器详情失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取服务器详情失败';
      message.error(msg);
    }
  }, [id]);

  const fetchSystems = useCallback(async () => {
    if (!id) return;
    try {
      const res = await getServerSystems(id);
      if (res.code === 0) {
        setSystems(res.data.items);
      } else {
        message.error(res.msg || '获取系统列表失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取系统列表失败';
      message.error(msg);
    }
  }, [id]);

  const fetchServices = useCallback(async () => {
    if (!activeSystemId) {
      setServices([]);
      return;
    }
    setServicesLoading(true);
    try {
      const res = await listServices({ system_id: activeSystemId, page: 1, page_size: 100 });
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
  }, [activeSystemId]);

  // 首次加载：服务器详情 + 系统列表 + 成员列表
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([fetchServer(), fetchSystems()]);
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
  }, [fetchServer, fetchSystems]);

  // 多系统模式下，选中系统失效或未选中时默认选中第一个
  useEffect(() => {
    if (server?.server_type !== 'MULTI') return;
    if (systems.length === 0) {
      setSelectedSystemId(null);
      return;
    }
    if (!selectedSystemId || !systems.some((s) => s.id === selectedSystemId)) {
      setSelectedSystemId(systems[0]?.id ?? null);
    }
  }, [server?.server_type, systems, selectedSystemId]);

  // 服务列表随当前系统变化
  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // ── deploy_status 状态机操作 ─────────────────────────
  const handleDeployStatus = async (deployStatus: DeployStatus) => {
    if (!id) return;
    setDeployUpdating(true);
    try {
      const res = await updateServerDeployStatus(id, deployStatus);
      if (res.code === 0) {
        message.success('部署状态已更新');
        fetchServer();
      } else {
        message.error(res.msg || '更新部署状态失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '更新部署状态失败';
      message.error(msg);
    } finally {
      setDeployUpdating(false);
    }
  };

  // ── 系统操作 ────────────────────────────────────────
  const handleSystemCreate = () => {
    setSystemFormMode('create');
    setEditingSystem(null);
    setSystemFormVisible(true);
  };

  const handleSystemEdit = (record: SystemRecord) => {
    setSystemFormMode('edit');
    setEditingSystem(record);
    setSystemFormVisible(true);
  };

  const handleSystemDelete = (record: SystemRecord) => {
    Modal.confirm({
      title: '确认删除系统',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除系统「${record.name}」吗？该系统下的所有服务将一并删除，此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteSystem(record.id);
          if (res.code === 0) {
            message.success('系统已删除');
            fetchSystems();
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
    fetchSystems();
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

  // ── 系统树节点渲染（多系统模式） ─────────────────────
  const renderSystemTitle = (system: SystemRecord): React.ReactNode => (
    <span className={styles.treeNode}>
      <span className={styles.treeNodeTitle}>
        <FolderOutlined style={{ marginRight: 'var(--spacing-xs)', color: 'var(--text-secondary)' }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {system.name}
        </span>
      </span>
      <span className={styles.treeNodeActions}>
        <Tooltip title="编辑系统">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined style={{ fontSize: 'var(--text-body-xs-size)' }} />}
            aria-label="编辑系统"
            onClick={(e) => {
              e.stopPropagation();
              handleSystemEdit(system);
            }}
          />
        </Tooltip>
        <Tooltip title="删除系统">
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined style={{ fontSize: 'var(--text-body-xs-size)' }} />}
            aria-label="删除系统"
            onClick={(e) => {
              e.stopPropagation();
              handleSystemDelete(system);
            }}
          />
        </Tooltip>
      </span>
    </span>
  );

  const treeData: DataNode[] = systems.map((s) => ({
    key: s.id,
    title: renderSystemTitle(s),
    isLeaf: true,
  }));

  // ── 服务列表列定义 ──────────────────────────────────
  const serviceColumns: ColumnsType<ServiceRecord> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
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
      title: '服务目标',
      key: 'target',
      width: 200,
      ellipsis: true,
      render: (_: unknown, record: ServiceRecord) => {
        if (!record.target_type) return '-';
        const typeText = TARGET_TYPE_MAP[record.target_type] ?? record.target_type;
        return record.target_name ? `${typeText} · ${record.target_name}` : typeText;
      },
    },
    {
      title: '维护人员',
      key: 'maintainer_count',
      width: 90,
      render: (_: unknown, record: ServiceRecord) => record.maintainer_ids.length,
    },
    {
      title: '操作',
      key: 'action',
      width: 130,
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

  // ── 顶部信息卡 ──────────────────────────────────────
  const renderInfoCard = () => {
    if (!server) return null;
    const deployStatus = (server.deploy_status || 'NORMAL') as DeployStatus;
    const deployCfg = DEPLOY_STATUS_MAP[deployStatus] ?? { color: 'default', text: deployStatus };
    return (
      <div className={styles.infoCard}>
        <div className={styles.infoHeader}>
          <Space align="center" size="middle">
            <Title level={4} className={styles.title ?? ''}>
              {server.name}
            </Title>
            <Tag color={(STATUS_MAP[server.status] ?? { color: 'default' }).color}>
              {STATUS_MAP[server.status]?.text ?? server.status}
            </Tag>
            <Tag color={SERVER_TYPE_MAP[server.server_type]?.color}>{SERVER_TYPE_MAP[server.server_type]?.text}</Tag>
            <Tag color={deployCfg.color}>{deployCfg.text}</Tag>
          </Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/servers')}>
            返回列表
          </Button>
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <Text className={styles.infoLabel ?? ''}>用途</Text>
            <Text className={styles.infoValue ?? ''}>{server.purpose || '-'}</Text>
          </div>
          <div className={styles.infoItem}>
            <Text className={styles.infoLabel ?? ''}>位置</Text>
            <Text className={styles.infoValue ?? ''}>{server.location || '-'}</Text>
          </div>
          <div className={styles.infoItem}>
            <Text className={styles.infoLabel ?? ''}>IP:端口</Text>
            <Text className={styles.infoValue ?? ''}>
              {server.ip ? (server.port ? `${server.ip}:${server.port}` : server.ip) : '-'}
            </Text>
          </div>
          <div className={styles.infoItem}>
            <Text className={styles.infoLabel ?? ''}>维护人员</Text>
            <span className={styles.infoValue}>
              {server.maintainer_ids.length > 0 ? (
                <Space size={[4, 4]} wrap>
                  {server.maintainer_ids.map((uid) => (
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
            <Text className={styles.infoLabel ?? ''}>描述</Text>
            <Text className={styles.infoValue ?? ''}>{server.description || '-'}</Text>
          </div>
          <div className={styles.infoItem}>
            <Text className={styles.infoLabel ?? ''}>备注</Text>
            <Text className={styles.infoValue ?? ''}>{server.notes || '-'}</Text>
          </div>
        </div>

        {deployStatus === 'PENDING_REDEPLOY' && (
          <div className={styles.deployBanner}>
            <ExclamationCircleOutlined className={styles.deployBannerIcon} />
            <div className={styles.deployBannerText}>
              <Text strong>该服务器类型已变更，等待重新部署。</Text>
              <Paragraph type="secondary" className={styles.deployBannerHint ?? ''}>
                重新部署完成后请标记状态，服务器将恢复正常。
              </Paragraph>
            </div>
            <Space wrap>
              <Button
                type="primary"
                loading={deployUpdating}
                onClick={() => handleDeployStatus('REDEPLOYING')}
              >
                标记为重新部署中
              </Button>
              <Button loading={deployUpdating} onClick={() => handleDeployStatus('NORMAL')}>
                标记为已重新部署
              </Button>
            </Space>
          </div>
        )}

        {deployStatus === 'REDEPLOYING' && (
          <div className={styles.deployBanner}>
            <ExclamationCircleOutlined className={styles.deployBannerIcon} />
            <div className={styles.deployBannerText}>
              <Text strong>正在重新部署…</Text>
              <Paragraph type="secondary" className={styles.deployBannerHint ?? ''}>
                部署完成后请标记状态，服务器将恢复正常。
              </Paragraph>
            </div>
            <Button loading={deployUpdating} onClick={() => handleDeployStatus('NORMAL')}>
              标记为已重新部署
            </Button>
          </div>
        )}
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
        <Button type="primary" icon={<PlusOutlined />} onClick={handleServiceCreate} disabled={!activeSystemId}>
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
        locale={{
          emptyText: activeSystemId ? (
            <Empty description="该系统下暂无服务" />
          ) : (
            <Empty description="请先选择系统" />
          ),
        }}
      />
    </div>
  );

  // ── 单系统模式：系统设置 + 服务列表 ─────────────────
  const renderSingleSystem = () => {
    const system = systems[0];
    return (
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <Title level={5} className={styles.sectionTitle ?? ''}>
            系统设置
          </Title>
          {system && (
            <Button icon={<EditOutlined />} onClick={() => handleSystemEdit(system)}>
              编辑系统
            </Button>
          )}
        </div>
        {system ? (
          <div className={styles.systemInfo}>
            <div className={styles.infoItem}>
              <Text className={styles.infoLabel ?? ''}>系统名称</Text>
              <Text className={styles.infoValue ?? ''}>{system.name}</Text>
            </div>
            <div className={styles.infoItem}>
              <Text className={styles.infoLabel ?? ''}>系统描述</Text>
              <Text className={styles.infoValue ?? ''}>{system.description || '-'}</Text>
            </div>
          </div>
        ) : (
          <Empty description="暂无系统" />
        )}
      </div>
    );
  };

  // ── 多系统模式：系统树 + 服务列表 ───────────────────
  const renderMultiSystems = () => (
    <div className={styles.multiRow}>
      <div className={styles.treePanel}>
        <div className={styles.sectionHeader}>
          <Title level={5} className={styles.sectionTitle ?? ''}>
            系统列表
          </Title>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleSystemCreate}>
            新增系统
          </Button>
        </div>
        {systems.length === 0 ? (
          <Empty description="暂无系统" />
        ) : (
          <Tree
            treeData={treeData}
            blockNode
            selectedKeys={selectedSystemId ? [selectedSystemId] : []}
            onSelect={(keys) => {
              if (keys.length > 0) setSelectedSystemId(String(keys[0]));
            }}
            className={styles.systemTree ?? ''}
          />
        )}
      </div>
      <div className={styles.contentPanel}>{renderServicesSection()}</div>
    </div>
  );

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <Spin size="large" />
      </div>
    );
  }

  if (!server) {
    return (
      <div className={styles.container}>
        <Empty description="服务器不存在或已被删除">
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

      {server.server_type === 'SINGLE' ? (
        <>
          {renderSingleSystem()}
          {renderServicesSection()}
        </>
      ) : (
        renderMultiSystems()
      )}

      <SystemForm
        visible={systemFormVisible}
        mode={systemFormMode}
        record={editingSystem}
        serverId={id ?? ''}
        onClose={handleSystemFormClose}
        onSuccess={handleSystemFormSuccess}
      />

      <ServiceForm
        visible={serviceFormVisible}
        mode={serviceFormMode}
        record={editingService}
        systemId={activeSystemId ?? ''}
        onClose={handleServiceFormClose}
        onSuccess={handleServiceFormSuccess}
      />
    </div>
  );
}
