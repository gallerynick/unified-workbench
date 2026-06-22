import { useState, useCallback } from 'react';
import {
  Steps,
  Button,
  Modal,
  Select,
  message,
  Card,
  Timeline,
  Typography,
} from 'antd';
import {
  FileTextOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import type { WorkRecord, RecordStatus } from '../../../types/record';

const { Text } = Typography;

// 状态流程定义
const STATUS_FLOW: { key: RecordStatus; title: string; description: string; icon: React.ReactNode }[] = [
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

// 状态转换规则
const STATUS_TRANSITIONS: Record<RecordStatus, RecordStatus[]> = {
  draft: ['ongoing'],
  ongoing: ['done', 'draft'],
  done: ['archived', 'ongoing'],
  archived: ['done'],
};

const STATUS_LABELS: Record<RecordStatus, string> = {
  draft: '草稿',
  ongoing: '进行中',
  done: '已完成',
  archived: '已归档',
};

interface ProjectProgressTabProps {
  project: WorkRecord;
  onUpdate: (data: Record<string, unknown>) => Promise<void>;
}

export default function ProjectProgressTab({ project, onUpdate }: ProjectProgressTabProps) {
  const [transitionModalVisible, setTransitionModalVisible] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<RecordStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 获取当前状态在流程中的索引
  const currentStepIndex = STATUS_FLOW.findIndex((s) => s.key === project.status);

  // 获取可转换的状态
  const availableTransitions = STATUS_TRANSITIONS[project.status] || [];

  const handleTransition = useCallback(async () => {
    if (!selectedStatus) {
      message.warning('请选择目标状态');
      return;
    }

    Modal.confirm({
      title: '确认状态变更',
      content: `确定要将项目状态从「${STATUS_LABELS[project.status]}」变更为「${STATUS_LABELS[selectedStatus]}」吗？`,
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
      <Card title="项目状态流程" style={{ marginBottom: 16 }}>
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
        extra={
          availableTransitions.length > 0 && (
            <Button type="primary" onClick={openTransitionModal}>
              变更状态
            </Button>
          )
        }
      >
        {availableTransitions.length > 0 ? (
          <div>
            <Text type="secondary">
              当前状态：{STATUS_LABELS[project.status]}，可转换为：
            </Text>
            <div style={{ marginTop: 8 }}>
              {availableTransitions.map((status) => (
                <Button
                  key={status}
                  style={{ marginRight: 8 }}
                  onClick={() => {
                    setSelectedStatus(status);
                    setTransitionModalVisible(true);
                  }}
                >
                  {STATUS_LABELS[status]}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <Text type="secondary">当前状态没有可用的转换路径</Text>
        )}
      </Card>

      <Card title="状态变更历史" style={{ marginTop: 16 }}>
        <Timeline
          items={[
            {
              color: 'green',
              children: (
                <>
                  <Text strong>创建项目</Text>
                  <br />
                  <Text type="secondary">
                    {new Date(project.created_at).toLocaleString('zh-CN')}
                  </Text>
                </>
              ),
            },
            {
              color: 'blue',
              children: (
                <>
                  <Text strong>当前状态：{STATUS_LABELS[project.status]}</Text>
                  <br />
                  <Text type="secondary">
                    {new Date(project.updated_at).toLocaleString('zh-CN')}
                  </Text>
                </>
              ),
            },
          ]}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          注：完整的状态变更历史需要后端审计日志支持
        </Text>
      </Card>

      {/* 状态变更弹窗 */}
      <Modal
        title="变更项目状态"
        open={transitionModalVisible}
        onOk={handleTransition}
        onCancel={() => setTransitionModalVisible(false)}
        confirmLoading={submitting}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Text>当前状态：</Text>
          <Text strong>{STATUS_LABELS[project.status]}</Text>
        </div>
        <div>
          <Text>目标状态：</Text>
          <Select
            style={{ width: '100%', marginTop: 8 }}
            placeholder="请选择目标状态"
            value={selectedStatus}
            onChange={setSelectedStatus}
            options={availableTransitions.map((status) => ({
              value: status,
              label: STATUS_LABELS[status],
            }))}
          />
        </div>
      </Modal>
    </div>
  );
}
