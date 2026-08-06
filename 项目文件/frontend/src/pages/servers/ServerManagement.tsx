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
  Tag,
  Empty,
  Spin,
  Pagination,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { listServers, deleteServer } from '../../api/servers';
import type { ServerRecord, ServerStatus } from '../../types/server';
import ServerFormModal from './ServerFormModal';
import styles from './ServerManagement.module.css';

const { Title, Paragraph } = Typography;

const STATUS_MAP: Record<ServerStatus, { color: string; text: string }> = {
  active: { color: 'success', text: '运行中' },
  maintenance: { color: 'warning', text: '维护中' },
  retired: { color: 'default', text: '已退役' },
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

  // 弹窗状态
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingServer, setEditingServer] = useState<ServerRecord | null>(null);
  const [permissionVisible, setPermissionVisible] = useState(false);

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
          <Input
            placeholder="搜索名称/用途/IP"
            prefix={<SearchOutlined style={{ color: 'var(--text-secondary)' }} />}
            allowClear
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            variant="filled"
            className={styles.searchInput ?? ''}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建服务器
          </Button>
          <Tooltip title="权限说明">
            <Button
              type="text"
              size="small"
              icon={<QuestionCircleOutlined />}
              onClick={() => setPermissionVisible(true)}
            />
          </Tooltip>
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
                    <Button
                      key="detail"
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      aria-label="详情"
                      onClick={() => handleDetail(record)}
                    >
                      详情
                    </Button>,
                    <Button
                      key="edit"
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      aria-label="编辑"
                      onClick={() => handleEdit(record)}
                    >
                      编辑
                    </Button>,
                    <Button
                      key="delete"
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label="删除"
                      onClick={() => handleDelete(record)}
                    >
                      删除
                    </Button>,
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
                      <span className={styles.label}>位置</span>
                      <span className={styles.value} title={record.location ?? ''}>
                        {record.location || '-'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.label}>IP 地址</span>
                      <span className={styles.value} title={record.ip ?? ''}>
                        {record.ip || '-'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.label}>操作系统</span>
                      <span className={styles.value} title={record.os ?? ''}>
                        {record.os || '-'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.label}>CPU</span>
                      <span className={styles.value}>
                        {record.cpu_cores != null ? `${record.cpu_cores} 核` : '-'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.label}>内存</span>
                      <span className={styles.value}>
                        {record.ram_capacity != null
                          ? `${record.ram_capacity} ${record.ram_unit ?? 'GB'}`
                          : '-'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.label}>磁盘</span>
                      <span className={styles.value}>
                        {record.disk_capacity != null
                          ? `${record.disk_capacity} ${record.disk_unit ?? 'GB'}`
                          : '-'}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.label}>型号</span>
                      <span className={styles.value} title={record.model ?? ''}>
                        {record.model || '-'}
                      </span>
                    </div>
                    {record.hardware_specs.length > 0 && (
                      <div className={styles.tags}>
                        {record.hardware_specs.slice(0, 3).map((spec) => (
                          <Tag key={`${spec.type}-${spec.model}`} color="geekblue">
                            {spec.model}
                          </Tag>
                        ))}
                        {record.hardware_specs.length > 3 && (
                          <Tag>+{record.hardware_specs.length - 3} more</Tag>
                        )}
                      </div>
                    )}
                    {record.tags.length > 0 && (
                      <div className={styles.tags}>
                        {record.tags.map((tag) => (
                          <Tag key={tag} color="blue">
                            {tag}
                          </Tag>
                        ))}
                      </div>
                    )}
                    <div className={styles.meta}>
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

      <Modal
        title="权限说明"
        open={permissionVisible}
        width={560}
        footer={null}
        onCancel={() => setPermissionVisible(false)}
        destroyOnClose
      >
        <div>
          <Title level={5}>
            查看权限
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>所有成员都可以查看服务器列表和详细信息。</Paragraph>
          <Title level={5}>
            管理权限
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>被指定为维护人员的成员可以编辑服务器信息并管理关联系统。</Paragraph>
          <Title level={5}>
            新建权限
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>所有成员都可以登记新的服务器，登记时可指定维护人员。</Paragraph>
          <Title level={5}>
            删除权限
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>删除服务器属于高风险操作，仅系统管理员可以执行。</Paragraph>
          <Title level={5}>
            管理员
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>系统管理员拥有所有服务器及关联系统的管理权限。</Paragraph>
        </div>
      </Modal>
    </div>
  );
}
