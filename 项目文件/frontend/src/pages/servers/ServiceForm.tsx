import { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, message } from 'antd';
import { createService, updateService } from '../../api/services';
import { listUsers } from '../../api/users';
import type { ServiceRecord, ServiceFormValues, TargetType } from '../../types/service';
import type { User } from '../../types/user';

const { TextArea } = Input;

const TARGET_TYPE_OPTIONS: { value: TargetType; label: string }[] = [
  { value: 'DEVICE', label: '设备' },
  { value: 'PERSONNEL', label: '人员' },
  { value: 'ORGANIZATION', label: '组织' },
];

interface ServiceFormProps {
  visible: boolean;
  mode: 'create' | 'edit';
  record: ServiceRecord | null;
  systemId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ServiceForm({
  visible,
  mode,
  record,
  systemId,
  onClose,
  onSuccess,
}: ServiceFormProps) {
  const [form] = Form.useForm<ServiceFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  // 加载成员列表，供维护人员选择器使用
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    listUsers({ page: 1, page_size: 100 })
      .then((res) => {
        if (!cancelled && res.code === 0) {
          setUsers(res.data.items);
        }
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // 打开弹窗时填充表单
  useEffect(() => {
    if (!visible) return;
    if (mode === 'edit' && record) {
      form.setFieldsValue({
        name: record.name,
        description: record.description ?? '',
        ...(record.target_type ? { target_type: record.target_type } : {}),
        target_name: record.target_name ?? '',
        target_ref: record.target_ref ?? '',
        maintainer_ids: record.maintainer_ids ?? [],
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ maintainer_ids: [] });
    }
  }, [visible, mode, record, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: ServiceFormValues = {
        name: values.name,
        maintainer_ids: values.maintainer_ids ?? [],
      };
      if (values.description) payload.description = values.description;
      if (values.target_type) payload.target_type = values.target_type;
      if (values.target_name) payload.target_name = values.target_name;
      if (values.target_ref) payload.target_ref = values.target_ref;

      setSubmitting(true);
      const res =
        mode === 'edit' && record
          ? await updateService(record.id, payload)
          : await createService({ ...payload, system_id: systemId ?? '' });
      if (res.code === 0) {
        message.success(mode === 'edit' ? '服务已更新' : '服务已创建');
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
      title={mode === 'edit' ? '编辑服务' : '新增服务'}
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      width={560}
      confirmLoading={submitting}
      destroyOnClose
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="服务名称" rules={[{ required: true, message: '请输入服务名称' }]}>
          <Input placeholder="请输入服务名称" />
        </Form.Item>

        <Form.Item name="target_type" label="服务目标类型">
          <Select
            allowClear
            placeholder="请选择服务目标类型（可选）"
            options={TARGET_TYPE_OPTIONS}
          />
        </Form.Item>

        <Form.Item name="target_name" label="服务目标名称">
          <Input placeholder="例如：核心数据库 / 张三 / 运营部（可选）" />
        </Form.Item>

        <Form.Item name="target_ref" label="目标引用键">
          <Input placeholder="目标引用键（可选）" />
        </Form.Item>

        <Form.Item name="maintainer_ids" label="维护人员">
          <Select
            mode="multiple"
            optionFilterProp="label"
            placeholder="请选择维护人员"
            options={users.map((u) => ({ value: u.id, label: u.nickname || u.username }))}
          />
        </Form.Item>

        <Form.Item name="description" label="描述">
          <TextArea placeholder="请输入服务描述（可选）" rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
