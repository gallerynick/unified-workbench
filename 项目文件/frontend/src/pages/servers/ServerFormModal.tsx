import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, Row, Col, message } from 'antd';
import { createServer, updateServer } from '../../api/servers';
import { listUsers } from '../../api/users';
import type { ServerRecord, ServerFormValues, ServerStatus } from '../../types/server';
import type { User } from '../../types/user';

const { TextArea } = Input;

const STATUS_OPTIONS: { value: ServerStatus; label: string }[] = [
  { value: 'active', label: '运行中' },
  { value: 'maintenance', label: '维护中' },
  { value: 'retired', label: '已退役' },
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
        hostname: record.hostname ?? '',
        purpose: record.purpose ?? '',
        location: record.location ?? '',
        ip: record.ip ?? '',
        os: record.os ?? '',
        ...(record.cpu_cores != null ? { cpu_cores: record.cpu_cores } : {}),
        ...(record.ram_gb != null ? { ram_gb: record.ram_gb } : {}),
        ...(record.disk_gb != null ? { disk_gb: record.disk_gb } : {}),
        model: record.model ?? '',
        serial_number: record.serial_number ?? '',
        tags: record.tags ?? [],
        description: record.description ?? '',
        notes: record.notes ?? '',
        status: record.status,
        maintainer_ids: record.maintainer_ids ?? [],
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ status: 'active', maintainer_ids: [] });
    }
  }, [visible, mode, record, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: ServerFormValues = {
        name: values.name,
        status: values.status ?? 'active',
        maintainer_ids: values.maintainer_ids ?? [],
      };
      if (values.hostname) payload.hostname = values.hostname;
      if (values.purpose) payload.purpose = values.purpose;
      if (values.location) payload.location = values.location;
      if (values.ip) payload.ip = values.ip;
      if (values.os) payload.os = values.os;
      if (values.cpu_cores !== undefined) payload.cpu_cores = values.cpu_cores;
      if (values.ram_gb !== undefined) payload.ram_gb = values.ram_gb;
      if (values.disk_gb !== undefined) payload.disk_gb = values.disk_gb;
      if (values.model) payload.model = values.model;
      if (values.serial_number) payload.serial_number = values.serial_number;
      if (values.tags && values.tags.length > 0) payload.tags = values.tags;
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
      width={640}
      confirmLoading={submitting}
      destroyOnClose
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入服务器名称' }]}>
              <Input placeholder="请输入服务器名称" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="hostname" label="主机名">
              <Input placeholder="例如 srv-01" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
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
          <Col span={12}>
            <Form.Item name="os" label="操作系统">
              <Input placeholder="例如 Ubuntu 22.04 LTS" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="cpu_cores" label="CPU 核心数">
              <InputNumber min={1} style={{ width: '100%' }} placeholder="例如 8" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="ram_gb" label="内存">
              <InputNumber min={1} style={{ width: '100%' }} placeholder="例如 16" suffix="GB" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="disk_gb" label="磁盘">
              <InputNumber min={1} style={{ width: '100%' }} placeholder="例如 500" suffix="GB" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="model" label="设备型号">
              <Input placeholder="例如 Dell PowerEdge R740" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="serial_number" label="序列号">
              <Input placeholder="请输入序列号" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="tags" label="标签">
          <Select
            mode="tags"
            placeholder="输入标签后回车创建"
            tokenSeparators={[',']}
            maxTagCount="responsive"
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="location" label="位置">
              <Input placeholder="请输入位置（可选）" />
            </Form.Item>
          </Col>
        </Row>

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
