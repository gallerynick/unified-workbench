import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Select,
  Tag,
  Space,
  Modal,
  Input,
  message,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  listProjectChanges,
  deleteProjectChange,
  type ProjectChangeListParams,
} from '../../../api/project-changes';
import type { ProjectChange } from '../../../types/project-change';
import type { Project } from '../../../types/project';
import { CHANGE_CATEGORY_MAJOR, CHANGE_CATEGORY_MINOR_MAP } from '../../../constants/project';
import { getUserId, isAdmin } from '../../../utils/auth';
import { useUser } from '../../../contexts/UserContext';
import ChangeModal from '../components/ChangeModal';
import styles from './ChangeRecordTab.module.css';

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
  const { user } = useUser();
  const navigate = useNavigate();
  const [items, setItems] = useState<ProjectChange[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [majorFilter, setMajorFilter] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState('');

  // 弹窗状态（表单与提交逻辑由共用组件 ChangeModal 内部承载）
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<ProjectChange | null>(null);

  // 权限：负责人/管理员全权限；成员按 member_permissions 的 changes 分区，readonly 时禁用操作
  const currentUserId = getUserId();
  const isAdminUser = isAdmin();
  const isOwner = !!currentUserId && currentUserId === project.owner_id;
  const changesPermission = project.member_permissions?.[user?.id ?? '']?.['changes'] ?? '';
  const changesApprover = !!user && project.member_permissions?.[user?.id ?? '']?.changes_approver === true;
  const isProjectOwner = !!user && project.owner_id === user?.id;
  const canCreateChange = isAdminUser || isOwner || changesPermission === 'create';
  const canManageChange = isAdminUser || isOwner || changesApprover;
  const canApproveChange = isAdminUser || isProjectOwner || changesApprover;

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

  const filteredItems = useMemo(() => {
    const kw = searchText.trim().toLowerCase();
    if (!kw) return items;
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(kw) ||
        (it.category_detail ?? '').toLowerCase().includes(kw) ||
        it.number.toLowerCase().includes(kw),
    );
  }, [items, searchText]);

  const openCreate = () => {
    setEditing(null);
    setModalVisible(true);
  };

  const openEdit = (record: ProjectChange) => {
    setEditing(record);
    setModalVisible(true);
  };

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setEditing(null);
  }, []);

  const handleDelete = (record: ProjectChange) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除修改记录「${record.number} ${record.title}」吗？此操作不可恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
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
      width: 140,
      render: (text: string, record: ProjectChange) => (
        <a
          onClick={() => {
            if (project) navigate(`/projects/${project.id}/change/${record.id}`);
          }}
          style={{ fontFamily: 'var(--font-mono)', cursor: 'pointer' }}
        >
          {text}
        </a>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 160,
      ellipsis: true,
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 100,
      render: (text: string) => formatDateOnly(text),
    },
    {
      title: '大类',
      dataIndex: 'category_major',
      key: 'category_major',
      width: 70,
      render: (value: string) => (
        <Tag color={MAJOR_TAG_COLOR[value] ?? 'default'}>{getMajorLabel(value)}</Tag>
      ),
    },
    {
      title: '小类',
      key: 'category_minor',
      width: 130,
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
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, record: ProjectChange) =>
        canManageChange ? (
          <Space size="small">
            <Tooltip title="编辑修改记录">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                aria-label="编辑修改记录"
                onClick={() => openEdit(record)}
              />
            </Tooltip>
            <Tooltip title="删除修改记录">
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label="删除修改记录"
                onClick={() => handleDelete(record)}
              />
            </Tooltip>
          </Space>
        ) : null,
    },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Space>
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
          <Input
            className={styles.searchInput ?? ''}
            variant="filled"
            placeholder="搜索修改记录..."
            prefix={<SearchOutlined style={{ color: 'var(--text-secondary)' }} />}
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setPage(1);
            }}
            allowClear
          />
        </Space>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
            disabled={!canCreateChange}
          >
            新建记录
          </Button>
        </Space>
      </div>

      <Table<ProjectChange>
        className={styles.table ?? ''}
        columns={columns}
        dataSource={filteredItems}
        rowKey="id"
        loading={loading}
        scroll={{ x: 800 }}
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

      {/* 新建/编辑修改记录（共用组件 ChangeModal） */}
      <ChangeModal
        project={project}
        open={modalVisible}
        editingChange={editing}
        existingChanges={items}
        canApproveChange={canApproveChange}
        onClose={handleCloseModal}
        onSaved={fetchList}
      />
    </div>
  );
}