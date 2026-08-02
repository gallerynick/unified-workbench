import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, Row, Col, message } from 'antd';
import { createServer, updateServer } from '../../api/servers';
import { listUsers } from '../../api/users';
import type { ServerRecord, ServerFormValues, ServerType, ServerStatus } from '../../types/server';
import type { User } from '../../types/user';

const { TextArea } = Input;

const STATUS_OPTIONS: { value: ServerStatus; label: string }[] = [
  { value: 'active', label: '运行中' },
  { value: 'maintenance', label: '维护中' },
  { value: 'retired', label: '已退役' },
];

const TYPE_OPTIONS: { value: ServerType; label: string }[] = [
  { value: 'SINGLE', label: '单系统' },
  { value: 'MULTI', label: '多系统' },
];

// 兼容 IPv4 与 IPv6 的宽松匹配
const IP_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{0,4}$/;

interface ServerFormModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  record: ServerRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ServerFormModal({
  visible,
  mode,
  record,
  onClose,
  onSuccess,
}: ServerFormModalProps) {
  const [form] = Form.useForm<ServerFormValues>();
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
        purpose: record.purpose ?? '',
        location: record.location ?? '',
        ip: record.ip ?? '',
        ...(record.port != null ? { port: record.port } : {}),
        description: record.description ?? '',
        notes: record.notes ?? '',
        status: record.status,
        server_type: record.server_type,
        maintainer_ids: record.maintainer_ids ?? [],
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ status: 'active', server_type: 'SINGLE', maintainer_ids: [] });
    }
  }, [visible, mode, record, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: ServerFormValues = {
        name: values.name,
        status: values.status ?? 'active',
        server_type: values.server_type ?? 'SINGLE',
        maintainer_ids: values.maintainer_ids ?? [],
      };
      if (values.purpose) payload.purpose = values.purpose;
      if (values.location) payload.location = values.location;
      if (values.ip) payload.ip = values.ip;
      if (values.port != null) payload.port = values.port;
      if (values.description) payload.description = values.description;
      if (values.notes) payload.notes = values.notes;

      setSubmitting(true);
      const res =
        mode === 'edit' && record
          ? await updateServer(record.id, payload)
          : await createServer(payload);
      if (res.code === 0) {
        message.success(mode === 'edit' ? '服务器已更新' : '服务器已创建');
        onSuccess();
      } else {
        message.error(res.msg || '操作失败');
      }
    } catch (err: unknown) {
      // validateFields 校验失败抛出的不是 Error 实例，静默跳过；
      // API 错误为 HttpError（Error 子类），此处展示后端消息
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={mode === 'edit' ? '编辑服务器' : '新建服务器'}
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      width={600}
      confirmLoading={submitting}
      destroyOnClose
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入服务器名称' }]}>
          <Input placeholder="请输入服务器名称" />
        </Form.Item>

        <Form.Item
          name="server_type"
          label="服务器类型"
          rules={[{ required: true, message: '请选择服务器类型' }]}
          tooltip={mode === 'edit' ? '创建后不可更改' : undefined}
        >
          <Select options={TYPE_OPTIONS} disabled={mode === 'edit'} placeholder="请选择服务器类型" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={16}>
            <Form.Item
              name="ip"
              label="IP 地址"
              rules={[
                { required: true, message: '请输入 IP 地址' },
                { pattern: IP_PATTERN, message: '请输入有效的 IPv4 或 IPv6 地址' },
              ]}
            >
              <Input placeholder="例如 192.168.1.10" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="port" label="端口" rules={[{ required: true, message: '请输入端口号' }]}>
              <InputNumber min={1} max={65535} style={{ width: '100%' }} placeholder="端口" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
          <Select options={STATUS_OPTIONS} />
        </Form.Item>

        <Form.Item name="maintainer_ids" label="维护人员">
          <Select
            mode="multiple"
            optionFilterProp="label"
            placeholder="请选择维护人员"
            options={users.map((u) => ({ value: u.id, label: u.nickname || u.username }))}
          />
        </Form.Item>

        <Form.Item name="purpose" label="用途">
          <TextArea placeholder="请输入用途（可选）" rows={2} />
        </Form.Item>

        <Form.Item name="location" label="位置">
          <Input placeholder="请输入位置（可选）" />
        </Form.Item>

        <Form.Item name="description" label="描述">
          <TextArea placeholder="请输入描述（可选）" rows={2} />
        </Form.Item>

        <Form.Item name="notes" label="备注">
          <TextArea placeholder="请输入备注（可选）" rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
