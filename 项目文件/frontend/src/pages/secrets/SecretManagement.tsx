import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Input,
  Tag,
  Typography,
  Modal,
  message,
  Space,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  DeleteOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { listSecrets, deleteSecret } from '../../api/secrets';
import type { Secret } from '../../types/secret';
import SecretFormModal from './SecretFormModal';
import PasswordVerifyModal from './PasswordVerifyModal';
import styles from './SecretManagement.module.css';

const { Title } = Typography;

// 密钥类型标签映射
const SECRET_TYPE_MAP: Record<string, { color: string; text: string }> = {
  api_key: { color: 'blue', text: 'API 密钥' },
  account: { color: 'green', text: '账号密码' },
  config: { color: 'orange', text: '配置项' },
  other: { color: 'default', text: '其他' },
};

// 格式化日期
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SecretManagement() {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // 新建弹窗状态
  const [formModalVisible, setFormModalVisible] = useState(false);

  // 密码验证弹窗状态
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [verifySecretId, setVerifySecretId] = useState<string | null>(null);
  const [verifySecretName, setVerifySecretName] = useState('');

  const fetchSecrets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSecrets({ page, page_size: pageSize, search });
      if (res.code === 0) {
        setSecrets(res.data.items);
        setTotal(res.data.total);
      } else {
        message.error(res.msg || '获取密钥列表失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取密钥列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    fetchSecrets();
  }, [fetchSecrets]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleCreate = () => {
    setFormModalVisible(true);
  };

  const handleView = (secret: Secret) => {
    setVerifySecretId(secret.id);
    setVerifySecretName(secret.name);
    setVerifyModalVisible(true);
  };

  const handleDelete = (secret: Secret) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除密钥「${secret.name}」吗？删除后无法恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteSecret(secret.id);
          if (res.code === 0) {
            message.success('密钥已删除');
            fetchSecrets();
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

  const handleFormModalClose = () => {
    setFormModalVisible(false);
  };

  const handleFormModalSuccess = () => {
    setFormModalVisible(false);
    fetchSecrets();
  };

  const handleVerifyModalClose = () => {
    setVerifyModalVisible(false);
    setVerifySecretId(null);
    setVerifySecretName('');
  };

  const columns: ColumnsType<Secret> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (name: string) => (
        <Space size="small">
          <KeyOutlined style={{ color: '#8c8c8c' }} />
          <span>{name}</span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'secret_type',
      key: 'secret_type',
      width: 120,
      render: (secretType: string) => {
        const cfg = SECRET_TYPE_MAP[secretType] ?? SECRET_TYPE_MAP.other ?? { color: 'default', text: secretType };
        return (
          <Tag color={cfg.color} className={styles.secretTypeTag ?? ''}>
            {cfg.text}
          </Tag>
        );
      },
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (note: string | undefined) => (
        <span className={styles.noteCell ?? ''}>{note || '-'}</span>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => formatDate(date),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, record: Secret) => (
        <Space size="small">
          <Tooltip title="查看">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            >
              查看
            </Button>
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            >
              删除
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>
          密钥管理
        </Title>
        <Space>
          <Input
            placeholder="搜索名称/备注"
            prefix={<SearchOutlined />}
            allowClear
            className={styles.searchInput ?? ''}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建密钥
          </Button>
        </Space>
      </div>

      <Table<Secret>
        className={styles.table ?? ''}
        columns={columns}
        dataSource={secrets}
        rowKey="id"
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

      <SecretFormModal
        visible={formModalVisible}
        onClose={handleFormModalClose}
        onSuccess={handleFormModalSuccess}
      />

      <PasswordVerifyModal
        visible={verifyModalVisible}
        secretId={verifySecretId}
        secretName={verifySecretName}
        onClose={handleVerifyModalClose}
      />
    </div>
  );
}
