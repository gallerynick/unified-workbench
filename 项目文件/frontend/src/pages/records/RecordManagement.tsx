import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Tag,
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
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { listRecords, deleteRecord, updateRecordStatus } from '../../api/records';
import { listTemplates, getTemplate } from '../../api/templates';
import type { WorkRecord, RecordType, RecordStatus } from '../../types/record';
import type { Template, TemplateField } from '../../types/template';
import { getVisibilityConfig } from '../../utils/visibility';
import RecordForm from './RecordForm';
import ExportButtons from './ExportButtons';
import styles from './RecordManagement.module.css';

const { Title } = Typography;

// 类型标签配置
const TYPE_MAP: Record<RecordType, { color: string; text: string }> = {
  project: { color: 'blue', text: '项目' },
  record: { color: 'cyan', text: '记录' },
};

// 状态流转选项
const STATUS_OPTIONS: { value: RecordStatus; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'ongoing', label: '进行中' },
  { value: 'done', label: '已完成' },
  { value: 'archived', label: '已归档' },
];

interface RecordManagementProps {
  defaultType?: RecordType;
}

export default function RecordManagement({ defaultType }: RecordManagementProps = {}) {
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<RecordType | undefined>(defaultType);
  const [filterStatus, setFilterStatus] = useState<RecordStatus | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  // 模板选择弹窗
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // 记录表单弹窗
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingRecord, setEditingRecord] = useState<WorkRecord | null>(null);
  const [currentTemplateSnapshot, setCurrentTemplateSnapshot] = useState<TemplateField[]>([]);
  const [currentTemplateId, setCurrentTemplateId] = useState('');
  const [currentRecordType, setCurrentRecordType] = useState<RecordType>('record');

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        page: number;
        page_size: number;
        type?: RecordType;
        status?: RecordStatus;
        search?: string;
      } = {
        page,
        page_size: pageSize,
      };
      if (filterType) params.type = filterType;
      if (filterStatus) params.status = filterStatus;
      if (search) params.search = search;

      const res = await listRecords(params);
      if (res.code === 0) {
        setRecords(res.data.items);
        setTotal(res.data.total);
      } else {
        message.error(res.msg || '获取记录列表失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取记录列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterType, filterStatus, search]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await listTemplates({ page: 1, page_size: 100 });
      if (res.code === 0) {
        setTemplates(res.data.items);
      }
    } catch {
      // 静默失败
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleTypeFilter = (value: RecordType | undefined) => {
    setFilterType(value);
    setPage(1);
  };

  const handleStatusFilter = (value: RecordStatus | undefined) => {
    setFilterStatus(value);
    setPage(1);
  };

  // 打开新建流程：先选择模板
  const handleCreate = () => {
    setSelectedTemplateId('');
    fetchTemplates();
    setTemplateModalVisible(true);
  };

  // 确认模板选择后打开表单
  const handleTemplateConfirm = async () => {
    if (!selectedTemplateId) {
      message.warning('请选择一个模板');
      return;
    }
    try {
      const res = await getTemplate(selectedTemplateId);
      if (res.code === 0) {
        setCurrentTemplateSnapshot(res.data.schema);
        setCurrentTemplateId(res.data.id);
        setCurrentRecordType(res.data.category as RecordType || 'record');
        setFormMode('create');
        setEditingRecord(null);
        setTemplateModalVisible(false);
        setFormVisible(true);
      } else {
        message.error(res.msg || '获取模板详情失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取模板详情失败';
      message.error(msg);
    }
  };

  // 编辑记录
  const handleEdit = (record: WorkRecord) => {
    setCurrentTemplateSnapshot(record.template_snapshot);
    setCurrentTemplateId(record.template_id);
    setCurrentRecordType(record.type);
    setFormMode('edit');
    setEditingRecord(record);
    setFormVisible(true);
  };

  // 更新状态
  const handleStatusChange = async (record: WorkRecord, newStatus: RecordStatus) => {
    try {
      const res = await updateRecordStatus(record.id, { status: newStatus });
      if (res.code === 0) {
        message.success('状态更新成功');
        fetchRecords();
      } else {
        message.error(res.msg || '状态更新失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '状态更新失败';
      message.error(msg);
    }
  };

  // 删除记录
  const handleDelete = (record: WorkRecord) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除记录「${record.title}」吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteRecord(record.id);
          if (res.code === 0) {
            message.success('记录已删除');
            fetchRecords();
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
    setEditingRecord(null);
  };

  const handleFormSuccess = () => {
    setFormVisible(false);
    setEditingRecord(null);
    fetchRecords();
  };

  const columns: ColumnsType<WorkRecord> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: RecordType) => {
        const cfg = TYPE_MAP[type];
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: RecordStatus, record: WorkRecord) => (
        <Select
          value={status}
          size="small"
          className={styles.statusSelect ?? ''}
          options={STATUS_OPTIONS}
          onChange={(value) => handleStatusChange(record, value as RecordStatus)}
          variant="borderless"
          style={{ width: 100 }}
        />
      ),
    },
    {
      title: '可见性',
      dataIndex: 'visibility',
      key: 'visibility',
      width: 80,
      render: (visibility: string) => {
        const cfg = getVisibilityConfig(visibility);
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (date: string) => {
        const d = new Date(date);
        return d.toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_: unknown, record: WorkRecord) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <ExportButtons recordId={record.id} recordTitle={record.title} />
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
          {defaultType === 'project' ? '项目管理' : '记录管理'}
        </Title>
        <div className={styles.filters ?? ''}>
          <Input
            placeholder="搜索标题"
            prefix={<SearchOutlined />}
            allowClear
            className={styles.searchInput ?? ''}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <Select
            placeholder="类型"
            allowClear
            style={{ width: 100 }}
            options={[
              { value: 'project', label: '项目' },
              { value: 'record', label: '记录' },
            ]}
            onChange={handleTypeFilter}
          />
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 110 }}
            options={STATUS_OPTIONS}
            onChange={handleStatusFilter}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {defaultType === 'project' ? '新建项目' : '新建记录'}
          </Button>
        </div>
      </div>

      <Table<WorkRecord>
        className={styles.table ?? ''}
        columns={columns}
        dataSource={records}
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

      {/* 模板选择弹窗 */}
      <Modal
        title="选择模板"
        open={templateModalVisible}
        onOk={handleTemplateConfirm}
        onCancel={() => setTemplateModalVisible(false)}
        okText="确定"
        cancelText="取消"
        destroyOnClose
      >
        <Select
          placeholder="请选择模板"
          style={{ width: '100%' }}
          value={selectedTemplateId || null}
          onChange={setSelectedTemplateId}
          loading={loadingTemplates}
          showSearch
          optionFilterProp="label"
          options={templates.map((t) => ({
            value: t.id,
            label: `${t.name} (${t.category})`,
          }))}
        />
      </Modal>

      {/* 记录表单弹窗 */}
      <RecordForm
        visible={formVisible}
        mode={formMode}
        record={editingRecord}
        templateSnapshot={currentTemplateSnapshot}
        recordType={currentRecordType}
        templateId={currentTemplateId}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
