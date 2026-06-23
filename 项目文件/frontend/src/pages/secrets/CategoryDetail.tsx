import { useEffect, useState, useCallback, useMemo } from 'react';
import { Button, Typography, Modal, message, Space, Table, Tag, Tooltip, Empty, Collapse } from 'antd';
import { PlusOutlined, ArrowLeftOutlined, EyeOutlined, DeleteOutlined, KeyOutlined, FolderOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getSecretCategory } from '../../api/secret_categories';
import { listSecrets, deleteSecret } from '../../api/secrets';
import type { SecretCategory } from '../../types/secret_category';
import type { Secret } from '../../types/secret';
import SecretFormModal from './SecretFormModal';
import PasswordVerifyModal from './PasswordVerifyModal';
import styles from './SecretManagement.module.css';

const { Title, Paragraph } = Typography;

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

interface CategoryDetailProps {
  categoryId: string;
  onBack: () => void;
}

export default function CategoryDetail({ categoryId, onBack }: CategoryDetailProps) {
  const [category, setCategory] = useState<SecretCategory | null>(null);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(false);

  // 新建弹窗状态
  const [formModalVisible, setFormModalVisible] = useState(false);

  // 密码验证弹窗状态
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [verifySecretId, setVerifySecretId] = useState<string | null>(null);
  const [verifySecretName, setVerifySecretName] = useState('');

  const fetchCategory = useCallback(async () => {
    try {
      const res = await getSecretCategory(categoryId);
      if (res.code === 0) {
        setCategory(res.data);
      } else {
        message.error(res.msg || '获取分类信息失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取分类信息失败';
      message.error(msg);
    }
  }, [categoryId]);

  const fetchSecrets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSecrets({ page: 1, page_size: 100 });
      if (res.code === 0) {
        // Filter secrets by category_id
        const filtered = res.data.items.filter((s) => s.category_id === categoryId);
        setSecrets(filtered);
      } else {
        message.error(res.msg || '获取密钥列表失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取密钥列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    fetchCategory();
  }, [fetchCategory]);

  useEffect(() => {
    fetchSecrets();
  }, [fetchSecrets]);

  // 按子分类分组
  const groupedSecrets = useMemo(() => {
    const groups: Record<string, Secret[]> = {};
    for (const secret of secrets) {
      const subCat = secret.sub_category || '未分类';
      if (!groups[subCat]) {
        groups[subCat] = [];
      }
      groups[subCat].push(secret);
    }
    return groups;
  }, [secrets]);

  const handleView = useCallback((secret: Secret) => {
    setVerifySecretId(secret.id);
    setVerifySecretName(secret.name);
    setVerifyModalVisible(true);
  }, []);

  const handleDelete = useCallback((secret: Secret) => {
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
  }, [fetchSecrets]);

  const columns: ColumnsType<Secret> = useMemo(() => [
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
  ], [handleView, handleDelete]);

  // Collapse items
  const collapseItems = useMemo(() => {
    return Object.entries(groupedSecrets).map(([subCat, items]) => ({
      key: subCat,
      label: (
        <Space>
          <FolderOutlined style={{ color: '#1677ff' }} />
          <span style={{ fontWeight: 500 }}>{subCat}</span>
          <Tag>{items.length} 项</Tag>
        </Space>
      ),
      children: (
        <Table<Secret>
          className={styles.table ?? ''}
          columns={columns}
          dataSource={items}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: <Empty description="该子分类下暂无密钥" /> }}
        />
      ),
    }));
  }, [groupedSecrets, columns]);

  const handleCreate = () => {
    setFormModalVisible(true);
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

  if (!category && !loading) {
    return <Empty description="分类不存在" />;
  }

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
            返回
          </Button>
          <div>
            <Title level={4} style={{ fontWeight: 600, margin: 0 }}>
              {category?.name || '加载中...'}
            </Title>
            <Paragraph type="secondary" className={styles.categoryDesc ?? ''}>
              {category?.description || '暂无描述'}
            </Paragraph>
          </div>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          添加密钥
        </Button>
      </div>

      {secrets.length === 0 && !loading ? (
        <Empty description="该分类下暂无密钥">
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            添加密钥
          </Button>
        </Empty>
      ) : (
        <Collapse
          defaultActiveKey={Object.keys(groupedSecrets)}
          items={collapseItems}
          className={styles.collapse ?? ''}
        />
      )}

      <SecretFormModal
        visible={formModalVisible}
        categoryId={categoryId}
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
