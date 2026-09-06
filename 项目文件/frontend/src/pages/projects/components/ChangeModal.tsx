import { useEffect, useMemo, useState } from 'react';
import {
  AutoComplete,
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
  ProjectChange,
  ProjectChangeCreate,
  ProjectChangeUpdate,
} from '../../../types/project-change';
import { createProjectChange, updateProjectChange } from '../../../api/project-changes';
import {
  CHANGE_CATEGORY_MAJOR,
  CHANGE_CATEGORY_MINOR_MAP,
  PROJECT_NUMBER_PREFIX,
} from '../../../constants/project';

const { TextArea } = Input;

interface ChangeModalProps {
  project: Project;
  /** 控制弹窗显隐 */
  open: boolean;
  /** 非空表示编辑模式；null 表示新建 */
  editingChange?: ProjectChange | null;
  /** 项目现有修改记录（用于生成下一个编号） */
  existingChanges: ProjectChange[];
  /** 当前用户是否可审批（决定「已采纳/已拒绝」状态是否可选） */
  canApproveChange: boolean;
  onClose: () => void;
  /** 保存成功回调（父组件刷新列表） */
  onSaved: () => void;
}

interface ChangeFormValues {
  title: string;
  date: Dayjs;
  category_major: string;
  category_minor?: string;
  category_detail?: string;
  content: string;
  status?: string;
}

/** 修改记录状态选项（对应后端 status: pending/approved/rejected） */
const CHANGE_STATUS_OPTIONS = [
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已采纳' },
  { value: 'rejected', label: '已拒绝' },
] as const;

function getMajorLabel(value: string): string {
  return CHANGE_CATEGORY_MAJOR.find((c) => c.value === value)?.label ?? value;
}

function getMinorLabel(major: string, minor: string | null): string {
  if (!minor) return '';
  const options = CHANGE_CATEGORY_MINOR_MAP[major];
  return options?.find((o) => o.value === minor)?.label ?? minor;
}

/**
 * 生成变更编号：CHG-{项目编号}-{项目内序号}
 * 序号 = 现有列表中该前缀下最大序号 + 1
 */
