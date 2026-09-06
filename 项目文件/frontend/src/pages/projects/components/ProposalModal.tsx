import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  message,
} from 'antd';

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { Project } from '../../../types/project';
import type {
  AttachmentLink,
  ProjectProposal,
  ProjectProposalCreate,
  ProjectProposalUpdate,
} from '../../../types/project-proposal';
import type { User } from '../../../types/user';
import { createProjectProposal, updateProjectProposal } from '../../../api/project-proposals';
import { listUsers } from '../../../api/users';
import {
  PROPOSAL_PRIORITY_OPTIONS,
  PROPOSAL_TYPE_OPTIONS,
  PROJECT_NUMBER_PREFIX,
} from '../../../constants/project';
import ContentEditor from '../../content/ContentEditor';
import { parseDescription, serializeDescription, wrapPlainTextToDoc } from './proposalDescription';

interface ProposalModalProps {
  project: Project;
  /** 控制弹窗显隐 */
  open: boolean;
  /** 非空表示编辑模式；null 表示新建 */
  editingProposal?: ProjectProposal | null;
  /** 项目现有提案（用于生成下一个编号） */
  existingProposals: ProjectProposal[];
  /** 新建时预关联的交流记录 id（如提案详情页的「新建并关联」） */
  initialMeetingId?: string | null;
  onClose: () => void;
  /** 保存成功回调（父组件刷新列表） */
  onSaved: () => void;
}

interface ProposalFormValues {
  title: string;
  type: string;
  priority: string;
  /** 富文本为 Tiptap doc JSON 对象；纯文本旧数据为字符串 */
  description?: Record<string, unknown> | string;
  attachment_links?: AttachmentLink[];
  assignee_id?: string;
}

const typeOptions = PROPOSAL_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
const priorityOptions = PROPOSAL_PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

/**
 * 生成提案编号：PRP-{项目编号}-{项目内序号}
 * 序号 = 现有列表中该前缀下最大序号 + 1
 */
function buildProposalNumber(project: Project, existing: ProjectProposal[]): string {
  const projTag = project.number ?? project.id.slice(0, 8).toUpperCase();
  const prefix = `${PROJECT_NUMBER_PREFIX.proposal}${projTag}-`;
  let maxSeq = 0;
  for (const p of existing) {
    if (p.number?.startsWith(prefix)) {
      const seq = parseInt(p.number.slice(prefix.length), 10);
      if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

/**
 * 项目提案 新建/编辑 共用弹窗
 *
 * 供「提案 Tab」（ProposalTab 新建）与「提案详情页」（ProposalDetailPage 编辑）复用，
 * 保证提案表单（含富文本描述、附件）全局一致，一处修改、多处以一。
 */
export default function ProposalModal({
  project,
  open,
  editingProposal = null,
  existingProposals,
  initialMeetingId,
  onClose,
  onSaved,
}: ProposalModalProps) {
  const [form] = Form.useForm<ProposalFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  // 打开弹窗时：重置表单、回填编辑值、加载执行人选项
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editingProposal) {
      const initValues: ProposalFormValues = {
        title: editingProposal.title,
        type: editingProposal.type,
        priority: editingProposal.priority,
        attachment_links: (editingProposal.attachment_links ?? []).map((l) =>
          typeof l === 'string' ? { url: l, description: '' } : l,
        ),
      };
      if (editingProposal.description) {
        const doc = parseDescription(editingProposal.description);
        initValues.description = doc ?? wrapPlainTextToDoc(editingProposal.description);
      }
      if (editingProposal.assignee_id) initValues.assignee_id = editingProposal.assignee_id;
      form.setFieldsValue(initValues);
    } else {
      form.setFieldsValue({ type: 'feature', priority: 'P2', attachment_links: [] });
    }

    listUsers({ page_size: 100 }).then((res) => {
      if (res.code === 0) setUsers(res.data.items);
    }).catch(() => {});
  }, [open, editingProposal, form]);

  const userOptions = useMemo(() => users.map((u) => ({
    value: u.id,
    label: u.username ? `${u.nickname} (${u.username})` : u.nickname,
  })), [users]);

  const handleSubmit = async () => {
    let values: ProposalFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验未通过，Modal 会显示错误
    }
    setSubmitting(true);
    try {
      const descriptionPayload = serializeDescription(values.description);
      const common = {
        title: values.title.trim(),
        type: values.type,
        priority: values.priority,
        ...(descriptionPayload ? { description: descriptionPayload } : {}),
        attachment_links: (values.attachment_links ?? [])
          .map((l) => ({ url: (l.url ?? '').trim(), description: (l.description ?? '').trim() }))
          .filter((l) => l.url.length > 0),
        ...(values.assignee_id ? { assignee_id: values.assignee_id } : {}),
      };

      if (editingProposal) {
        const payload: ProjectProposalUpdate = { ...common };
        const res = await updateProjectProposal(editingProposal.id, payload);
        if (res.code === 0) {
          message.success('提案已更新');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '更新提案失败');
        }
      } else {
        const payload: ProjectProposalCreate = {
          project_id: project.id,
          number: buildProposalNumber(project, existingProposals),
          ...common,
          ...(initialMeetingId ? { meeting_id: initialMeetingId } : {}),
        };
        const res = await createProjectProposal(payload);
        if (res.code === 0) {
          message.success('提案已创建');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '创建提案失败');
        }
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '保存提案失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={editingProposal ? '编辑提案' : '新建提案'}
      open={open}
      onOk={() => void handleSubmit()}
      onCancel={onClose}
      confirmLoading={submitting}
      okText="保存"
      cancelText="取消"
      destroyOnClose
      width={640}
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="title"
          label="标题"
          rules={[{ required: true, message: '请输入提案标题' }]}
        >
          <Input placeholder="请输入提案标题" maxLength={200} showCount />
        </Form.Item>
        <Form.Item
          name="type"
          label="类型"
          rules={[{ required: true, message: '请选择提案类型' }]}
        >
          <Select options={typeOptions} />
        </Form.Item>
        <Form.Item
          name="priority"
          label="优先级"
          rules={[{ required: true, message: '请选择优先级' }]}
        >
          <Select options={priorityOptions} />
        </Form.Item>
        <Form.Item name="description" label="描述" getValueFromEvent={(v) => v}>
          <ContentEditor placeholder="请输入提案描述" minHeight={160} />
        </Form.Item>
        <Form.Item name="assignee_id" label="执行人" tooltip="从工作台用户中选择（可选）">
          <Select
            allowClear
            showSearch
            placeholder="选择执行人（可选）"
            optionFilterProp="label"
            options={userOptions}
          />
        </Form.Item>
        <Form.List name="attachment_links">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field, index) => (
                <Form.Item
                  key={field.key}
                  label={index === 0 ? '附件' : ' '}
                  required={false}
                  style={{ marginBottom: 'var(--spacing-xs)' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xxs)' }}>
                    <Space style={{ display: 'flex', width: '100%' }}>
                      <Form.Item
                        name={[field.name, 'url']}
                        noStyle
                        rules={[{ type: 'url', message: '请输入合法的 URL' }]}
                      >
                        <Input placeholder="附件地址 https://..." style={{ flex: 1 }} />
                      </Form.Item>
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label="删除附件"
                        onClick={() => remove(field.name)}
                      />
                    </Space>
                    <Form.Item name={[field.name, 'description']} noStyle>
                      <Input placeholder="附件说明（可选）" />
                    </Form.Item>
                  </div>
                </Form.Item>
              ))}
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => add({ url: '', description: '' })}
                block
              >
                添加附件
              </Button>
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
}
