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
import type {
  ProjectMeeting,
  ProjectMeetingCreate,
  ProjectMeetingUpdate,
} from '../../../types/project-meeting';
import type { User } from '../../../types/user';
import { createProjectMeeting, updateProjectMeeting } from '../../../api/project-meetings';
import { listUsers } from '../../../api/users';
import { MEETING_TYPE_OPTIONS, PROJECT_NUMBER_PREFIX } from '../../../constants/project';

const { TextArea } = Input;

interface MeetingModalProps {
  project: Project;
  /** 控制弹窗显隐 */
  open: boolean;
  /** 非空表示编辑模式；null 表示新建 */
  editingMeeting?: ProjectMeeting | null;
  /** 项目现有交流记录（用于生成下一个编号） */
  existingMeetings: ProjectMeeting[];
  /** 新建时预关联的提案 id（如提案详情页的「新建并关联」） */
  initialProposalId?: string | null;
  /** 新建时预关联的待办 id */
  initialTodoId?: string | null;
  onClose: () => void;
  /** 保存成功回调（父组件刷新列表） */
  onSaved: () => void;
}

interface MeetingFormValues {
  type: string;
  title: string;
  /** 正文（可选）；后端按「标题\n\n正文」存于 content */
  body?: string;
  started_at?: Dayjs;
  speaker?: string;
  participants?: string[];
}

/**
 * 生成交流记录编号：MTG-{项目编号}-{项目内序号}
 * 序号 = 现有列表中该前缀下最大序号 + 1
 */
function buildMeetingNumber(project: Project, existing: ProjectMeeting[]): string {
  const projTag = project.number ?? project.id.slice(0, 8).toUpperCase();
  const prefix = `${PROJECT_NUMBER_PREFIX.meeting}${projTag}-`;
  let maxSeq = 0;
  for (const m of existing) {
    if (m.number?.startsWith(prefix)) {
      const seq = parseInt(m.number.slice(prefix.length), 10);
      if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

/**
 * 内容字段约定：后端无独立 title 字段，按「标题\n\n正文」存储于 content。
 * 表单「内容」字段编辑标题部分，「正文」字段编辑正文部分，正文为空时不写入分隔符。
 */
export function splitTitleContent(content: string | null): { title: string; body: string } {
  const raw = content ?? '';
  const idx = raw.indexOf('\n\n');
  if (idx === -1) return { title: raw, body: '' };
  return { title: raw.slice(0, idx).trim(), body: raw.slice(idx + 2) };
}

/**
 * 项目交流记录 新建/编辑 共用弹窗
 *
 * 供「交流记录 Tab」（MeetingRecordTab）与「提案详情页一键新建并关联」复用，
 * 保证新建交流的表单与逻辑全局一致，后续只需修改此处一处。
 */
export default function MeetingModal({
  project,
  open,
  editingMeeting = null,
  existingMeetings,
  initialProposalId,
  initialTodoId,
  onClose,
  onSaved,
}: MeetingModalProps) {
  const [form] = Form.useForm<MeetingFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  // 打开弹窗时：重置表单、回填编辑值、加载发言人/参与者用户选项
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editingMeeting) {
      const { title, body } = splitTitleContent(editingMeeting.content);
      form.setFieldsValue({
        type: editingMeeting.type,
        title,
        body,
        ...(editingMeeting.started_at ? { started_at: dayjs(editingMeeting.started_at) } : {}),
        ...(editingMeeting.speaker ? { speaker: editingMeeting.speaker } : {}),
        ...(editingMeeting.participants?.length ? { participants: editingMeeting.participants } : {}),
      });
    } else {
      form.setFieldsValue({ type: '会议纪要', started_at: dayjs() });
    }

    listUsers({ page_size: 100 }).then((res) => {
      if (res.code === 0) setUsers(res.data.items);
    }).catch(() => {});
  }, [open, editingMeeting, form]);

  const userOptions = useMemo(() => users.map((u) => ({
    value: u.id,
    label: u.username ? `${u.nickname} (${u.username})` : u.nickname,
  })), [users]);

  const handleSubmit = async () => {
    let values: MeetingFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验未通过，Modal 会显示错误
    }
    setSubmitting(true);
    try {
      if (editingMeeting) {
        // 编辑模式：标题与正文均取自表单，避免与旧数据混写
        const title = values.title?.trim() ?? '';
        const body = values.body?.trim() ?? '';
        const content = body ? `${title}\n\n${body}` : title;
        const payload: ProjectMeetingUpdate = {
          type: values.type,
          started_at: values.started_at?.toISOString() ?? new Date().toISOString(),
          ...(values.speaker?.trim() ? { speaker: values.speaker.trim() } : { speaker: null }),
          ...(values.participants?.length ? { participants: values.participants } : { participants: [] }),
          content,
        };
        const res = await updateProjectMeeting(editingMeeting.id, payload);
        if (res.code === 0) {
          message.success('交流记录已更新');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '更新交流记录失败');
        }
      } else {
        const payload: ProjectMeetingCreate = {
          project_id: project.id,
          number: buildMeetingNumber(project, existingMeetings),
          type: values.type ?? '会议纪要',
          started_at: values.started_at?.toISOString() ?? new Date().toISOString(),
          ...(values.speaker?.trim() ? { speaker: values.speaker.trim() } : {}),
          ...(values.participants?.length ? { participants: values.participants } : {}),
          content: (() => {
            const title = values.title?.trim() ?? '';
            const body = values.body?.trim() ?? '';
            return body ? `${title}\n\n${body}` : title;
          })(),
          ...(initialProposalId ? { proposal_id: initialProposalId } : {}),
          ...(initialTodoId ? { todo_id: initialTodoId } : {}),
        };
        const res = await createProjectMeeting(payload);
        if (res.code === 0) {
          message.success('交流记录已创建');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '创建交流记录失败');
        }
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '保存交流记录失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={editingMeeting ? '编辑交流记录' : '新建交流记录'}
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
        <Form.Item name="type" label="类型">
          <Select options={[...MEETING_TYPE_OPTIONS]} />
        </Form.Item>
        <Form.Item
          name="title"
          label="内容"
          rules={[{ required: true, message: '请输入交流内容' }]}
        >
          <TextArea rows={3} placeholder="请输入交流内容（标题）" maxLength={500} showCount />
        </Form.Item>
        <Form.Item name="body" label="正文">
          <TextArea
            rows={6}
            placeholder="请输入交流正文（可选，换行保留）"
            maxLength={5000}
            showCount
          />
        </Form.Item>
        <Form.Item name="started_at" label="时间">
          <DatePicker showTime style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="speaker" label="发言人">
          <Input placeholder="请输入发言人（可选）" maxLength={100} />
        </Form.Item>
        <Form.Item name="participants" label="参与人">
          <Select
            mode="multiple"
            placeholder="选择参与人（可选）"
            allowClear
            showSearch
            optionFilterProp="label"
            options={userOptions}
            maxTagCount="responsive"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
