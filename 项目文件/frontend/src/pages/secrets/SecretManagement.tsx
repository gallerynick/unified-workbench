import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography, Modal, message, Space, Card, Empty, Spin, Input, Tooltip } from 'antd';
import { PlusOutlined, FolderOutlined, EditOutlined, DeleteOutlined, SearchOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { listSecretCategories, deleteSecretCategory } from '../../api/secret_categories';
import { listSecrets } from '../../api/secrets';
import type { SecretCategory } from '../../types/secret_category';
import CategoryFormModal from './CategoryFormModal';
import styles from './SecretManagement.module.css';

const { Title, Paragraph } = Typography;

export default function SecretManagement() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<SecretCategory[]>([]);
  const [secretCounts, setSecretCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SecretCategory | null>(null);
  const [permissionVisible, setPermissionVisible] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSecretCategories({ page: 1, page_size: 100 });
      if (res.code === 0) {
        setCategories(res.data.items);
      } else {
        message.error(res.msg || '获取分类列表失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取分类列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSecretCounts = useCallback(async () => {
    try {
      const res = await listSecrets({ page: 1, page_size: 100 });
      if (res.code === 0) {
        const counts: Record<string, number> = {};
        for (const secret of res.data.items) {
          const catId = secret.category_id || 'uncategorized';
          counts[catId] = (counts[catId] || 0) + 1;
        }
        setSecretCounts(counts);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchSecretCounts();
  }, [fetchCategories, fetchSecretCounts]);

  const handleCategoryClick = (category: SecretCategory) => {
    navigate(`/secrets/category/${category.id}`);
  };

  const handleCreate = () => {
    setEditingCategory(null);
    setFormModalVisible(true);
  };

  const handleEdit = (category: SecretCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCategory(category);
    setFormModalVisible(true);
  };

  const handleDelete = (category: SecretCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除分类「${category.name}」吗？该分类下的密钥将变为未分类。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteSecretCategory(category.id);
          if (res.code === 0) {
            message.success('分类已删除');
            fetchCategories();
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
    setEditingCategory(null);
  };

  const handleFormModalSuccess = () => {
    setFormModalVisible(false);
    setEditingCategory(null);
    fetchCategories();
  };

  const filteredCategories = categories.filter(
    (c) => !search || c.name.includes(search) || c.description.includes(search)
  );

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>
          密钥保险箱
        </Title>
        <Space>
          <Input
            placeholder="搜索分类"
            prefix={<SearchOutlined />}
            allowClear
            className={styles.searchInput ?? ''}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新增类
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

      <div className={styles.description ?? ''}>
        <Paragraph type="secondary">
          创建分类来组织您的密钥，点击分类进入查看和管理该分类下的密钥。
        </Paragraph>
      </div>

      {loading ? (
        <div className={styles.loadingContainer ?? ''}>
          <Spin size="large" />
        </div>
      ) : filteredCategories.length === 0 ? (
        <Empty
          description={search ? '没有匹配的分类' : '暂无分类'}
          className={styles.empty ?? ''}
        >
          {!search && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新增类
            </Button>
          )}
        </Empty>
      ) : (
        <div className={styles.categoryGrid ?? ''}>
          {filteredCategories.map((category) => (
            <Card
              key={category.id}
              className={styles.categoryCard ?? ''}
              hoverable
              onClick={() => handleCategoryClick(category)}
            >
              <div className={styles.categoryHeader ?? ''}>
                <div className={styles.categoryIcon ?? ''}>
                  <FolderOutlined />
                </div>
                <div className={styles.categoryInfo ?? ''}>
                  <Title level={5} className={styles.categoryName ?? ''}>
                    {category.name}
                  </Title>
                  <Paragraph className={styles.categoryDesc ?? ''} type="secondary">
                    {category.description || '暂无描述'}
                  </Paragraph>
                </div>
                <div className={styles.categoryActions ?? ''}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    aria-label="编辑"
                    onClick={(e) => handleEdit(category, e)}
                  />
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label="删除"
                    onClick={(e) => handleDelete(category, e)}
                  />
                </div>
              </div>
              <div className={styles.categoryMeta ?? ''}>
                <span className={styles.categoryTime ?? ''}>
                  {secretCounts[category.id] || 0} 个密钥
                </span>
                <span className={styles.categoryTime ?? ''}>
                  创建于 {new Date(category.created_at).toLocaleDateString('zh-CN')}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CategoryFormModal
        visible={formModalVisible}
        category={editingCategory}
        onClose={handleFormModalClose}
        onSuccess={handleFormModalSuccess}
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
            密钥私有
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>所有密钥强制私有，仅创建者本人可见，其他成员无法查看密钥内容。</Paragraph>
          <Title level={5}>
            查看密钥值
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>查看密钥值需要再次输入登录密码进行身份验证，验证通过后才能解密查看。</Paragraph>
          <Title level={5}>
            加密保护
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>密钥使用 AES-256-GCM 加密后存储，即使数据库泄露也无法直接读取明文。</Paragraph>
          <Title level={5}>
            分类管理
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>所有成员都可以创建密钥分类；删除分类后，该分类下的密钥将变为未分类。</Paragraph>
          <Title level={5}>
            管理员
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>系统管理员可以查看和管理所有密钥分类。</Paragraph>
        </div>
      </Modal>
    </div>
  );
}
