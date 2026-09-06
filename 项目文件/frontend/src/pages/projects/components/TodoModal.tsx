import { useEffect, useMemo, useState } from 'react';
import {
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  message,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { Project } from '../../../types/project';
import type { ProjectTodo, ProjectTodoCreate, ProjectTodoUpdate } from '../../../types/project-todo';
import type { User } from '../../../types/user';
import type { ProjectProposal } from '../../../types/project-proposal';
import { createProjectTodo, updateProjectTodo } from '../../../api/project-todos';
import { listProjectProposals } from '../../../api/project-proposals';
import { listUsers } from '../../../api/users';
import { PROJECT_NUMBER_PREFIX, TODO_PRIORITY_OPTIONS } from '../../../constants/project';

const { TextArea } = Input;

interface TodoModalProps {
  project: Project;
  /** 控制弹窗显隐 */
  open: boolean;
  /** 非空表示编辑模式；null 表示新建 */
  editingTodo?: ProjectTodo | null;
  /** 项目现有待办（用于生成下一个编号） */
  existingTodos: ProjectTodo[];
  /** 新建时预关联的提案 id（如提案详情页的「新建并关联」） */
  initialProposalId?: string | null;
  /** 新建时预关联的交流记录 id（如待办详情页的「新建并关联」） */
  initialMeetingId?: string | null;
  onClose: () => void;
  /** 保存成功回调（父组件刷新列表） */
  onSaved: () => void;
}

interface TodoFormValues {
  title: string;
  description?: string;
  priority?: string;
  assignee_id?: string;
  proposal_id?: string;
  meeting_id?: string;
  due_date?: Dayjs;
}

const PRIORITY_OPTIONS = [...TODO_PRIORITY_OPTIONS];

/**
 * 生成待办编号：TOD-{项目编号}-{项目内序号}
 * 序号 = 现有列表中该前缀下最大序号 + 1
 */
function buildTodoNumber(project: Project, existing: ProjectTodo[]): string {
  const projTag = project.number ?? project.id.slice(0, 8).toUpperCase();
  const prefix = `${PROJECT_NUMBER_PREFIX.todo}${projTag}-`;
  let maxSeq = 0;
  for (const t of existing) {
    if (t.number?.startsWith(prefix)) {
      const seq = parseInt(t.number.slice(prefix.length), 10);
      if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

/**
 * 项目待办 新建/编辑 共用弹窗
 *
 * 供「待办任务 Tab」（TodoTaskTab）与「提案详情页一键新建并关联」复用，
 * 保证新建待办的表单与逻辑全局一致，后续只需修改此处一处。
 */
export default function TodoModal({
  project,
  open,
  editingTodo = null,
  existingTodos,
  initialProposalId,
  initialMeetingId,
  onClose,
  onSaved,
}: TodoModalProps) {
  const [form] = Form.useForm<TodoFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [proposals, setProposals] = useState<ProjectProposal[]>([]);

  // 打开弹窗时：重置表单、回填编辑值、加载执行人/提案选项
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editingTodo) {
      form.setFieldsValue({
        title: editingTodo.title,
        priority: editingTodo.priority,
        ...(editingTodo.description ? { description: editingTodo.description } : {}),
        ...(editingTodo.assignee_id ? { assignee_id: editingTodo.assignee_id } : {}),
        ...(editingTodo.proposal_id ? { proposal_id: editingTodo.proposal_id } : {}),
        ...(editingTodo.due_date ? { due_date: dayjs(editingTodo.due_date) } : {}),
      });
    } else {
      form.setFieldsValue({ priority: 'P2' });
      if (initialProposalId) form.setFieldsValue({ proposal_id: initialProposalId });
      if (initialMeetingId) form.setFieldsValue({ meeting_id: initialMeetingId });
    }

    listUsers({ page_size: 100 }).then((res) => {
      if (res.code === 0) setUsers(res.data.items);
    }).catch(() => {});
    listProjectProposals({ project_id: project.id, page_size: 100 }).then((res) => {
      if (res.code === 0) setProposals(res.data.items);
    }).catch(() => {});
  }, [open, editingTodo, form, project.id, initialProposalId, initialMeetingId]);

  const userOptions = useMemo(() => users.map((u) => ({
    value: u.id,
    label: u.username ? `${u.nickname} (${u.username})` : u.nickname,
  })), [users]);

  const proposalOptions = useMemo(() => proposals.map((p) => ({
    value: p.id,
    label: `${p.number} ${p.title}`,
  })), [proposals]);

  const handleSubmit = async () => {
    let values: TodoFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验未通过，Modal 会显示错误
    }
    setSubmitting(true);
    try {
      if (editingTodo) {
        const payload: ProjectTodoUpdate = {
          title: values.title,
          ...(values.description?.trim() ? { description: values.description.trim() } : {}),
          ...(values.priority ? { priority: values.priority } : {}),
          ...(values.assignee_id ? { assignee_id: values.assignee_id } : {}),
          ...(values.proposal_id ? { proposal_id: values.proposal_id } : {}),
          ...(values.due_date ? { due_date: values.due_date.format('YYYY-MM-DD') } : {}),
        };
        const res = await updateProjectTodo(editingTodo.id, payload);
        if (res.code === 0) {
          message.success('待办已更新');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '更新待办失败');
        }
      } else {
        const payload: ProjectTodoCreate = {
          project_id: project.id,
          number: buildTodoNumber(project, existingTodos),
          title: values.title,
          priority: values.priority ?? 'P2',
          status: 'pending',
          ...(values.description?.trim() ? { description: values.description.trim() } : {}),
          ...(values.assignee_id ? { assignee_id: values.assignee_id } : {}),
          ...(values.proposal_id ? { proposal_id: values.proposal_id } : {}),
          ...(initialMeetingId ? { meeting_id: initialMeetingId } : {}),
          ...(values.due_date ? { due_date: values.due_date.format('YYYY-MM-DD') } : {}),
        };
        const res = await createProjectTodo(payload);
        if (res.code === 0) {
          message.success('待办已创建');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '创建待办失败');
        }
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '保存待办失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={editingTodo ? '编辑待办' : '新建待办'}
      open={open}
      onOk={() => void handleSubmit()}
      onCancel={onClose}
      confirmLoading={submitting}
      okText="保存"
      cancelText="取消"
      destroyOnClose
      width={560}
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="title"
          label="标题"
          rules={[{ required: true, message: '请输入待办标题' }]}
        >
          <Input placeholder="请输入待办标题" maxLength={200} showCount />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <TextArea placeholder="请输入描述（可选）" rows={3} maxLength={2000} showCount />
        </Form.Item>
        <Form.Item name="priority" label="优先级">
          <Select options={PRIORITY_OPTIONS} />
        </Form.Item>
        <Form.Item name="assignee_id" label="执行人">
          <Select
            placeholder="选择执行人（可选）"
            allowClear
            showSearch
            optionFilterProp="label"
            options={userOptions}
          />
        </Form.Item>
        <Form.Item name="due_date" label="截止日期">
          <DatePicker style={{ width: '100%' }} placeholder="选择截止日期（可选）" />
        </Form.Item>
        <Form.Item name="proposal_id" label="关联提案">
          <Select
            placeholder="选择关联提案（可选）"
            allowClear
            showSearch
            optionFilterProp="label"
            options={proposalOptions}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}