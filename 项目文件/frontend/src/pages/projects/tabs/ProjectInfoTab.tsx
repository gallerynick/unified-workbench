import { useState, useCallback, useEffect } from 'react';
import {
  Descriptions,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Row,
  Col,
  message,
  Divider,
} from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { PROJECT_PRIORITY, PROJECT_TYPE, IS_OPEN_SOURCE, parseRelatedProjects } from '../../../constants/project';
import { listProjects } from '../../../api/projects';
import type { Project, ProjectStatus } from '../../../types/project';
import type { Template } from '../../../types/template';
import { getVisibilityConfig, Visibility } from '../../../utils/visibility';
import VisibilitySetting from '@/components/VisibilitySetting/VisibilitySetting';

const { TextArea } = Input;

// 状态标签配置
const STATUS_MAP: Record<ProjectStatus, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  ongoing: { color: 'processing', text: '进行中' },
  done: { color: 'success', text: '已完成' },
  archived: { color: 'warning', text: '已归档' },
};

const PRIORITY_MAP: Record<string, string> = {
  '立即': 'red',
  '重要': 'orange',
  '一般': 'blue',
  '最后': 'default',
  '待定': 'default',
};

const PROJECT_TYPE_MAP: Record<string, string> = PROJECT_TYPE.reduce<Record<string, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

interface ProjectInfoTabProps {
  project: Project;
  template?: Template | null;
  onUpdate: (data: Record<string, unknown>) => Promise<void>;
}

