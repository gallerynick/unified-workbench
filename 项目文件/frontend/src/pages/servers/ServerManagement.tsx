import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Input,
  Select,
  Typography,
  Modal,
  message,
  Space,
  Tooltip,
  Tag,
  Empty,
  Spin,
  Pagination,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { listServers, deleteServer, getServerSystems } from '../../api/servers';
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

  // 多系统服务器的系统数量（列表接口不返回，按页补充查询）
  const [systemCountMap, setSystemCountMap] = useState<Record<string, number>>({});

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
        const multiIds = res.data.items
          .filter((r) => r.server_type === 'MULTI')
          .map((r) => r.id);
        if (multiIds.length > 0) {
          const entries = await Promise.all(
            multiIds.map(async (id): Promise<[string, number]> => {
              try {
                const sysRes = await getServerSystems(id);
                return [id, sysRes.code === 0 ? sysRes.data.items.length : 0];
              } catch {
                return [id, 0];
              }
            })
          );
          setSystemCountMap(Object.fromEntries(entries));
        } else {
          setSystemCountMap({});
        }
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

  const getSystemCount = (record: ServerRecord): number => {
    if (record.server_type === 'SINGLE') return record.system_id ? 1 : 0;
    return systemCountMap[record.id] ?? 0;
  };

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

      {records.length === 0 && !loading ? (
        <Empty description="暂无服务器" className={styles.empty ?? ''} />
      ) : (
        <>
          <Spin spinning={loading}>
            <div className={styles.cardGrid}>
              {records.map((record) => (
                <Card
                  key={record.id}
                  className={styles.card ?? ''}
                  title={
                    <button
                      type="button"
                      className={styles.cardTitleBtn}
                      onClick={() => handleDetail(record)}
                      aria-label={`查看 ${record.name} 详情`}
                    >
                      <span className={styles.cardTitleText}>{record.name}</span>
                    </button>
                  }
                  extra={
                    <Tag color={STATUS_MAP[record.status]?.color ?? 'default'}>
                      {STATUS_MAP[record.status]?.text ?? record.status}
                    </Tag>
                  }
                  actions={[
                    <Tooltip key="detail" title="详情">
                      <Button
                        type="text"
                        size="small"
                        icon={<EyeOutlined />}
                        aria-label="详情"
                        onClick={() => handleDetail(record)}
                      />
                    </Tooltip>,
                    <Tooltip key="edit" title="编辑">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        aria-label="编辑"
                        onClick={() => handleEdit(record)}
                      />
                    </Tooltip>,
                    <Tooltip key="delete" title="删除">
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label="删除"
                        onClick={() => handleDelete(record)}
                      />
                    </Tooltip>,
                  ]}
                >
                  <div className={styles.cardBody}>
                    <div className={styles.infoRow}>
                      <span className={styles.label}>用途</span>
                      <span className={styles.value} title={record.purpose ?? ''}>
                        {record.purpose || '-'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.label}>IP 地址</span>
                      <span className={styles.value} title={record.ip ?? ''}>
                        {record.ip || '-'}
                      </span>
                    </div>
                    <div className={styles.tags}>
                      <Tag color={SERVER_TYPE_MAP[record.server_type]?.color ?? 'default'}>
                        {SERVER_TYPE_MAP[record.server_type]?.text ?? record.server_type}
                      </Tag>
                      <Tag color={DEPLOY_STATUS_MAP[record.deploy_status]?.color ?? 'default'}>
                        {DEPLOY_STATUS_MAP[record.deploy_status]?.text ?? record.deploy_status}
                      </Tag>
                    </div>
                    <div className={styles.meta}>
                      <span className={styles.metaItem}>
                        系统数 <b>{getSystemCount(record)}</b>
                      </span>
                      <span className={styles.metaItem}>
                        维护人员 <b>{record.maintainer_ids.length}</b>
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Spin>
          <div className={styles.pagination}>
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger
              showQuickJumper
              showTotal={(t) => `共 ${t} 条`}
              onChange={(p, ps) => {
                setPage(p);
                setPageSize(ps);
              }}
            />
          </div>
        </>
      )}

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
