import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Typography,
  Modal,
  message,
  Space,
  Result,
  Tabs,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  LockOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  listTemplates,
  deleteTemplate,
} from '../../api/templates';
import { isAdmin } from '../../utils/auth';
import type { Template } from '../../types/template';
import TemplateDocModal from './TemplateDocModal';
import styles from './TemplateManagement.module.css';

const { Title, Paragraph, Text } = Typography;

const CATEGORY_FILTER_OPTIONS = [
  { value: '', label: '全部分类' },
  { value: '项目管理', label: '项目管理' },
  { value: '文档模板', label: '文档模板' },
  { value: '表单模板', label: '表单模板' },
  { value: '报告模板', label: '报告模板' },
  { value: '其他', label: '其他' },
] as const;

// ==================== 项目文档 Tab ====================

function ProjectDocsTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Template | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        page: number;
        page_size: number;
        search?: string;
        category?: string;
      } = { page, page_size: pageSize };
      if (search) params.search = search;
      if (category) params.category = category;

      const res = await listTemplates(params);
      if (res.code === 0) {
        setTemplates(res.data.items);
        setTotal(res.data.total);
      } else {
        message.error(res.msg || '获取模板列表失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取模板列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, category]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setPage(1);
  };

  const openCreateModal = () => {
    setEditingDoc(null);
    setModalVisible(true);
  };

  const openEditModal = (tpl: Template) => {
    setEditingDoc(tpl);
    setModalVisible(true);
  };

  const handleDelete = (tpl: Template) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除文档「${tpl.name}」吗？此操作不可撤销。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteTemplate(tpl.id);
          if (res.code === 0) {
            message.success('文档已删除');
            fetchTemplates();
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

  const columns: ColumnsType<Template> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, record: Template) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
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
        <Space wrap>
          <Input
            placeholder="搜索文档名称"
            prefix={<SearchOutlined style={{ color: 'var(--text-secondary)' }} />}
            allowClear
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            variant="filled"
            className={styles.searchInput ?? ''}
          />
          {/* @ts-expect-error Ant Design Select + exactOptionalPropertyTypes */}
          <Select
            placeholder="全部分类"
            options={[...CATEGORY_FILTER_OPTIONS]}
            onChange={handleCategoryChange}
            className={styles.categorySelect ?? ''}
            allowClear
            value={category || undefined}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新建
          </Button>
        </Space>
      </div>

      <Table<Template>
        className={styles.table ?? ''}
        columns={columns}
        dataSource={templates}
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

      <TemplateDocModal
        open={modalVisible}
        editingDoc={editingDoc}
        onClose={() => setModalVisible(false)}
        onSaved={fetchTemplates}
      />
    </div>
  );
}

// ==================== 主页面 ====================

export default function TemplateManagement() {
  const [permissionVisible, setPermissionVisible] = useState(false);

  if (!isAdmin()) {
    return (
      <Result
        status="403"
        title="权限不足"
        subTitle="只有管理员可以管理模板库"
        icon={<LockOutlined />}
      />
    );
  }

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>模板库</Title>
        <Space>
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
      <Tabs
        destroyInactiveTabPane
        items={[
          {
            key: 'docs',
            label: '项目文档',
            children: <ProjectDocsTab />,
          },
        ]}
      />

      <Modal
        title="权限说明"
        open={permissionVisible}
        width={560}
        footer={null}
        onCancel={() => setPermissionVisible(false)}
      >
        <div>
          <Text strong style={{ fontSize: 'var(--text-caption-strong-size)' }}>
            管理权限
          </Text>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>只有管理员可以管理模板库，包括创建、编辑和删除模板。</Paragraph>
          <Text strong style={{ fontSize: 'var(--text-caption-strong-size)' }}>
            使用权限
          </Text>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>所有成员都可以浏览和使用模板，具体可访问范围取决于模板设置的可见性。</Paragraph>
          <Text strong style={{ fontSize: 'var(--text-caption-strong-size)' }}>
            可见范围
          </Text>
          <ul>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                公开：所有成员都可以使用该模板
              </Text>
            </li>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                私有：仅创建者和管理员可以使用
              </Text>
            </li>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                指定用户：仅被指定的用户可以使用
              </Text>
            </li>
          </ul>
          <Text strong style={{ fontSize: 'var(--text-caption-strong-size)' }}>
            管理员
          </Text>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>系统管理员拥有模板库的完全管理权限。</Paragraph>
        </div>
      </Modal>
    </div>
  );
}
