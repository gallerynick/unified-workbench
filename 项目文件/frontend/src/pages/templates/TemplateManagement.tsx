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
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  ExportOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  listTemplates,
  deleteTemplate,
  exportTemplate,
  importTemplate,
} from '../../api/templates';
import type { Template } from '../../types/template';
import TemplateEditor from './TemplateEditor';
import styles from './TemplateManagement.module.css';

const { Title } = Typography;

const CATEGORY_FILTER_OPTIONS = [
  { value: '', label: '全部分类' },
  { value: '项目管理', label: '项目管理' },
  { value: '文档模板', label: '文档模板' },
  { value: '表单模板', label: '表单模板' },
  { value: '报告模板', label: '报告模板' },
  { value: '其他', label: '其他' },
];

export default function TemplateManagement() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);

  const [editorVisible, setEditorVisible] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        page: number;
        page_size: number;
        search?: string;
        category?: string;
      } = {
        page,
        page_size: pageSize,
      };
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

  const handleCreate = () => {
    setEditorMode('create');
    setEditingTemplate(null);
    setEditorVisible(true);
  };

  const handleEdit = (tpl: Template) => {
    setEditorMode('edit');
    setEditingTemplate(tpl);
    setEditorVisible(true);
  };

  const handleDelete = (tpl: Template) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除模板「${tpl.name}」吗？此操作不可撤销。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteTemplate(tpl.id);
          if (res.code === 0) {
            message.success('模板已删除');
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

  const handleExport = async (tpl: Template) => {
    try {
      const data = await exportTemplate(tpl.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${tpl.name}.json`;
      link.click();
      URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '导出失败';
      message.error(msg);
    }
  };

  const handleImportFile = async (file: File) => {
    try {
      const content = await file.text();
      const data = JSON.parse(content) as Record<string, unknown>;

      if (!data.name || !data.category || !Array.isArray(data.schema)) {
        message.error('无效的模板文件格式');
        return;
      }

      const res = await importTemplate(data as unknown as Template);
      if (res.code === 0) {
        message.success('导入成功');
        fetchTemplates();
      } else {
        message.error(res.msg || '导入失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '导入失败';
      message.error(msg);
    }
  };

  const handleEditorClose = () => {
    setEditorVisible(false);
    setEditingTemplate(null);
  };

  const handleEditorSuccess = () => {
    setEditorVisible(false);
    setEditingTemplate(null);
    fetchTemplates();
  };

  const columns: ColumnsType<Template> = [
    {
      title: '模板名称',
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
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
    },
    {
      title: '字段数',
      key: 'field_count',
      width: 80,
      render: (_: unknown, record: Template) => record.schema.length,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: Template) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ExportOutlined />}
            onClick={() => void handleExport(record)}
          >
            导出
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
        <Title level={4} className={styles.title ?? ''}>
          模板管理
        </Title>
        <Space wrap>
          <Input
            placeholder="搜索模板名称"
            prefix={<SearchOutlined />}
            allowClear
            className={styles.searchInput ?? ''}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <Select
            placeholder="全部分类"
            options={CATEGORY_FILTER_OPTIONS}
            onChange={handleCategoryChange}
            className={styles.categorySelect ?? ''}
            allowClear
            value={category || null}
          />
          <Button
            icon={<ImportOutlined />}
            onClick={() => document.getElementById('template-import-input')?.click()}
          >
            导入 JSON
          </Button>
          <input
            id="template-import-input"
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void handleImportFile(file);
                e.target.value = '';
              }
            }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建模板
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

      <TemplateEditor
        visible={editorVisible}
        mode={editorMode}
        template={editingTemplate}
        onClose={handleEditorClose}
        onSuccess={handleEditorSuccess}
      />
    </div>
  );
}
