import { useState, useCallback } from 'react';
import {
  Steps,
  Button,
  Modal,
  Select,
  message,
  Card,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import {
  FileTextOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import type { Project, ProjectStatus } from '../../../types/project';

const { Text } = Typography;

// 状态流程定义
const STATUS_FLOW: { key: ProjectStatus; title: string; description: string; icon: React.ReactNode }[] = [
  {
    key: 'draft',
    title: '草稿',
    description: '项目初始状态',
    icon: <FileTextOutlined />,
  },
  {
    key: 'ongoing',
    title: '进行中',
    description: '项目正在执行',
    icon: <ThunderboltOutlined />,
  },
  {
    key: 'done',
    title: '已完成',
    description: '项目已完成',
    icon: <CheckCircleOutlined />,
  },
  {
    key: 'archived',
    title: '已归档',
    description: '项目已归档',
    icon: <InboxOutlined />,
  },
];

const STATUS_ORDER: Record<ProjectStatus, number> = {
  draft: 0,
  ongoing: 1,
  done: 2,
  archived: 3,
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: '草稿',
  ongoing: '进行中',
  done: '已完成',
  archived: '已归档',
};

interface ProjectProgressTabProps {
  project: Project;
  onUpdate: (data: Record<string, unknown>) => Promise<void>;
}

export default function ProjectProgressTab({ project, onUpdate }: ProjectProgressTabProps) {
  const [transitionModalVisible, setTransitionModalVisible] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 获取当前状态在流程中的索引
  const currentStepIndex = STATUS_FLOW.findIndex((s) => s.key === project.status);

  const handleTransition = useCallback(async () => {
    if (!selectedStatus) {
      message.warning('请选择目标状态');
      return;
    }

    const currentIdx = STATUS_ORDER[project.status];
    const targetIdx = STATUS_ORDER[selectedStatus];

    // 向前递进1步：直接成功
    if (targetIdx === currentIdx + 1) {
      await onUpdate({ status: selectedStatus });
      setTransitionModalVisible(false);
      setSelectedStatus(null);
      return;
    }

    // 向前跳步或回退：二次确认
    const isBackward = targetIdx < currentIdx;
    Modal.confirm({
      title: '确认状态变更',
      content: isBackward
        ? `确定要将项目状态从「${STATUS_LABELS[project.status]}」回退到「${STATUS_LABELS[selectedStatus]}」吗？`
        : `确定要将项目状态从「${STATUS_LABELS[project.status]}」直接跳至「${STATUS_LABELS[selectedStatus]}」吗？跳过中间步骤。`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        setSubmitting(true);
        try {
          await onUpdate({ status: selectedStatus });
          setTransitionModalVisible(false);
          setSelectedStatus(null);
        } catch {
          // 错误已在父组件处理
        } finally {
          setSubmitting(false);
        }
      },
    });
  }, [selectedStatus, project.status, onUpdate]);

  const openTransitionModal = useCallback(() => {
    setSelectedStatus(null);
    setTransitionModalVisible(true);
  }, []);

  return (
    <div>
      <Card
        title="项目状态流程"
        style={{ marginBottom: "var(--spacing-card-gap)" }}
        styles={{ body: { paddingTop: 10, paddingBottom: 10 } }}
      >
        <Steps
          current={currentStepIndex}
          items={STATUS_FLOW.map((item) => ({
            title: item.title,
            description: item.description,
            icon: item.icon,
          }))}
        />
      </Card>

      <Card
        title="状态变更"
        styles={{ body: { paddingTop: 10, paddingBottom: 10 } }}
        extra={
          <Button type="primary" onClick={openTransitionModal}>
            转换
          </Button>
        }
      >
        <div>
            <div style={{ marginBottom: 'var(--spacing-xs)', display: 'flex', alignItems: 'center' }}>
              <Text type="secondary" style={{ width: 80, flexShrink: 0 }}>当前状态：</Text>
              <Tag style={{ margin: 0 }}>{STATUS_LABELS[project.status]}</Tag>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Text type="secondary" style={{ width: 80, flexShrink: 0 }}>可转换为：</Text>
              <span>
                {STATUS_FLOW.filter(s => s.key !== project.status).map((s) => (
                  <Tag
                    key={s.key}
                    style={{ cursor: 'pointer', marginRight: 'var(--spacing-xxs)' }}
                    onClick={() => {
                      setSelectedStatus(s.key);
                      setTransitionModalVisible(true);
                    }}
                  >
                    {s.title}
                  </Tag>
                ))}
              </span>
            </div>
          </div>
      </Card>

       <Card
         title="状态变更历史"
         style={{ marginTop: "var(--spacing-card-gap)" }}
        styles={{ body: { maxHeight: 150, overflowY: 'auto' } }}
      >
        <Timeline
          items={[
            {
              color: 'green',
              children: (
                <Text style={{ fontSize: 'var(--text-body-xs-size)' }}>
                  创建 — 草稿 · <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>{new Date(project.created_at).toLocaleString('zh-CN')}</Text>
                </Text>
              ),
            },
            ...(project.status_log || [])
              .filter(entry => entry.from_status && entry.to_status)
              .map((entry) => {
                const fromIdx = STATUS_ORDER[entry.from_status as ProjectStatus] ?? 0;
                const toIdx = STATUS_ORDER[entry.to_status as ProjectStatus] ?? 0;
                const dotColor = toIdx > fromIdx + 1 ? 'red' : toIdx < fromIdx ? 'gray' : 'green';
                return {
                  color: dotColor as 'green' | 'red' | 'gray',
                  children: (
                    <Text style={{ fontSize: 'var(--text-body-xs-size)' }}>
                      {STATUS_LABELS[entry.from_status as ProjectStatus] || entry.from_status}
                      {' → '}
                      {STATUS_LABELS[entry.to_status as ProjectStatus] || entry.to_status}
                      {' · '}
                      <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>{new Date(entry.timestamp).toLocaleString('zh-CN')}</Text>
                    </Text>
                  ),
                };
              }),
            {
              color: 'blue',
              children: (
                <Text style={{ fontSize: 'var(--text-body-xs-size)' }}>
                  当前：{STATUS_LABELS[project.status]}
                </Text>
              ),
            },
          ]}
        />
      </Card>

      {/* 状态变更弹窗 */}
      <Modal
        title="转换项目状态"
        open={transitionModalVisible}
        onOk={handleTransition}
        onCancel={() => setTransitionModalVisible(false)}
        confirmLoading={submitting}
        destroyOnClose
        width={560}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <div style={{ marginBottom: "var(--spacing-card-gap)" }}>
          <Text>当前状态：</Text>
          <Text strong>{STATUS_LABELS[project.status]}</Text>
        </div>
        <div>
          <Text>目标状态：</Text>
          <Select
            style={{ width: '100%', marginTop: "var(--spacing-xs)" }}
            placeholder="请选择目标状态"
            value={selectedStatus}
            onChange={setSelectedStatus}
            options={STATUS_FLOW.filter(s => s.key !== project.status).map((s) => ({
              value: s.key,
              label: s.title,
            }))}
          />
        </div>
      </Modal>
    </div>
  );
}
