import { useEffect, useState } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { createSystem, updateSystem } from '../../api/systems';
import type { SystemRecord, SystemFormValues } from '../../types/system';

const { TextArea } = Input;

interface SystemFormProps {
  visible: boolean;
  mode: 'create' | 'edit';
  record: SystemRecord | null;
  serverId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SystemForm({
  visible,
  mode,
  record,
  serverId,
  onClose,
  onSuccess,
}: SystemFormProps) {
  const [form] = Form.useForm<SystemFormValues>();
  const [submitting, setSubmitting] = useState(false);

  // 打开弹窗时填充表单
  useEffect(() => {
    if (!visible) return;
    if (mode === 'edit' && record) {
      form.setFieldsValue({
        name: record.name,
        description: record.description ?? '',
      });
    } else {
      form.resetFields();
    }
  }, [visible, mode, record, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: SystemFormValues = { name: values.name };
      if (values.description) payload.description = values.description;

      setSubmitting(true);
      const res =
        mode === 'edit' && record
          ? await updateSystem(record.id, payload)
          : await createSystem({ ...payload, server_id: serverId ?? '' });
      if (res.code === 0) {
        message.success(mode === 'edit' ? '系统已更新' : '系统已创建');
        onSuccess();
      } else {
        message.error(res.msg || '操作失败');
      }
    } catch (err: unknown) {
      // validateFields 校验失败抛出的不是 Error 实例，静默跳过
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={mode === 'edit' ? '编辑系统' : '新增系统'}
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      width={520}
      confirmLoading={submitting}
      destroyOnClose
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="系统名称" rules={[{ required: true, message: '请输入系统名称' }]}>
          <Input placeholder="请输入系统名称" />
        </Form.Item>

        <Form.Item name="description" label="描述">
          <TextArea placeholder="请输入系统描述（可选）" rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
