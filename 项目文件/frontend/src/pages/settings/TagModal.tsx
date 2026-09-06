import { useEffect, useState } from 'react';
import { Form, Input, Modal, Space, Tag, message } from 'antd';
import { createTag, updateTag } from '../../api/tags';
import type { Tag as TagType } from '../../api/tags';

const COLOR_OPTIONS = [
  { value: 'blue', label: '蓝色' },
  { value: 'purple', label: '紫色' },
  { value: 'green', label: '绿色' },
  { value: 'gold', label: '金色' },
  { value: 'red', label: '红色' },
  { value: 'orange', label: '橙色' },
  { value: 'cyan', label: '青色' },
  { value: 'magenta', label: '品红' },
];

interface TagModalProps {
  open: boolean;
  /** 非空表示编辑模式；null 表示新建 */
  editingTag?: TagType | null;
  onClose: () => void;
  /** 保存成功回调（父组件刷新列表） */
  onSaved: () => void;
}

interface TagFormValues {
  name: string;
}

/**
 * 标签 新建/编辑 共用弹窗
 *
 * 供「标签管理」页（TagManagement）复用，表单与提交逻辑内聚于此，
 * 页面只负责打开/关闭/刷新，一处修改、多处以一。
 */
export default function TagModal({
  open,
  editingTag = null,
  onClose,
  onSaved,
}: TagModalProps) {
  const [form] = Form.useForm<TagFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [color, setColor] = useState('blue');

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editingTag) {
      form.setFieldsValue({ name: editingTag.name });
      setColor(editingTag.color || 'blue');
    } else {
      setColor('blue');
    }
  }, [open, editingTag, form]);

  const handleSubmit = async () => {
    let values: TagFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验未通过，Modal 会显示错误
    }
    setSubmitting(true);
    try {
      if (editingTag) {
        const res = await updateTag(editingTag.id, { name: values.name, color });
        if (res.code === 0) {
          message.success('标签已更新');
          onClose();
          onSaved();
        } else {
          message.error('更新失败');
        }
      } else {
        const res = await createTag({ name: values.name, color });
        if (res.code === 0) {
          message.success('标签已创建');
          onClose();
          onSaved();
        } else {
          message.error('创建失败');
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
      title={editingTag ? '编辑标签' : '新建标签'}
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
          label="标签名称"
          rules={[{ required: true, message: '请输入标签名称' }]}
        >
          <Input placeholder="请输入标签名称" />
        </Form.Item>
        <Form.Item label="选择颜色">
          <Space wrap>
            {COLOR_OPTIONS.map((opt) => (
              <Tag
                key={opt.value}
                color={opt.value}
                style={{ cursor: 'pointer', opacity: color === opt.value ? 1 : 0.5 }}
                onClick={() => setColor(opt.value)}
              >
                {opt.label}
              </Tag>
            ))}
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
