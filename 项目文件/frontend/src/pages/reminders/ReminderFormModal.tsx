import { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, DatePicker, message } from 'antd';
import dayjs from 'dayjs';
import { createReminder, updateReminder } from '../../api/reminders';
import { listUsers } from '../../api/users';
import type { Reminder, ReminderCreate, ReminderUpdate } from '../../types/reminder';
import type { User } from '../../types/user';
import styles from './ReminderFormModal.module.css';

const { TextArea } = Input;

interface ReminderFormModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  reminder: Reminder | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReminderFormModal({
  visible,
  mode,
  reminder,
  onClose,
  onSuccess,
}: ReminderFormModalProps) {
  const [form] = Form.useForm();
  const [userOptions, setUserOptions] = useState<{ value: string; label: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      // 加载用户列表
      listUsers({ page: 1, page_size: 100 })
        .then((res) => {
          if (res.code === 0) {
            setUserOptions(
              res.data.items.map((u: User) => ({
                value: u.id,
                label: `${u.nickname} (${u.username})`,
              }))
            );
          }
        })
        .catch(() => {
          // 静默失败
        });

      if (mode === 'edit' && reminder) {
        form.setFieldsValue({
          title: reminder.title,
          content: reminder.content ?? '',
          trigger_time: reminder.trigger_time ? dayjs(reminder.trigger_time) : undefined,
          target_users: reminder.target_users ?? [],
        });
      } else {
        form.resetFields();
      }
    }
  }, [visible, mode, reminder, form]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();

      const baseData: {
        title: string;
        content?: string;
        trigger_time?: string;
        target_users?: string[];
      } = {
        title: values.title as string,
      };
      if (values.content) baseData.content = values.content as string;
      if (values.trigger_time) baseData.trigger_time = (values.trigger_time as dayjs.Dayjs).toISOString();
      if ((values.target_users as string[])?.length) baseData.target_users = values.target_users as string[];

      if (mode === 'create') {
        const payload: ReminderCreate = baseData;
        const res = await createReminder(payload);
        if (res.code === 0) {
          message.success('提醒创建成功');
          onSuccess();
        } else {
          message.error(res.msg || '创建失败');
        }
      } else if (reminder) {
        const payload: ReminderUpdate = baseData;
        const res = await updateReminder(reminder.id, payload);
        if (res.code === 0) {
          message.success('提醒更新成功');
          onSuccess();
        } else {
          message.error(res.msg || '更新失败');
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
      title={
        <span className={styles.modalTitle ?? ''}>
          {mode === 'create' ? '新建提醒' : '编辑提醒'}
        </span>
      }
      open={visible}
      onOk={handleSubmit}
      confirmLoading={submitting}
      onCancel={onClose}
      destroyOnClose
      className={styles.modal ?? ''}
      width={560}
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Form
        form={form}
        layout="vertical"
        className={styles.form ?? ''}
      >
        <Form.Item
          name="title"
          label="标题"
          rules={[{ required: true, message: '请输入提醒标题' }]}
        >
          <Input placeholder="请输入提醒标题" />
        </Form.Item>

        <Form.Item
          name="content"
          label="内容"
        >
          <TextArea rows={4} placeholder="请输入提醒内容" />
        </Form.Item>

        <Form.Item
          name="trigger_time"
          label="触发时间"
          rules={[{ required: true, message: '请选择触发时间' }]}
        >
          <DatePicker
            showTime
            format="YYYY-MM-DD HH:mm:ss"
            placeholder="请选择触发时间"
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          name="target_users"
          label="目标用户"
        >
          <Select
            mode="multiple"
            placeholder="请选择目标用户（留空则发送给所有用户）"
            options={userOptions}
            allowClear
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
