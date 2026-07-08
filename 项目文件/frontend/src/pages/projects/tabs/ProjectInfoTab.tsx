import { useState, useCallback } from 'react';
import {
  Descriptions,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Divider,
} from 'antd';
import { EditOutlined } from '@ant-design/icons';
import type { WorkRecord, RecordStatus } from '../../../types/record';
import type { Template } from '../../../types/template';
import { getVisibilityConfig, getVisibilityOptions } from '../../../utils/visibility';

// 状态标签配置
const STATUS_MAP: Record<RecordStatus, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  ongoing: { color: 'processing', text: '进行中' },
  done: { color: 'success', text: '已完成' },
  archived: { color: 'warning', text: '已归档' },
};

interface ProjectInfoTabProps {
  project: WorkRecord;
  template: Template | null;
  onUpdate: (data: Record<string, unknown>) => Promise<void>;
}

export default function ProjectInfoTab({ project, template, onUpdate }: ProjectInfoTabProps) {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const visibilityCfg = getVisibilityConfig(project.visibility);
  const statusCfg = STATUS_MAP[project.status] || { color: 'default', text: project.status };

  const handleEdit = useCallback(() => {
    form.setFieldsValue({
      title: project.title,
      visibility: project.visibility,
      restricted_users: project.restricted_users || [],
    });
    setEditModalVisible(true);
  }, [form, project]);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await onUpdate({
        title: values.title,
        visibility: values.visibility,
        restricted_users: values.visibility === 'restricted' ? values.restricted_users : undefined,
      });
      setEditModalVisible(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [form, onUpdate]);

  const visibilityOptions = getVisibilityOptions();

  return (
    <>
      <Descriptions
        bordered
        column={{ xs: 1, sm: 2 }}
        extra={
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={handleEdit}
          >
            编辑信息
          </Button>
        }
      >
        <Descriptions.Item label="项目名称">{project.title}</Descriptions.Item>
        <Descriptions.Item label="项目状态">
          <Tag color={statusCfg.color}>{statusCfg.text}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="项目类型">
          <Tag color="blue">{project.type === 'project' ? '项目' : '记录'}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="可见性">
          <Tag color={visibilityCfg.color}>{visibilityCfg.text}</Tag>
          {project.visibility === 'restricted' && project.restricted_users && project.restricted_users.length > 0 && (
            <span style={{ marginLeft: "var(--spacing-xs)", color: 'var(--text-secondary)', fontSize: 'var(--text-body-xs-size)' }}>
              {project.restricted_users.length} 个用户
            </span>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {new Date(project.created_at).toLocaleString('zh-CN')}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {new Date(project.updated_at).toLocaleString('zh-CN')}
        </Descriptions.Item>
      </Descriptions>

      {template && (
        <>
          <Divider>关联模板</Divider>
          <Descriptions bordered column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label="模板名称">{template.name}</Descriptions.Item>
            <Descriptions.Item label="模板分类">{template.category}</Descriptions.Item>
            <Descriptions.Item label="模板版本">v{template.version}</Descriptions.Item>
            <Descriptions.Item label="字段数量">{template.schema.length} 个字段</Descriptions.Item>
          </Descriptions>
        </>
      )}

      {/* 编辑弹窗 */}
      <Modal
        title="编辑项目信息"
        open={editModalVisible}
        onOk={handleSubmit}
        onCancel={() => setEditModalVisible(false)}
        confirmLoading={submitting}
        destroyOnClose
        width={560}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="请输入项目名称" maxLength={200} showCount />
          </Form.Item>
          <Form.Item
            name="visibility"
            label="可见性"
            rules={[{ required: true, message: '请选择可见性' }]}
          >
            <Select options={visibilityOptions} />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.visibility !== cur.visibility}
          >
            {({ getFieldValue }) =>
              getFieldValue('visibility') === 'restricted' && (
                <Form.Item
                  name="restricted_users"
                  label="指定用户"
                  tooltip="输入用户ID，按回车添加"
                >
                  <Select
                    mode="tags"
                    placeholder="输入用户ID"
                    tokenSeparators={[',']}
                  />
                </Form.Item>
              )
            }
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
