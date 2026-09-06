import { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Modal, Select, message } from 'antd';
import type { Inventory, InventoryStatus } from '../../types/inventory';
import type { Visibility } from '../../utils/visibility';
import VisibilitySetting from '@/components/VisibilitySetting/VisibilitySetting';
import { createInventory, updateInventory } from '../../api/inventory';

const { TextArea } = Input;

const STATUS_MAP: Record<InventoryStatus, { color: string; text: string }> = {
  available: { color: 'success', text: '可用' },
  in_use: { color: 'processing', text: '使用中' },
  maintenance: { color: 'warning', text: '维护中' },
  retired: { color: 'default', text: '已退役' },
};

interface InventoryItemModalProps {
  open: boolean;
  /** 非空表示编辑模式；null 表示新建 */
  editingItem?: Inventory | null;
  onClose: () => void;
  /** 保存成功回调（父组件刷新列表） */
  onSaved: () => void;
}

interface ItemFormValues {
  name: string;
  category?: string;
  location?: string;
  description?: string;
}

/**
 * 物品 新建/编辑 共用弹窗
 *
 * 供「物品管理」页（InventoryManagement）复用，表单与提交逻辑内聚于此，
 * 页面只负责打开/关闭/刷新，一处修改、多处以一。
 */
export default function InventoryItemModal({
  open,
  editingItem = null,
  onClose,
  onSaved,
}: InventoryItemModalProps) {
  const [form] = Form.useForm<ItemFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [status, setStatus] = useState<InventoryStatus>('available');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [restrictedUsers, setRestrictedUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editingItem) {
      form.setFieldsValue({
        name: editingItem.name,
        ...(editingItem.category ? { category: editingItem.category } : {}),
        ...(editingItem.location ? { location: editingItem.location } : {}),
        ...(editingItem.description ? { description: editingItem.description } : {}),
      });
      setQuantity(editingItem.quantity);
      setStatus(editingItem.status);
      setVisibility((editingItem.visibility as Visibility) || 'private');
      setRestrictedUsers(editingItem.restricted_users || []);
    } else {
      setQuantity(1);
      setStatus('available');
      setVisibility('private');
      setRestrictedUsers([]);
    }
  }, [open, editingItem, form]);

  const handleSubmit = async () => {
    let values: ItemFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验未通过，Modal 会显示错误
    }
    setSubmitting(true);
    try {
      const data: {
        name: string;
        category?: string;
        quantity: number;
        location?: string;
        description?: string;
        status: InventoryStatus;
        visibility: Visibility;
        restricted_users?: string[];
      } = {
        name: values.name,
        quantity,
        status,
        visibility,
        ...(visibility === 'restricted' && restrictedUsers.length > 0 ? { restricted_users: restrictedUsers } : {}),
      };
      if (values.category) data.category = values.category;
      if (values.location) data.location = values.location;
      if (values.description) data.description = values.description;
      if (editingItem) {
        const res = await updateInventory(editingItem.id, data);
        if (res.code === 0) {
          message.success('物品已更新');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '更新失败');
        }
      } else {
        const res = await createInventory(data);
        if (res.code === 0) {
          message.success('物品已创建');
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
      title={editingItem ? '编辑物品' : '新增物品'}
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
          label="物品名称"
          rules={[{ required: true, message: '请输入物品名称' }]}
        >
          <Input placeholder="请输入物品名称" />
        </Form.Item>
        <Form.Item name="category" label="分类">
          <Input placeholder="请输入分类（可选）" />
        </Form.Item>
        <Form.Item label="数量">
          <InputNumber min={0} value={quantity} onChange={(v) => setQuantity(v ?? 1)} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="location" label="存放位置">
          <Input placeholder="请输入存放位置（可选）" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <TextArea placeholder="请输入描述（可选）" rows={3} />
        </Form.Item>
        <Form.Item label="状态">
          <Select
            value={status}
            onChange={(v) => setStatus(v as InventoryStatus)}
            options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.text }))}
          />
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