export default function ProjectInfoTab({ project, template, onUpdate }: ProjectInfoTabProps) {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [editVisibility, setEditVisibility] = useState<Visibility>('private');
  const [editRestrictedUsers, setEditRestrictedUsers] = useState<string[]>([]);
  const [editSourceOpen, setEditSourceOpen] = useState(false);
  const [projectOptions, setProjectOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    listProjects({ page: 1, page_size: 100 }).then((res) => {
      if (res.code === 0 && res.data) {
        const items = (res.data as { items?: Project[] }).items || [];
        setProjectOptions(
          (Array.isArray(items) ? items : [])
            .filter((p) => p.id !== project.id)
            .map((p) => ({ value: p.id, label: p.title || p.number || p.id }))
        );
      }
    }).catch(() => {});
  }, [project.id]);

  const statusCfg = STATUS_MAP[project.status] || { color: 'default', text: project.status };

  const handleEdit = useCallback(() => {
    form.setFieldsValue({
      title: project.title,
      department: project.department ?? undefined,
      language: project.language ?? undefined,
      is_open_source: project.is_open_source,
      repo_url: project.repo_url ?? undefined,
      priority: project.priority,
      project_type: project.project_type ?? undefined,
      goals: project.goals ?? undefined,
      requirements: project.requirements ?? undefined,
      additional_req: project.additional_req ?? undefined,
      modules: project.modules ?? undefined,
      related_projects: parseRelatedProjects(project.related_projects),
      dev_process: project.dev_process ?? undefined,
    });
    setEditVisibility(project.visibility);
    setEditRestrictedUsers(project.restricted_users || []);
    setEditSourceOpen(!!project.is_open_source);
    setEditModalVisible(true);
  }, [form, project]);

  useEffect(() => {
    if (editModalVisible) {
      setEditSourceOpen(!!project.is_open_source);
    }
  }, [editModalVisible, project.is_open_source]);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await onUpdate({
        title: values.title,
        visibility: editVisibility,
        restricted_users: editVisibility === 'restricted' ? editRestrictedUsers : undefined,
        ...(values.department ? { department: values.department } : {}),
        ...(values.language ? { language: values.language } : {}),
        is_open_source: values.is_open_source ?? false,
        repo_url: editSourceOpen ? (values.repo_url ?? null) : null,
        priority: values.priority || '待定',
        ...(values.project_type ? { project_type: values.project_type } : {}),
        ...(values.goals ? { goals: values.goals } : {}),
        ...(values.requirements ? { requirements: values.requirements } : {}),
        ...(values.additional_req ? { additional_req: values.additional_req } : {}),
        ...(values.modules ? { modules: values.modules } : {}),
        ...(values.related_projects && values.related_projects.length > 0 ? { related_projects: JSON.stringify(values.related_projects) } : {}),
        ...(values.dev_process ? { dev_process: values.dev_process } : {}),
      });
      setEditModalVisible(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [form, onUpdate, editVisibility, editRestrictedUsers, editSourceOpen]);

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
        <Descriptions.Item label="内容模块">
          <Tag color="blue">项目</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="可见性">
          <Tag color={getVisibilityConfig(project.visibility).color}>
            {getVisibilityConfig(project.visibility).text}
          </Tag>
          {project.visibility === 'restricted' && project.restricted_users && project.restricted_users.length > 0 && (
            <span style={{ marginLeft: "var(--spacing-xs)", color: 'var(--text-secondary)', fontSize: 'var(--text-body-xs-size)' }}>
              {project.restricted_users.length} 个用户
            </span>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="项目编号">{project.number || '-'}</Descriptions.Item>
        <Descriptions.Item label="所属团队">{project.department || '-'}</Descriptions.Item>
        <Descriptions.Item label="项目语言">{project.language || '-'}</Descriptions.Item>
        <Descriptions.Item label="是否开源">
          {project.is_open_source ? <Tag color="success">开源</Tag> : <Tag>闭源</Tag>}
        </Descriptions.Item>
        {project.is_open_source && project.repo_url && (
          <Descriptions.Item label="仓库地址">
            <a href={project.repo_url} target="_blank" rel="noopener noreferrer">{project.repo_url}</a>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="项目优先级">
          {project.priority ? <Tag color={PRIORITY_MAP[project.priority] || 'default'}>{project.priority}</Tag> : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="项目类型">
          {project.project_type ? PROJECT_TYPE_MAP[project.project_type] || project.project_type : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="项目目标">{project.goals || '-'}</Descriptions.Item>
        <Descriptions.Item label="项目需求">{project.requirements || '-'}</Descriptions.Item>
        {project.additional_req && (
          <Descriptions.Item label="附加需求">{project.additional_req}</Descriptions.Item>
        )}
        <Descriptions.Item label="模块划分">{project.modules || '-'}</Descriptions.Item>
        <Descriptions.Item label="关联项目">
          {(() => {
            const ids = parseRelatedProjects(project.related_projects);
            if (ids.length === 0) return '-';
            const names = ids.map((id) => projectOptions.find((o) => o.value === id)?.label || id);
            return names.join('、');
          })()}
        </Descriptions.Item>
        <Descriptions.Item label="开发流程">{project.dev_process || '-'}</Descriptions.Item>
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
        width={800}
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
          <Form.Item label="可见性">
            <VisibilitySetting
              value={editVisibility}
              restrictedUsers={editRestrictedUsers}
              onChange={setEditVisibility}
              onRestrictedUsersChange={setEditRestrictedUsers}
              showRestrictedTags={false}
            />
          </Form.Item>
          <Form.Item
            name="department"
            label="所属团队/部门"
          >
            <Input placeholder="所属团队或部门（可选）" maxLength={50} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="language"
                label="项目语言"
              >
                <Input placeholder="项目语言（可选）" maxLength={30} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="is_open_source"
                label="是否开源"
              >
                <Select
                  options={[...IS_OPEN_SOURCE]}
                  placeholder="是否开源"
                  onChange={(val) => setEditSourceOpen(val === true)}
                />
              </Form.Item>
            </Col>
          </Row>
          {editSourceOpen && (
            <Form.Item name="repo_url" label="仓库地址">
              <Input placeholder="请输入仓库地址" />
            </Form.Item>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="priority"
                label="项目优先级"
              >
                <Select options={[...PROJECT_PRIORITY]} placeholder="项目优先级" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="project_type"
                label="项目类型"
              >
                <Select options={[...PROJECT_TYPE]} placeholder="项目类型（可选）" allowClear />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="goals"
            label="项目目标"
          >
            <TextArea placeholder="项目目标（可选）" rows={3} />
          </Form.Item>
          <Form.Item
            name="requirements"
            label="项目需求"
          >
            <TextArea placeholder="项目需求（可选）" rows={3} />
          </Form.Item>
          <Form.Item
            name="additional_req"
            label="附加需求"
          >
            <TextArea placeholder="附加需求（可选）" rows={2} />
          </Form.Item>
          <Form.Item
            name="modules"
            label="模块划分"
          >
            <TextArea placeholder="模块划分（可选）" rows={2} />
          </Form.Item>
          <Form.Item
            name="related_projects"
            label="关联项目"
          >
            <Select
              mode="multiple"
              options={projectOptions}
              placeholder="选择关联项目（可多选，不含当前项目）"
              allowClear
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item
            name="dev_process"
            label="开发流程"
          >
            <TextArea placeholder="开发流程说明（可选）" rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
