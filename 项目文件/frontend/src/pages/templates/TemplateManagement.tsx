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
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  LockOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  listTemplates,
  deleteTemplate,
  createTemplate,
  updateTemplate,
} from '../../api/templates';
import { isAdmin } from '../../utils/auth';
import type { Template, TemplateField } from '../../types/template';
import ContentEditor from '../content/ContentEditor';
import styles from './TemplateManagement.module.css';

const { Title } = Typography;

const CATEGORY_FILTER_OPTIONS = [
  { value: '', label: '全部分类' },
  { value: '项目管理', label: '项目管理' },
  { value: '文档模板', label: '文档模板' },
  { value: '表单模板', label: '表单模板' },
  { value: '报告模板', label: '报告模板' },
  { value: '其他', label: '其他' },
] as const;

function buildContentField(content: Record<string, unknown> | null): TemplateField {
  return {
    key: 'content',
    type: 'richtext',
    label: '内容',
    required: false,
    default_value: null,
    sort_order: 0,
    config: content ?? {},
  };
}

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
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [docName, setDocName] = useState('');
  const [docCategory, setDocCategory] = useState('');
  const [docContent, setDocContent] = useState<Record<string, unknown> | null>(null);

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
    setModalMode('create');
    setEditingId(null);
    setDocName('');
    setDocCategory('');
    setDocContent(null);
    setModalVisible(true);
  };

  const openEditModal = (tpl: Template) => {
    setModalMode('edit');
    setEditingId(tpl.id);
    setDocName(tpl.name);
    setDocCategory(tpl.category);
    const richtextField = tpl.schema.find((f) => f.type === 'richtext');
    setDocContent(richtextField?.config ?? null);
    setModalVisible(true);
  };

  const handleDelete = (tpl: Template) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除文档「${tpl.name}」吗？此操作不可撤销。`,
      okText: '删除',
      okType: 'danger',
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

  const handleModalOk = async () => {
    if (!docName.trim()) {
      message.error('请输入文档名称');
      return;
    }

    const schema = [buildContentField(docContent)];

    try {
      if (modalMode === 'create') {
        const res = await createTemplate({
          name: docName.trim(),
          category: docCategory.trim() || '未分类',
          location: 'global',
          schema,
        });
        if (res.code === 0) {
          message.success('文档创建成功');
          setModalVisible(false);
          fetchTemplates();
        } else {
          message.error(res.msg || '创建失败');
        }
      } else if (editingId) {
        const res = await updateTemplate(editingId, {
          name: docName.trim(),
          category: docCategory.trim() || '未分类',
          location: 'global',
          schema,
        });
        if (res.code === 0) {
          message.success('文档更新成功');
          setModalVisible(false);
          fetchTemplates();
        } else {
          message.error(res.msg || '更新失败');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败';
      message.error(msg);
    }
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
      width: 160,
      render: (_: unknown, record: Template) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
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
            prefix={<SearchOutlined />}
            allowClear
            className={styles.searchInput ?? ''}
            onChange={(e) => handleSearch(e.target.value)}
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

      <Modal
        title={modalMode === 'create' ? '新建文档' : '编辑文档'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        width={800}
        okText="保存"
        cancelText="取消"
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: "var(--spacing-card-gap)" }}>
          <div style={{ display: 'flex', gap: "var(--spacing-card-gap)" }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="doc-name" style={{ display: 'block', marginBottom: "var(--spacing-xxs)", fontWeight: 500 }}>
                文档名称                 <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <Input
                id="doc-name"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="请输入文档名称"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="doc-category" style={{ display: 'block', marginBottom: "var(--spacing-xxs)", fontWeight: 500 }}>
                分类
              </label>
              <Input
                id="doc-category"
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value)}
                placeholder="请输入分类（可选）"
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'block', marginBottom: "var(--spacing-xxs)", fontWeight: 500 }}>
              内容
            </div>
            <ContentEditor
              value={docContent}
              onChange={(val) => setDocContent(val)}
              placeholder="请输入文档内容..."
              minHeight={300}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ==================== 主页面 ====================

export default function TemplateManagement() {
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
    </div>
  );
}