function buildChangeNumber(project: Project, existing: ProjectChange[]): string {
  const projTag = project.number ?? project.id.slice(0, 8).toUpperCase();
  const prefix = `${PROJECT_NUMBER_PREFIX.change}${projTag}-`;
  let maxSeq = 0;
  for (const t of existing) {
    if (t.number.startsWith(prefix)) {
      const seq = parseInt(t.number.slice(prefix.length), 10);
      if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

/**
 * 项目修改记录 新建/编辑 共用弹窗
 *
 * 供「修改记录 Tab」（ChangeRecordTab）复用，
 * 保证新建/编辑修改记录的表单（含主/次分类级联选择）与逻辑全局一致，
 * 后续只需修改此处一处。
 */
export default function ChangeModal({
  project,
  open,
  editingChange = null,
  existingChanges,
  canApproveChange,
  onClose,
  onSaved,
}: ChangeModalProps) {
  const [form] = Form.useForm<ChangeFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const majorValue = Form.useWatch('category_major', form);

  // 打开弹窗时：重置表单、回填编辑值
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editingChange) {
      form.setFieldsValue({
        title: editingChange.title,
        category_major: editingChange.category_major,
        content: editingChange.content ?? '',
        status: editingChange.status,
        ...(editingChange.date ? { date: dayjs(editingChange.date) } : {}),
        ...(editingChange.category_minor ? { category_minor: editingChange.category_minor } : {}),
        ...(editingChange.category_detail ? { category_detail: editingChange.category_detail } : {}),
      });
    } else {
      form.setFieldsValue({
        status: 'pending',
        category_major: 'code',
        date: dayjs(),
      });
    }
  }, [open, editingChange, form]);

  const minorOptions = useMemo(
    () => CHANGE_CATEGORY_MINOR_MAP[majorValue ?? ''] ?? [],
    [majorValue],
  );

  /** 大类切换时重置小类（编辑/新建共用） */
  const handleMajorChange = (value: string) => {
    form.setFieldValue('category_minor', undefined);
    if (value === 'other') {
      form.setFieldValue('category_detail', undefined);
    }
  };

  const handleSubmit = async () => {
    let values: ChangeFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验未通过，Modal 会显示错误
    }
    setSubmitting(true);
    try {
      const title = values.title;
      const date = values.date.format('YYYY-MM-DDTHH:mm:ss');
      const category_major = values.category_major;
      const content = values.content;
      const status = values.status ?? 'pending';
      // 权限：非审批人不得将状态置为「已采纳/已拒绝」
      if ((status === 'approved' || status === 'rejected') && !canApproveChange) {
        message.error('您没有权限将修改记录标记为已采纳或已拒绝');
        return;
      }
      const category_minor = values.category_minor;
      const category_detail = values.category_detail;

      if (editingChange) {
        const payload: ProjectChangeUpdate = {
          title,
          date,
          category_major,
          content,
          status,
        };
        if (category_minor) payload.category_minor = category_minor;
        if (category_detail) payload.category_detail = category_detail;
        const res = await updateProjectChange(editingChange.id, payload);
        if (res.code === 0) {
          message.success('修改记录已更新');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '更新失败');
        }
      } else {
        const payload: ProjectChangeCreate = {
          project_id: project.id,
          number: buildChangeNumber(project, existingChanges),
          title,
          date,
          category_major,
          content,
          status,
        };
        if (category_minor) payload.category_minor = category_minor;
        if (category_detail) payload.category_detail = category_detail;
        const res = await createProjectChange(payload);
        if (res.code === 0) {
          message.success('修改记录已创建');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '创建失败');
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={editingChange ? '编辑修改记录' : '新建修改记录'}
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
          rules={[{ required: true, message: '请输入标题' }]}
        >
          <Input placeholder="请输入标题" maxLength={200} showCount />
        </Form.Item>
        <Form.Item
          name="date"
          label="日期"
          rules={[{ required: true, message: '请选择日期' }]}
        >
          <DatePicker format="YYYY-MM-DD" placeholder="请选择日期" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="category_major"
          label="大类"
          rules={[{ required: true, message: '请选择大类' }]}
          getValueProps={(v?: string) => ({ value: v ? getMajorLabel(v) : v })}
        >
          <AutoComplete
            placeholder="请选择或输入大类"
            options={CHANGE_CATEGORY_MAJOR.map((c) => ({ value: c.value, label: c.label }))}
            onChange={handleMajorChange}
          />
        </Form.Item>
        <Form.Item
          name="category_minor"
          label={majorValue === 'other' ? '小类（自定义）' : '小类'}
          rules={[
            {
              required: true,
              message: majorValue === 'other' ? '请输入小类' : '请选择小类',
            },
          ]}
          getValueProps={(v?: string) => ({
            value: v ? getMinorLabel(majorValue ?? '', v) : v,
          })}
        >
          {majorValue === 'other' ? (
            <Input placeholder="请输入小类（自由填写）" maxLength={50} showCount />
          ) : (
            <AutoComplete
              placeholder="请选择或输入小类"
              options={minorOptions}
              allowClear
            />
          )}
        </Form.Item>
        <Form.Item
          name="category_detail"
          label="详情"
          {...(majorValue === 'other'
            ? { rules: [{ required: true, message: '请输入详情' }] }
            : {})}
        >
          <Input
            placeholder={majorValue === 'other' ? '请输入详情' : '选填：具体文件/模块名'}
            maxLength={200}
            showCount
          />
        </Form.Item>
        <Form.Item
          name="content"
          label="内容"
          rules={[{ required: true, message: '请输入内容' }]}
        >
          <TextArea rows={4} placeholder="请输入变更内容" maxLength={2000} showCount />
        </Form.Item>
        <Form.Item name="status" label="状态">
          <Select
            placeholder="请选择状态"
            options={CHANGE_STATUS_OPTIONS.map((s) => ({
              value: s.value,
              label: s.label,
              disabled: (!canApproveChange && (s.value === 'approved' || s.value === 'rejected')),
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
