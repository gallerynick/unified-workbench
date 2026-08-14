import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Breadcrumb,
  Button,
  Card,
  Empty,
  Modal,
  Space,
  Spin,
  Tag,
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
import { useParams, useNavigate } from 'react-router-dom';
import { getServer } from '../../api/servers';
import { listSystems, deleteSystem } from '../../api/systems';
import { listUsers } from '../../api/users';
import type { ServerRecord, ServerStatus } from '../../types/server';
import type { SystemRecord } from '../../types/system';
import type { User } from '../../types/user';
import SystemForm from './SystemForm';
import ServerFormModal from './ServerFormModal';
import styles from './ServerSystemsPage.module.css';

const { Title, Text } = Typography;

const SERVER_STATUS_MAP: Record<ServerStatus, { color: string; text: string }> = {
  active: { color: 'success', text: '运行中' },
  maintenance: { color: 'warning', text: '维护中' },
  retired: { color: 'default', text: '已退役' },
};

export default function ServerSystemsPage() {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();

  // 数据状态
  const [server, setServer] = useState<ServerRecord | null>(null);
  const [systems, setSystems] = useState<SystemRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemsLoading, setSystemsLoading] = useState(false);

  // 弹窗状态
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingSystem, setEditingSystem] = useState<SystemRecord | null>(null);
  const [editServerVisible, setEditServerVisible] = useState(false);

  // 维护人员 id → 昵称映射
  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => {
      map.set(u.id, u.nickname || u.username);
    });
    return map;
  }, [users]);

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

  const fetchSystems = useCallback(async () => {
    if (!serverId) return;
    setSystemsLoading(true);
    try {
      const res = await listSystems({ server_id: serverId, page: 1, page_size: 100 });
      if (res.code === 0) {
        // 仅展示顶层系统：后端按 parent_system_id 过滤，前端再用 is_vm 兜底
        setSystems(res.data.items.filter((sys) => !sys.is_vm));
      } else {
        message.error(res.msg || '获取系统列表失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取系统列表失败';
      message.error(msg);
    } finally {
      setSystemsLoading(false);
    }
  }, [serverId]);

  // 首次加载：服务器信息 + 顶层系统列表 + 成员列表
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchServer();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    fetchSystems();
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

  // ── 系统操作 ───────────────────────────────────────
  const handleCreate = () => {
    setFormMode('create');
    setEditingSystem(null);
    setFormVisible(true);
  };

  const handleEdit = (record: SystemRecord) => {
    setFormMode('edit');
    setEditingSystem(record);
    setFormVisible(true);
  };

  const handleDelete = (record: SystemRecord) => {
    Modal.confirm({
      title: '确认删除系统',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除系统「${record.name}」吗？该系统下的所有服务将一并删除，此操作不可恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
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

  const handleFormClose = () => {
    setFormVisible(false);
    setEditingSystem(null);
  };

  const handleFormSuccess = () => {
    setFormVisible(false);
    setEditingSystem(null);
    fetchSystems();
  };

  // ── 服务器信息卡 ───────────────────────────────────
  const renderServerInfoCard = () => {
    if (!server) return null;
    const statusCfg = SERVER_STATUS_MAP[server.status] ?? { color: 'default', text: server.status };
    const hardwareText = [
      server.cpu_cores != null ? `CPU ${server.cpu_cores} 核` : null,
      server.ram_capacity != null
        ? `内存 ${server.ram_capacity} ${server.ram_unit ?? 'GB'}`
        : null,
      server.disk_capacity != null
        ? `磁盘 ${server.disk_capacity} ${server.disk_unit ?? 'GB'}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ') || '-';
    return (
      <div className={styles.infoCard}>
        <div className={styles.infoHeader}>
          <div className={styles.infoHeaderLeft}>
            <Breadcrumb
              className={styles.breadcrumb ?? ''}
              items={[{ title: '服务器管理' }, { title: server.name }]}
            />
            <Space align="center" size="middle" wrap>
              <Title level={4} className={styles.title ?? ''}>
                {server.name}
              </Title>
              <Tag color={statusCfg.color}>{statusCfg.text}</Tag>
            </Space>
          </div>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/servers')}>
              返回列表
            </Button>
            <Button icon={<EditOutlined />} onClick={() => setEditServerVisible(true)}>
              编辑服务器
            </Button>
          </Space>
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
            <Text className={styles.infoLabel ?? ''}>IP</Text>
            <Text className={styles.infoValue ?? ''}>{server.ip || '-'}</Text>
          </div>
          <div className={styles.infoItem}>
            <Text className={styles.infoLabel ?? ''}>主机名</Text>
            <Text className={styles.infoValue ?? ''}>{server.hostname || '-'}</Text>
          </div>
          <div className={styles.infoItem}>
            <Text className={styles.infoLabel ?? ''}>操作系统</Text>
            <Text className={styles.infoValue ?? ''}>{server.os || '-'}</Text>
          </div>
          <div className={styles.infoItem}>
            <Text className={styles.infoLabel ?? ''}>硬件资源</Text>
            <Text className={styles.infoValue ?? ''}>{hardwareText}</Text>
          </div>
          <div className={styles.infoItem}>
            <Text className={styles.infoLabel ?? ''}>型号</Text>
            <Text className={styles.infoValue ?? ''}>{server.model || '-'}</Text>
          </div>
          <div className={styles.infoItem}>
            <Text className={styles.infoLabel ?? ''}>序列号</Text>
            <Text className={styles.infoValue ?? ''}>{server.serial_number || '-'}</Text>
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
            <Text className={styles.infoLabel ?? ''}>标签</Text>
            {server.tags.length > 0 ? (
              <span className={styles.tagsWrap}>
                {server.tags.map((tag) => (
                  <Tag key={tag} color="blue">
                    {tag}
                  </Tag>
                ))}
              </span>
            ) : (
              <Text className={styles.infoValue ?? ''}>-</Text>
            )}
          </div>
          <div className={`${styles.infoItem} ${styles.infoItemFull}`}>
            <Text className={styles.infoLabel ?? ''}>备注</Text>
            <Text className={styles.infoValue ?? ''}>{server.notes || '-'}</Text>
          </div>
        </div>
      </div>
    );
  };

  // ── 顶层系统列表 ───────────────────────────────────
  const renderSystemsSection = () => (
    <div className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <Title level={5} className={styles.sectionTitle ?? ''}>
          系统列表
        </Title>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCreate}>
          新增系统
        </Button>
      </div>
      <Spin spinning={systemsLoading}>
        {systems.length === 0 ? (
          <Empty description="暂无系统，点击右上角新增" />
        ) : (
          <div className={styles.systemCardGrid}>
            {systems.map((sys) => (
              <Card
                key={sys.id}
                hoverable
                className={styles.systemCard ?? ''}
                onClick={() => navigate(`/servers/${serverId ?? ''}/systems/${sys.id}`)}
                actions={[
                  <Button
                    key="edit"
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(sys);
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
                      handleDelete(sys);
                    }}
                  >
                    删除
                  </Button>,
                ]}
              >
                <Card.Meta title={sys.name} description={sys.description || '暂无描述'} />
              </Card>
            ))}
          </div>
        )}
      </Spin>
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
      {renderServerInfoCard()}
      {renderSystemsSection()}

      <SystemForm
        visible={formVisible}
        mode={formMode}
        record={editingSystem}
        serverId={serverId ?? ''}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
      />

      <ServerFormModal
        visible={editServerVisible}
        mode="edit"
        record={server}
        onClose={() => setEditServerVisible(false)}
        onSuccess={() => {
          setEditServerVisible(false);
          fetchServer();
        }}
      />
    </div>
  );
}
