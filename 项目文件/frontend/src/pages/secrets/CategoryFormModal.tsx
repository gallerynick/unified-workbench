import { useState, useEffect } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { createSecretCategory, updateSecretCategory } from '../../api/secret_categories';
import type { SecretCategory, SecretCategoryCreate } from '../../types/secret_category';

interface CategoryFormModalProps {
  visible: boolean;
  category: SecretCategory | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CategoryFormModal({ visible, category, onClose, onSuccess }: CategoryFormModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      if (category) {
        form.setFieldsValue({
          name: category.name,
          description: category.description,
        });
      } else {
        form.resetFields();
      }
    }
  }, [visible, category, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const data: SecretCategoryCreate = {
        name: values.name,
        description: values.description || '',
      };

      let res: { code: number; msg?: string };
      if (category) {
        res = await updateSecretCategory(category.id, data);
      } else {
        res = await createSecretCategory(data);
      }

      if (res.code === 0) {
        message.success(category ? '分类已更新' : '分类已创建');
        onSuccess();
      } else {
        message.error(res.msg || '操作失败');
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        // Form validation error, ignore
        return;
      }
      const msg = err instanceof Error ? err.message : '操作失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={category ? '编辑分类' : '新增分类'}
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={loading}
      okText={category ? '保存' : '创建'}
      cancelText="取消"
      destroyOnClose
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          name="name"
          label="分类名称"
          rules={[{ required: true, message: '请输入分类名称' }]}
        >
          <Input placeholder="例如：AI平台、数据库、云服务" maxLength={50} />
        </Form.Item>
        <Form.Item
          name="description"
          label="描述"
        >
          <Input.TextArea placeholder="可选，描述该分类的用途" rows={3} maxLength={200} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
