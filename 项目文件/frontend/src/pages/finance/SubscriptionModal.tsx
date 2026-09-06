import { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Modal, Select, message } from 'antd';
import type { Subscription } from '../../types/subscription';
import { createSubscription, updateSubscription } from '../../api/subscriptions';

const CYCLE_OPTIONS = [
  { value: 'monthly', label: '月付' },
  { value: 'yearly', label: '年付' },
];

interface SubscriptionModalProps {
  open: boolean;
  /** 非空表示编辑模式；null 表示新建 */
  editingSub?: Subscription | null;
  onClose: () => void;
  /** 保存成功回调（父组件刷新列表） */
  onSaved: () => void;
}

interface SubscriptionFormValues {
  name: string;
  provider: string;
  amount: number;
  billing_cycle: string;
  next_billing?: string;
}

/**
 * 订阅 新建/编辑 共用弹窗
 *
 * 供「财务中心 - 订阅管理」Tab 复用，表单与提交逻辑内聚于此，
 * 页面只负责打开/关闭/刷新，一处修改、多处以一。
 */
export default function SubscriptionModal({
  open,
  editingSub = null,
  onClose,
  onSaved,
}: SubscriptionModalProps) {
  const [form] = Form.useForm<SubscriptionFormValues>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editingSub) {
      form.setFieldsValue({
        name: editingSub.name,
        provider: editingSub.provider,
        amount: editingSub.amount,
        billing_cycle: editingSub.billing_cycle,
        ...(editingSub.next_billing ? { next_billing: editingSub.next_billing.split('T')[0] } : {}),
      });
    } else {
      form.setFieldsValue({ billing_cycle: 'monthly' });
    }
  }, [open, editingSub, form]);

  const handleSubmit = async () => {
    let values: SubscriptionFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验未通过，Modal 会显示错误
    }
    setSubmitting(true);
    try {
      const payload = {
        name: values.name,
        provider: values.provider,
        amount: values.amount,
        billing_cycle: values.billing_cycle,
        ...(values.next_billing ? { next_billing: values.next_billing } : {}),
      };
      if (editingSub) {
        const res = await updateSubscription(editingSub.id, payload);
        if (res.code === 0) {
          message.success('订阅已更新');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '更新失败');
        }
      } else {
        const res = await createSubscription(payload);
        if (res.code === 0) {
          message.success('订阅已添加');
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
      title={editingSub ? '编辑订阅' : '新增订阅'}
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
          name="name"
          label="名称"
          rules={[{ required: true, message: '请输入名称' }]}
        >
          <Input placeholder="订阅名称" />
        </Form.Item>
        <Form.Item
          name="provider"
          label="提供商"
          rules={[{ required: true, message: '请输入提供商' }]}
        >
          <Input placeholder="如：AWS、阿里云、GitHub" />
        </Form.Item>
        <Form.Item
          name="amount"
          label="费用"
          rules={[{ required: true, message: '请输入费用' }]}
        >
          <InputNumber min={0} style={{ width: '100%' }} prefix="¥" />
        </Form.Item>
        <Form.Item name="billing_cycle" label="计费周期">
          <Select options={CYCLE_OPTIONS} />
        </Form.Item>
        <Form.Item name="next_billing" label="下次扣费日期">
          <Input type="date" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
