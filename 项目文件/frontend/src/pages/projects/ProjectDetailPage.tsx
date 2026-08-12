import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Tabs,
  Typography,
  Spin,
  message,
  Button,
  Space,
  Tag,
} from 'antd';
import {
  ArrowLeftOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import { getProject, updateProject } from '../../api/projects';
import type { Project } from '../../types/project';
import { getVisibilityConfig } from '../../utils/visibility';
import ProjectInfoTab from './tabs/ProjectInfoTab';
import ProjectMemberTab from './tabs/ProjectMemberTab';
import ProjectProgressTab from './tabs/ProjectProgressTab';
import ProposalTab from './tabs/ProposalTab';
import TodoTaskTab from './tabs/TodoTaskTab';
import MeetingRecordTab from './tabs/MeetingRecordTab';
import ChangeRecordTab from './tabs/ChangeRecordTab';
import ProjectDocumentTab from './tabs/ProjectDocumentTab';
import ProjectEventTab from './tabs/ProjectEventTab';
import styles from './ProjectDetailPage.module.css';

const { Title } = Typography;

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProject = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getProject(id);
      if (res.code === 0) {
        setProject(res.data);
      } else {
        message.error(res.msg || '获取项目详情失败');
        navigate('/projects');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取项目详情失败';
      message.error(msg);
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleUpdate = useCallback(
    async (data: Record<string, unknown>) => {
      if (!id) return;
      try {
        const res = await updateProject(id, data);
        if (res.code === 0) {
          setProject(res.data);
          message.success('更新成功');
        } else {
          message.error(res.msg || '更新失败');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '更新失败';
        message.error(msg);
      }
    },
    [id],
  );

  const handleBack = () => {
    navigate('/projects');
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const tabItems = [
    {
      key: 'info',
      label: '项目信息',
      children: (
        <ProjectInfoTab
          project={project}
          onUpdate={handleUpdate}
        />
      ),
    },
    {
      key: 'member',
      label: '项目人员',
      children: (
        <ProjectMemberTab
          project={project}
          onUpdate={handleUpdate}
        />
      ),
    },
    {
      key: 'progress',
      label: '项目进度',
      children: (
        <ProjectProgressTab
          project={project}
          onUpdate={handleUpdate}
        />
      ),
    },
    {
      key: 'proposal',
      label: '项目提案',
      children: (
        <ProposalTab project={project} />
      ),
    },
    {
      key: 'todo',
      label: '待办任务',
      children: (
        <TodoTaskTab project={project} />
      ),
    },
    {
      key: 'meeting',
      label: '交流记录',
      children: (
        <MeetingRecordTab project={project} />
      ),
    },
    {
      key: 'change',
      label: '修改记录',
      children: (
        <ChangeRecordTab project={project} />
      ),
    },
    {
      key: 'document',
      label: '项目文档',
      children: (
        <ProjectDocumentTab
          project={project}
          onUpdate={handleUpdate}
        />
      ),
    },
    {
      key: 'event',
      label: '项目事件',
      children: (
        <ProjectEventTab project={project} />
      ),
    },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
          >
            返回
          </Button>
          <Title level={4} className={styles.title ?? ''}>
            {project.title}
          </Title>
          <Tag color={getVisibilityConfig(project.visibility).color}>
            {getVisibilityConfig(project.visibility).text}
          </Tag>
        </Space>
        <Button
          icon={<ExportOutlined />}
          onClick={() => {
            message.info('导出功能开发中');
          }}
        >
          导出项目
        </Button>
      </div>

      <Card>
        <Tabs
          defaultActiveKey="info"
          items={tabItems}
        />
      </Card>
    </div>
  );
}
