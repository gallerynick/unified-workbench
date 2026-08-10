import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Select,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  DatePicker,
  message,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  listProjectChanges,
  createProjectChange,
  updateProjectChange,
  deleteProjectChange,
  type ProjectChangeListParams,
} from '../../../api/project-changes';
import type { ProjectChange, ProjectChangeCreate, ProjectChangeUpdate } from '../../../types/project-change';
import type { Project } from '../../../types/project';
import {
  CHANGE_CATEGORY_MAJOR,
  CHANGE_CATEGORY_MINOR_MAP,
  PROJECT_NUMBER_PREFIX,
} from '../../../constants/project';
import { getUserId, isAdmin } from '../../../utils/auth';
import styles from './ChangeRecordTab.module.css';

const { TextArea } = Input;

/** 修改记录状态选项（对应后端 status: pending/approved/rejected） */
const CHANGE_STATUS_OPTIONS = [
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已采纳' },
  { value: 'rejected', label: '已拒绝' },
] as const;

/** 状态标签样式 */
const STATUS_TAG_MAP: Record<string, { color: string; text: string }> = {
  pending: { color: 'processing', text: '待审核' },
  approved: { color: 'success', text: '已采纳' },
  rejected: { color: 'error', text: '已拒绝' },
};

/** 大类标签颜色 */
const MAJOR_TAG_COLOR: Record<string, string> = {
  code: 'geekblue',
  doc: 'green',
  config: 'orange',
  other: 'default',
};

/** 小类标签颜色 */
const MINOR_TAG_COLOR: Record<string, string> = {
  frontend: 'cyan',
  backend: 'purple',
  database: 'gold',
  deploy: 'volcano',
  baseline: 'green',
  design: 'blue',
  api: 'cyan',
  ops: 'magenta',
  env: 'orange',
  docker: 'geekblue',
  nginx: 'blue',
  dependency: 'purple',
};

