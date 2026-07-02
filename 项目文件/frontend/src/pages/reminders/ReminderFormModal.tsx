import { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, DatePicker, Checkbox, message } from 'antd';
import dayjs from 'dayjs';
import { createReminder, updateReminder } from '../../api/reminders';
import { listUsers } from '../../api/users';
import type { Reminder, ReminderCreate, ReminderUpdate, NotificationChannel } from '../../types/reminder';
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

const CHANNEL_OPTIONS: { value: NotificationChannel; label: string }[] = [
  { value: 'websocket', label: '站内通知' },
  { value: 'feishu', label: '飞书' },
  { value: 'dingtalk', label: '钉钉' },
];

export default function ReminderFormModal({
  visible,
  mode,
  reminder,
  onClose,
  onSuccess,
}: ReminderFormModalProps) {
  const [form] = Form.useForm();
  const [userOptions, setUserOptions] = useState<{ value: string; label: string }[]>([]);
  const [triggerType, setTriggerType] = useState<string>('timed');

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
          trigger_type: reminder.trigger_type,
          event_type: reminder.event_type ?? undefined,
          trigger_time: reminder.trigger_time ? dayjs(reminder.trigger_time) : undefined,
          target_users: reminder.target_users ?? [],
          channels: reminder.channels ?? [],
        });
        setTriggerType(reminder.trigger_type);
      } else {
        form.resetFields();
        form.setFieldsValue({ trigger_type: 'timed', channels: ['websocket'] });
        setTriggerType('timed');
      }
    }
  }, [visible, mode, reminder, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const baseData: {
        title: string;
        content?: string;
        trigger_type: 'timed' | 'event';
        event_type?: string;
        trigger_time?: string;
        target_users?: string[];
        channels?: NotificationChannel[];
      } = {
        title: values.title as string,
        trigger_type: values.trigger_type as 'timed' | 'event',
      };
      if (values.content) baseData.content = values.content as string;
      if (values.event_type) baseData.event_type = values.event_type as string;
      if (values.trigger_time) baseData.trigger_time = (values.trigger_time as dayjs.Dayjs).toISOString();
      if ((values.target_users as string[])?.length) baseData.target_users = values.target_users as string[];
      if ((values.channels as NotificationChannel[])?.length) baseData.channels = values.channels as NotificationChannel[];

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
    }
  };

  return (
    <Modal
      title={mode === 'create' ? '新建提醒' : '编辑提醒'}
      open={visible}
      onOk={handleSubmit}
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
        initialValues={{ trigger_type: 'timed', channels: ['websocket'] }}
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
          name="trigger_type"
          label="触发类型"
          rules={[{ required: true, message: '请选择触发类型' }]}
        >
          <Select
            onChange={(value: string) => setTriggerType(value)}
            options={[
              { value: 'timed', label: '定时触发' },
              { value: 'event', label: '事件触发' },
            ]}
          />
        </Form.Item>

        {triggerType === 'timed' && (
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
        )}

        {triggerType === 'event' && (
          <Form.Item
            name="event_type"
            label="事件类型"
            rules={[{ required: true, message: '请输入事件类型' }]}
          >
            <Select
              placeholder="请选择要监听的事件类型"
              options={[
                { value: 'secret_access', label: '密钥访问' },
                { value: 'record_status_change', label: '记录状态变更' },
                { value: 'file_delete', label: '文件删除' },
              ]}
            />
          </Form.Item>
        )}

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

        <Form.Item
          name="channels"
          label="通知渠道"
        >
          <Checkbox.Group options={CHANNEL_OPTIONS} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
