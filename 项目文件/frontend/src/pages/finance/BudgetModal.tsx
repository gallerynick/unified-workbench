import { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Modal, Select, message } from 'antd';
import type { Budget } from '../../types/budget';
import type { Visibility } from '../../utils/visibility';
import VisibilitySetting from '@/components/VisibilitySetting/VisibilitySetting';
import { createBudget, updateBudget } from '../../api/budgets';

const PERIOD_OPTIONS = [
  { value: 'monthly', label: '月度' },
  { value: 'quarterly', label: '季度' },
  { value: 'yearly', label: '年度' },
];

interface BudgetModalProps {
  open: boolean;
  /** 非空表示编辑模式；null 表示新建 */
  editingBudget?: Budget | null;
  onClose: () => void;
  /** 保存成功回调（父组件刷新列表） */
  onSaved: () => void;
}

interface BudgetFormValues {
  name: string;
  category: string;
  amount: number;
  period: string;
}

/**
 * 预算 新建/编辑 共用弹窗
 *
 * 供「财务中心 - 预算管理」Tab 复用，表单与提交逻辑内聚于此，
 * 页面只负责打开/关闭/刷新，一处修改、多处以一。
 */
export default function BudgetModal({
  open,
  editingBudget = null,
  onClose,
  onSaved,
}: BudgetModalProps) {
  const [form] = Form.useForm<BudgetFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>('private');

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editingBudget) {
      form.setFieldsValue({
        name: editingBudget.name,
        category: editingBudget.category,
        amount: editingBudget.amount,
        period: editingBudget.period,
      });
      setVisibility((editingBudget.visibility as Visibility) || 'private');
    } else {
      form.setFieldsValue({ period: 'monthly' });
      setVisibility('private');
    }
  }, [open, editingBudget, form]);

  const handleSubmit = async () => {
    let values: BudgetFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验未通过，Modal 会显示错误
    }
    setSubmitting(true);
    try {
      const payload = {
        name: values.name,
        category: values.category,
        amount: values.amount,
        period: values.period,
        visibility,
      };
      if (editingBudget) {
        const res = await updateBudget(editingBudget.id, payload);
        if (res.code === 0) {
          message.success('预算已更新');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '更新失败');
        }
      } else {
        const res = await createBudget(payload);
        if (res.code === 0) {
          message.success('预算已添加');
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
      title={editingBudget ? '编辑预算' : '新增预算'}
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
          <Input placeholder="预算名称" />
        </Form.Item>
        <Form.Item
          name="category"
          label="分类"
          rules={[{ required: true, message: '请输入分类' }]}
        >
          <Input placeholder="如：运营、开发、市场" />
        </Form.Item>
        <Form.Item
          name="amount"
          label="预算金额"
          rules={[{ required: true, message: '请输入金额' }]}
        >
          <InputNumber min={0} style={{ width: '100%' }} prefix="¥" />
        </Form.Item>
        <Form.Item name="period" label="周期">
          <Select options={PERIOD_OPTIONS} />
        </Form.Item>
        <Form.Item label="可见性">
          <VisibilitySetting
            value={visibility}
            onChange={setVisibility}
            hideRestricted
            showRestrictedTags={false}
            label=""
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
