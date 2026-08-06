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
  QuestionCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { listProjects, deleteProject } from '../../api/projects';
import type { Project } from '../../types/project';
import { getVisibilityConfig } from '../../utils/visibility';
import ProjectForm from './ProjectForm';
import styles from './ProjectManagement.module.css';

const { Title, Paragraph, Text } = Typography;

// 状态标签配置
const STATUS_MAP: Record<string, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  ongoing: { color: 'processing', text: '进行中' },
  done: { color: 'success', text: '已完成' },
  archived: { color: 'warning', text: '已归档' },
};

export default function ProjectManagement() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // 弹窗状态
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [permissionVisible, setPermissionVisible] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listProjects({ page, page_size: pageSize, search });
      if (res.code === 0) {
        setProjects(res.data.items);
        setTotal(res.data.total);
      } else {
        message.error(res.msg || '获取项目列表失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取项目列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleCreate = () => {
    setFormMode('create');
    setEditingProject(null);
    setFormVisible(true);
  };

  const handleDelete = (project: Project) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除项目「${project.title}」吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteProject(project.id);
          if (res.code === 0) {
            message.success('项目已删除');
            fetchProjects();
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
    setEditingProject(null);
  };

  const handleFormSuccess = () => {
    setFormVisible(false);
    setEditingProject(null);
    fetchProjects();
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

  const columns: ColumnsType<Project> = [
    {
      title: '项目名称',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string, record: Project) => (
        <Button type="link" size="small" onClick={() => navigate(`/projects/${record.id}`)}>
          {text}
        </Button>
      ),
    },
    {
      title: '项目编号',
      dataIndex: 'project_id',
      key: 'project_id',
      ellipsis: true,
      render: (text: string | null) => text || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const cfg = STATUS_MAP[status] || { color: 'default', text: status };
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '可见性',
      dataIndex: 'visibility',
      key: 'visibility',
      render: (_: unknown, record: Project) => {
        const cfg = getVisibilityConfig(record.visibility);
        return (
          <Space direction="vertical" size={2}>
            <Tag color={cfg.color}>{cfg.text}</Tag>
            {record.visibility === 'restricted' && record.restricted_users && record.restricted_users.length > 0 && (
              <span style={{ fontSize: 'var(--text-body-xs-size)', color: 'var(--text-secondary)' }}>
                {record.restricted_users.length} 个用户
              </span>
            )}
          </Space>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => formatDate(text),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (text: string) => formatDate(text),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Project) => (
        <Space size="small">
          <Tooltip title="进入项目">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/projects/${record.id}`)}
            >
              进入
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
          项目管理
        </Title>
        <Space>
          <Input
            placeholder="搜索项目名称"
            prefix={<SearchOutlined style={{ color: 'var(--text-secondary)' }} />}
            allowClear
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            variant="filled"
            className={styles.searchInput ?? ''}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建项目
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

      <Table<Project>
        className={styles.table ?? ''}
        columns={columns}
        dataSource={projects}
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
        title="权限说明"
        open={permissionVisible}
        width={560}
        footer={null}
        onCancel={() => setPermissionVisible(false)}
        destroyOnClose
      >
        <div className={styles.permissionContent ?? ''}>
          <Title level={5}>
            项目负责人
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>拥有项目的最高管理权限，可以删除项目、修改项目基本信息、管理项目成员。</Paragraph>
          <Title level={5}>
            项目成员
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>可以编辑项目文档、创建新文档，但不能修改项目的基本信息。</Paragraph>
          <Title level={5}>
            可见范围
          </Title>
          <ul className={styles.permissionList ?? ''}>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                公开：所有成员都可以查看该项目
              </Text>
            </li>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                私有：仅项目负责人和项目成员可以查看
              </Text>
            </li>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                指定用户：仅被指定的用户可以看到该项目
              </Text>
            </li>
          </ul>
          <Title level={5}>
            管理员
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>系统管理员可以查看和管理所有项目。</Paragraph>
          <Title level={5}>
            创建权限
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>所有成员都可以创建项目，创建时需设定可见范围。</Paragraph>
        </div>
      </Modal>

      <ProjectForm
        visible={formVisible}
        mode={formMode}
        project={editingProject}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
