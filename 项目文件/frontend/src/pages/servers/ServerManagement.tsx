import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Typography,
  Modal,
  message,
  Space,
  Tooltip,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { listServers, deleteServer } from '../../api/servers';
import type { ServerRecord, ServerType, DeployStatus, ServerStatus } from '../../types/server';
import ServerFormModal from './ServerFormModal';
import styles from './ServerManagement.module.css';

const { Title } = Typography;

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

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export default function ServerManagement() {
  const navigate = useNavigate();

  // 列表状态
  const [records, setRecords] = useState<ServerRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // 弹窗状态
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingServer, setEditingServer] = useState<ServerRecord | null>(null);

  const fetchServers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listServers({ page, page_size: pageSize, status, search });
      if (res.code === 0) {
        setRecords(res.data.items);
        setTotal(res.data.total);
      } else {
        message.error(res.msg || '获取服务器列表失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取服务器列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status, search]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: string | undefined) => {
    setStatus(value ?? '');
    setPage(1);
  };

  const handleCreate = () => {
    setFormMode('create');
    setEditingServer(null);
    setFormVisible(true);
  };

  const handleEdit = (record: ServerRecord) => {
    setFormMode('edit');
    setEditingServer(record);
    setFormVisible(true);
  };

  const handleDetail = (record: ServerRecord) => {
    navigate(`/servers/${record.id}`);
  };

  const handleDelete = (record: ServerRecord) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除服务器「${record.name}」吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteServer(record.id);
          if (res.code === 0) {
            message.success('服务器已删除');
            fetchServers();
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
    setEditingServer(null);
  };

  const handleFormSuccess = () => {
    setFormVisible(false);
    setEditingServer(null);
    fetchServers();
  };

  const columns: ColumnsType<ServerRecord> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      ellipsis: true,
      render: (name: string, record: ServerRecord) => (
        <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => handleDetail(record)}>
          {name}
        </Button>
      ),
    },
    {
      title: '用途',
      dataIndex: 'purpose',
      key: 'purpose',
      width: 200,
      ellipsis: true,
      render: (purpose: string | null) => purpose || '-',
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
      width: 140,
      ellipsis: true,
      render: (location: string | null) => location || '-',
    },
    {
      title: 'IP:端口',
      key: 'ipPort',
      width: 160,
      ellipsis: true,
      render: (_: unknown, record: ServerRecord) => {
        if (!record.ip) return '-';
        return record.port ? `${record.ip}:${record.port}` : record.ip;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: ServerStatus) => {
        const cfg = STATUS_MAP[value] ?? { color: 'default', text: value };
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '类型',
      dataIndex: 'server_type',
      key: 'server_type',
      width: 100,
      render: (value: ServerType) => {
        const cfg = SERVER_TYPE_MAP[value] ?? { color: 'default', text: value };
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '部署状态',
      dataIndex: 'deploy_status',
      key: 'deploy_status',
      width: 130,
      render: (value: DeployStatus) => {
        const cfg = DEPLOY_STATUS_MAP[value] ?? { color: 'default', text: value };
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '维护人员',
      key: 'maintainer_count',
      width: 100,
      render: (_: unknown, record: ServerRecord) => record.maintainer_ids.length,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: ServerRecord) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} aria-label="编辑" onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="删除">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} aria-label="删除" onClick={() => handleDelete(record)} />
          </Tooltip>
          <Tooltip title="详情">
            <Button type="link" size="small" icon={<EyeOutlined />} aria-label="详情" onClick={() => handleDetail(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title level={4} className={styles.title ?? ''}>
          服务器管理
        </Title>
        <Space>
          <Select
            value={status || undefined}
            placeholder="状态筛选"
            allowClear
            style={{ width: 120 }}
            onChange={handleStatusChange}
            options={[
              { value: '', label: '全部' },
              ...Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.text })),
            ]}
          />
          <Input.Search
            placeholder="搜索名称/用途/IP"
            allowClear
            style={{ width: 220 }}
            onSearch={handleSearch}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建服务器
          </Button>
        </Space>
      </div>

      <Table<ServerRecord>
        className={styles.table ?? ''}
        rowKey="id"
        columns={columns}
        dataSource={records}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <ServerFormModal
        visible={formVisible}
        mode={formMode}
        record={editingServer}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
