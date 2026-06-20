import { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, Button, message } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { createSecret } from '../../api/secrets';
import type { SecretCreate } from '../../types/secret';
import styles from './SecretFormModal.module.css';

interface SecretFormModalProps {
  visible: boolean;
  categoryId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const SECRET_TYPE_OPTIONS = [
  { value: 'api_key', label: 'API 密钥' },
  { value: 'account', label: '账号密码' },
  { value: 'config', label: '配置项' },
  { value: 'other', label: '其他' },
];

interface KeyValue {
  key: string;
  value: string;
}

export default function SecretFormModal({
  visible,
  categoryId,
  onClose,
  onSuccess,
}: SecretFormModalProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [kvPairs, setKvPairs] = useState<KeyValue[]>([{ key: '', value: '' }]);

  useEffect(() => {
    if (visible) {
      form.resetFields();
      setKvPairs([{ key: '', value: '' }]);
    }
  }, [visible, form]);

  const handleAddKv = () => {
    setKvPairs((prev) => [...prev, { key: '', value: '' }]);
  };

  const handleRemoveKv = (index: number) => {
    setKvPairs((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleKvChange = (index: number, field: 'key' | 'value', val: string) => {
    setKvPairs((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item))
    );
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 构建 data 对象
      const data: Record<string, string> = {};
      let hasValid = false;
      for (const kv of kvPairs) {
        const k = kv.key.trim();
        const v = kv.value.trim();
        if (k) {
          data[k] = v;
          hasValid = true;
        }
      }

      if (!hasValid) {
        message.warning('请至少填写一组密钥数据');
        return;
      }

      const payload: SecretCreate = {
        name: values.name,
        secret_type: values.secret_type,
        data,
        note: values.note || undefined,
        sub_category: values.sub_category || undefined,
        ...(categoryId ? { category_id: categoryId } : {}),
      };

      setSubmitting(true);
      const res = await createSecret(payload);
      if (res.code === 0) {
        message.success('密钥创建成功');
        onSuccess();
      } else {
        message.error(res.msg || '创建失败');
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
      title="新建密钥"
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={submitting}
      destroyOnClose
      className={styles.modal ?? ''}
    >
      <Form
        form={form}
        layout="vertical"
        className={styles.form ?? ''}
        initialValues={{ secret_type: 'api_key' }}
      >
        <Form.Item
          name="name"
          label="名称"
          rules={[{ required: true, message: '请输入密钥名称' }]}
        >
          <Input placeholder="请输入密钥名称" />
        </Form.Item>

        <Form.Item
          name="secret_type"
          label="类型"
          rules={[{ required: true, message: '请选择密钥类型' }]}
        >
          <Select placeholder="请选择密钥类型" options={SECRET_TYPE_OPTIONS} />
        </Form.Item>

        <Form.Item
          name="sub_category"
          label="子分类"
        >
          <Input placeholder="例如：OpenAI、Claude、AWS（可选）" />
        </Form.Item>

        {/* 动态 key-value 输入区 */}
        <div className={styles.kvHeader ?? ''}>
          <span className={styles.kvLabel ?? ''}>数据</span>
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            onClick={handleAddKv}
          >
            添加字段
          </Button>
        </div>

        {kvPairs.length === 0 ? (
          <div className={styles.emptyKv ?? ''}>暂无数据字段</div>
        ) : (
          kvPairs.map((kv, index) => (
            <div key={index} className={styles.kvRow ?? ''}>
              <Input
                placeholder="字段名"
                value={kv.key}
                onChange={(e) => handleKvChange(index, 'key', e.target.value)}
              />
              <Input
                placeholder="字段值"
                value={kv.value}
                onChange={(e) => handleKvChange(index, 'value', e.target.value)}
              />
              <Button
                type="text"
                size="small"
                danger
                icon={<MinusCircleOutlined />}
                className={styles.kvRemoveBtn ?? ''}
                onClick={() => handleRemoveKv(index)}
                disabled={kvPairs.length <= 1}
              />
            </div>
          ))
        )}

        <Form.Item name="note" label="备注" style={{ marginTop: 16 }}>
          <Input.TextArea placeholder="请输入备注（选填）" rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
