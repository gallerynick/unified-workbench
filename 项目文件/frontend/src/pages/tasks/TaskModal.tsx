import { useEffect, useState } from 'react';
import { Form, Input, Modal, Select, Tooltip, message } from 'antd';
import type { Task, TaskPriority } from '../../types/task';
import type { Visibility } from '../../utils/visibility';
import VisibilitySetting from '@/components/VisibilitySetting/VisibilitySetting';
import { createTask, updateTask } from '../../api/tasks';
import { DEFAULT_TASK_COLOR, TASK_COLORS, taskColorLabel } from './taskColors';
import styles from './TaskModal.module.css';

const { TextArea } = Input;

const PRIORITY_MAP: Record<TaskPriority, { color: string; text: string }> = {
  low: { color: 'default', text: '低' },
  medium: { color: 'blue', text: '中' },
  high: { color: 'orange', text: '高' },
  urgent: { color: 'red', text: '紧急' },
};

interface TaskModalProps {
  open: boolean;
  /** 非空表示编辑模式；null 表示新建 */
  editingTask?: Task | null;
  onClose: () => void;
  /** 保存成功回调（父组件刷新列表） */
  onSaved: () => void;
}

interface TaskFormValues {
  title: string;
  description?: string;
  priority: TaskPriority;
  color: string;
}

interface TaskColorPickerProps {
  value?: string;
  onChange?: (value: string) => void;
}

/**
 * 标记色选择器
 *
 * 按《浮窗交互组件标准化规范》的「选择卡片」模式实现：浮窗内交互项
 * 禁止 box-shadow，仅用 border-color 变化 + transform: scale 表达反馈。
 * 具体色值与倍率见 TaskModal.module.css 的 .colorOption。
 */
function TaskColorPicker({ value, onChange }: TaskColorPickerProps) {
  return (
    <div className={styles.colorRow ?? ''} role="group" aria-label="标记颜色">
      {TASK_COLORS.map((c) => {
        const active = value === c.key;
        return (
          <Tooltip key={c.key} title={c.label} placement="top" mouseEnterDelay={0.2}>
            <button
              type="button"
              className={active ? styles.colorDotActive ?? '' : styles.colorDot ?? ''}
              onClick={() => onChange?.(c.key)}
              aria-label={c.label}
              aria-pressed={active}
            >
              <span
                className={styles.colorInner ?? ''}
                style={{ backgroundColor: `var(--${c.token})` }}
              />
            </button>
          </Tooltip>
        );
      })}
      <span className={styles.colorName ?? ''}>{taskColorLabel(value)}</span>
    </div>
  );
}

/**
 * 任务 新建/编辑 共用弹窗
 *
 * 供「任务中心」页（TaskManagement）复用，表单与提交逻辑内聚于此，
 * 页面只负责打开/关闭/刷新，一处修改、多处以一。
 */
export default function TaskModal({
  open,
  editingTask = null,
  onClose,
  onSaved,
}: TaskModalProps) {
  const [form] = Form.useForm<TaskFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [restrictedUsers, setRestrictedUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editingTask) {
      form.setFieldsValue({
        title: editingTask.title,
        ...(editingTask.description ? { description: editingTask.description } : {}),
        priority: editingTask.priority,
        color: editingTask.color ?? DEFAULT_TASK_COLOR,
      });
      setVisibility((editingTask.visibility as Visibility) || 'private');
      setRestrictedUsers(editingTask.restricted_users || []);
    } else {
      form.setFieldsValue({ priority: 'medium', color: DEFAULT_TASK_COLOR });
      setVisibility('private');
      setRestrictedUsers([]);
    }
  }, [open, editingTask, form]);

  const handleSubmit = async () => {
    let values: TaskFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验未通过，Modal 会显示错误
    }
    setSubmitting(true);
    try {
      const payload = {
        title: values.title,
        ...(values.description ? { description: values.description } : {}),
        priority: values.priority,
        color: values.color,
        visibility,
        ...(visibility === 'restricted' ? { restricted_users: restrictedUsers } : {}),
      };
      if (editingTask) {
        const res = await updateTask(editingTask.id, payload);
        if (res.code === 0) {
          message.success('任务已更新');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '更新失败');
        }
      } else {
        const res = await createTask(payload);
        if (res.code === 0) {
          message.success('任务已创建');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '创建失败');
        }
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={editingTask ? '编辑任务' : '新建任务'}
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
          label="任务标题"
          rules={[{ required: true, message: '请输入任务标题' }]}
        >
          <Input placeholder="请输入任务标题" />
        </Form.Item>
        <Form.Item name="description" label="任务描述">
          <TextArea placeholder="请输入任务描述（可选）" rows={3} />
        </Form.Item>
        <Form.Item name="priority" label="优先级">
          <Select options={Object.entries(PRIORITY_MAP).map(([k, v]) => ({ value: k, label: v.text }))} />
        </Form.Item>
        <Form.Item name="color" label="颜色">
          <TaskColorPicker />
        </Form.Item>
        <Form.Item label="可见性">
          <VisibilitySetting
            value={visibility}
            restrictedUsers={restrictedUsers}
            onChange={setVisibility}
            onRestrictedUsersChange={setRestrictedUsers}
            showRestrictedTags={false}
            label=""
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