/** 生成变更编号（后端无编号端点，由前端按前缀+日期+随机数生成） */
function generateChangeNumber(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymd = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${PROJECT_NUMBER_PREFIX.change}${ymd}-${rand}`;
}

function getMajorLabel(value: string): string {
  return CHANGE_CATEGORY_MAJOR.find((c) => c.value === value)?.label ?? value;
}

function getMinorLabel(major: string, minor: string | null): string {
  if (!minor) return '';
  const options = CHANGE_CATEGORY_MINOR_MAP[major];
  return options?.find((o) => o.value === minor)?.label ?? minor;
}

function formatDateOnly(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  } catch {
    return dateStr;
  }
}

export default function ChangeRecordTab({ project }: { project: Project }) {
  const [items, setItems] = useState<ProjectChange[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [majorFilter, setMajorFilter] = useState<string | undefined>(undefined);

  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<ProjectChange | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const majorValue = Form.useWatch('category_major', form);

  // 权限：负责人/管理员全权限；成员按 member_permissions 的 changes 分区，readonly 时禁用操作
  const currentUserId = getUserId();
  const isAdminUser = isAdmin();
  const isOwner = !!currentUserId && currentUserId === project.owner_id;
  const changesPermission = project.member_permissions?.changes ?? '';
  const canEdit = isAdminUser || isOwner || changesPermission !== 'readonly';

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params: ProjectChangeListParams = {
        project_id: project.id,
        page,
        page_size: pageSize,
      };
      if (majorFilter) {
        params.category_major = majorFilter;
      }
      const res = await listProjectChanges(params);
      if (res.code === 0) {
        setItems(res.data.items);
        setTotal(res.data.total);
      } else {
        message.error(res.msg || '获取修改记录失败');
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '获取修改记录失败');
    } finally {
      setLoading(false);
    }
  }, [project.id, page, pageSize, majorFilter]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const minorOptions = useMemo(
    () => CHANGE_CATEGORY_MINOR_MAP[majorValue ?? ''] ?? [],
    [majorValue],
  );

  /** 大类切换时重置小类（编辑/新建共用） */
  const handleMajorChange = useCallback(
    (value: string) => {
      form.setFieldValue('category_minor', undefined);
      if (value === 'other') {
        form.setFieldValue('category_detail', undefined);
      }
    },
    [form],
  );

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      status: 'pending',
      category_major: 'code',
      date: dayjs(),
    });
    setModalVisible(true);
  };

  const openEdit = (record: ProjectChange) => {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({
      title: record.title,
      date: record.date ? dayjs(record.date) : undefined,
      category_major: record.category_major,
      category_minor: record.category_minor ?? undefined,
      category_detail: record.category_detail ?? undefined,
      content: record.content ?? '',
      status: record.status,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const title = values.title as string;
      const date = (values.date as dayjs.Dayjs).format('YYYY-MM-DDTHH:mm:ss');
      const category_major = values.category_major as string;
      const content = values.content as string;
      const status = (values.status as string) || 'pending';
      const category_minor = values.category_minor as string | undefined;
      const category_detail = values.category_detail as string | undefined;

      if (editing) {
        const payload: ProjectChangeUpdate = {
          title,
          date,
          category_major,
          content,
          status,
        };
        if (category_minor) payload.category_minor = category_minor;
        if (category_detail) payload.category_detail = category_detail;
        const res = await updateProjectChange(editing.id, payload);
        if (res.code === 0) {
          message.success('修改记录已更新');
          setModalVisible(false);
          fetchList();
        } else {
          message.error(res.msg || '更新失败');
        }
      } else {
        const payload: ProjectChangeCreate = {
          project_id: project.id,
          number: generateChangeNumber(),
          title,
          date,
          category_major,
          content,
          status,
        };
        if (category_minor) payload.category_minor = category_minor;
        if (category_detail) payload.category_detail = category_detail;
        const res = await createProjectChange(payload);
        if (res.code === 0) {
          message.success('修改记录已创建');
          setModalVisible(false);
          fetchList();
        } else {
          message.error(res.msg || '创建失败');
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (record: ProjectChange) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除修改记录「${record.number} ${record.title}」吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteProjectChange(record.id);
          if (res.code === 0) {
            message.success('修改记录已删除');
            fetchList();
          } else {
            message.error(res.msg || '删除失败');
          }
        } catch (err: unknown) {
          message.error(err instanceof Error ? err.message : '删除失败');
        }
      },
    });
  };

  const columns: ColumnsType<ProjectChange> = [
    {
      title: '编号',
      dataIndex: 'number',
      key: 'number',
      width: 160,
      render: (text: string) => (
        <span style={{ fontFamily: 'var(--font-mono)' }}>{text}</span>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (text: string) => formatDateOnly(text),
    },
    {
      title: '大类',
      dataIndex: 'category_major',
      key: 'category_major',
      width: 80,
      render: (value: string) => (
        <Tag color={MAJOR_TAG_COLOR[value] ?? 'default'}>{getMajorLabel(value)}</Tag>
      ),
    },
    {
      title: '小类',
      key: 'category_minor',
      width: 160,
      render: (_: unknown, record: ProjectChange) => {
        const minorLabel = getMinorLabel(record.category_major, record.category_minor);
        return (
          <Space direction="vertical" size={2}>
            {record.category_minor ? (
              <Tag color={MINOR_TAG_COLOR[record.category_minor] ?? 'default'}>
                {minorLabel}
              </Tag>
            ) : (
              <span style={{ color: 'var(--text-tertiary)' }}>-</span>
            )}
            {record.category_detail && (
              <Tooltip title={record.category_detail}>
                <span className={styles.detailText ?? ''}>{record.category_detail}</span>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const cfg = STATUS_TAG_MAP[status] || { color: 'default', text: status };
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (text: string) => {
        try {
          return new Date(text).toLocaleString('zh-CN');
        } catch {
          return text;
        }
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 130,
      render: (_: unknown, record: ProjectChange) =>
        canEdit ? (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
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
        ) : null,
    },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Select
          allowClear
          placeholder="按大类筛选"
          value={majorFilter ?? null}
          onChange={(value: string) => {
            setMajorFilter(value);
            setPage(1);
          }}
          options={CHANGE_CATEGORY_MAJOR.map((c) => ({ value: c.value, label: c.label }))}
          style={{ minWidth: 180 }}
          className={styles.filterSelect ?? ''}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreate}
          disabled={!canEdit}
        >
          新建记录
        </Button>
      </div>

      <Table<ProjectChange>
        className={styles.table ?? ''}
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1000 }}
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
        title={editing ? '编辑修改记录' : '新建修改记录'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        destroyOnClose
        width={560}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入标题" maxLength={200} showCount />
          </Form.Item>
          <Form.Item
            name="date"
            label="日期"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker format="YYYY-MM-DD" placeholder="请选择日期" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="category_major"
            label="大类"
            rules={[{ required: true, message: '请选择大类' }]}
          >
            <Select
              placeholder="请选择大类"
              options={CHANGE_CATEGORY_MAJOR.map((c) => ({ value: c.value, label: c.label }))}
              onChange={handleMajorChange}
            />
          </Form.Item>
          <Form.Item
            name="category_minor"
            label={majorValue === 'other' ? '小类（自定义）' : '小类'}
            rules={[
              {
                required: true,
                message: majorValue === 'other' ? '请输入小类' : '请选择小类',
              },
            ]}
          >
            {majorValue === 'other' ? (
              <Input placeholder="请输入小类（自由填写）" maxLength={50} showCount />
            ) : (
              <Select placeholder="请选择小类" options={minorOptions} allowClear />
            )}
          </Form.Item>
          <Form.Item
            name="category_detail"
            label="详情"
            {...(majorValue === 'other'
              ? { rules: [{ required: true, message: '请输入详情' }] }
              : {})}
          >
            <Input
              placeholder={majorValue === 'other' ? '请输入详情' : '选填：具体文件/模块名'}
              maxLength={200}
              showCount
            />
          </Form.Item>
          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <TextArea rows={4} placeholder="请输入变更内容" maxLength={2000} showCount />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              placeholder="请选择状态"
              options={CHANGE_STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
