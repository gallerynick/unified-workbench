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
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { listContents, deleteContent } from '../../api/contents';
import type { Content } from '../../types/content';
import ContentForm from './ContentForm';
import styles from './ContentManagement.module.css';

const { Title } = Typography;

const VISIBILITY_MAP: Record<Content['visibility'], { color: string; text: string; className: string }> = {
  public: { color: 'success', text: '公开', className: styles.visibilityPublic ?? '' },
  private: { color: 'error', text: '私有', className: styles.visibilityPrivate ?? '' },
};

export default function ContentManagement() {
  const [contents, setContents] = useState<Content[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // 弹窗状态
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingContent, setEditingContent] = useState<Content | null>(null);

  const fetchContents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listContents({ page, page_size: pageSize, search });
      if (res.code === 0) {
        setContents(res.data.items);
        setTotal(res.data.total);
      } else {
        message.error(res.msg || '获取内容列表失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取内容列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    fetchContents();
  }, [fetchContents]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleCreate = () => {
    setFormMode('create');
    setEditingContent(null);
    setFormVisible(true);
  };

  const handleEdit = (content: Content) => {
    setFormMode('edit');
    setEditingContent(content);
    setFormVisible(true);
  };

  const handleDelete = (content: Content) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除内容「${content.title}」吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteContent(content.id);
          if (res.code === 0) {
            message.success('内容已删除');
            fetchContents();
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
    setEditingContent(null);
  };

  const handleFormSuccess = () => {
    setFormVisible(false);
    setEditingContent(null);
    fetchContents();
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const columns: ColumnsType<Content> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 200,
      render: (tags: Content['tags']) => (
        <div className={styles.tagList ?? ''}>
          {tags && tags.length > 0 ? (
            tags.map((tag) => (
              <Tag key={tag} color="blue">
                {tag}
              </Tag>
            ))
          ) : (
            <span style={{ color: '#bfbfbf' }}>无标签</span>
          )}
        </div>
      ),
    },
    {
      title: '可见性',
      dataIndex: 'visibility',
      key: 'visibility',
      width: 100,
      render: (visibility: Content['visibility']) => {
        const cfg = VISIBILITY_MAP[visibility];
        return (
          <Space size={4}>
            <EyeOutlined className={cfg.className} />
            <Tag color={cfg.color}>{cfg.text}</Tag>
          </Space>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (text: string) => formatDate(text),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (text: string) => formatDate(text),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, record: Content) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
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
          内容管理
        </Title>
        <Space>
          <Input
            placeholder="搜索标题/标签/关键词"
            prefix={<SearchOutlined />}
            allowClear
            className={styles.searchInput ?? ''}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建内容
          </Button>
        </Space>
      </div>

      <Table<Content>
        className={styles.table ?? ''}
        columns={columns}
        dataSource={contents}
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

      <ContentForm
        visible={formVisible}
        mode={formMode}
        content={editingContent}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
