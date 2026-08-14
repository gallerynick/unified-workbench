import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Input,
  Tag,
  Typography,
  message,
  Space,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { listProjects } from '../../api/projects';
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
      dataIndex: 'number',
      key: 'number',
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
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
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
      width: 140,
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
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={() => handleSearch(search)}
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
          <Title
            level={5}
            style={{ fontSize: 'var(--text-caption-strong-size)', fontWeight: 'bold' }}
          >
            项目负责人（owner）
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>最高权限——可管理项目信息、人员、进度、提案、待办、交流、修改、文档、事件全部分区，并可移交负责人。</Paragraph>
          <Title
            level={5}
            style={{ fontSize: 'var(--text-caption-strong-size)', fontWeight: 'bold' }}
          >
            项目成员（member_ids 中的人）
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>按成员权限配置（member_permissions）对每个分区获得查看或管理权限。默认可管理提案、待办、交流、修改、文档；信息、进度、人员、事件仅可查看。</Paragraph>
          <Title
            level={5}
            style={{ fontSize: 'var(--text-caption-strong-size)', fontWeight: 'bold' }}
          >
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
          <Title
            level={5}
            style={{ fontSize: 'var(--text-caption-strong-size)', fontWeight: 'bold' }}
          >
            管理员（admin）
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>系统管理员可以全权管理所有项目。</Paragraph>
          <Title
            level={5}
            style={{ fontSize: 'var(--text-caption-strong-size)', fontWeight: 'bold' }}
          >
            创建权限
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>任何成员都可以创建项目，创建者自动成为项目负责人。</Paragraph>
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
