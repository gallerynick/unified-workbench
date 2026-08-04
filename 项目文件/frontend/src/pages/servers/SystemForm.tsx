import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, Row, Col, message } from 'antd';
import { createSystem, updateSystem } from '../../api/systems';
import type { SystemRecord, SystemFormValues } from '../../types/system';

const { TextArea } = Input;

interface SystemFormProps {
  visible: boolean;
  mode: 'create' | 'edit';
  record?: SystemRecord | null;
  serverId: string;
  /** VM 创建时父系统 ID；不传则创建顶层系统 */
  parentSystemId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const STATUS_OPTIONS = [
  { value: 'running', label: '运行中' },
  { value: 'stopped', label: '已停止' },
  { value: 'paused', label: '已暂停' },
  { value: 'error', label: '异常' },
];

const ENVIRONMENT_OPTIONS = [
  { value: 'production', label: '生产' },
  { value: 'staging', label: '预发布' },
  { value: 'development', label: '开发' },
  { value: 'testing', label: '测试' },
];

/** IPv4 或 IPv6 地址校验（空值放行） */
function isIpAddress(value: string): boolean {
  if (!value) return true;
  if (value.includes(':')) {
    return /^[0-9a-fA-F:]+$/.test(value);
  }
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

export default function SystemForm({
  visible,
  mode,
  record,
  serverId,
  parentSystemId,
  onClose,
  onSuccess,
}: SystemFormProps) {
  const [form] = Form.useForm<SystemFormValues>();
  const [submitting, setSubmitting] = useState(false);

  // VM 模式：创建时由 parentSystemId 决定；编辑时由 record.is_vm 决定
  const isVmMode = mode === 'create' ? Boolean(parentSystemId) : Boolean(record?.is_vm);

  const title = isVmMode
    ? mode === 'edit'
      ? '编辑虚拟机'
      : '新增虚拟机'
    : mode === 'edit'
      ? '编辑系统'
      : '新增系统';

  const successMsg = isVmMode
    ? mode === 'edit'
      ? '虚拟机已更新'
      : '虚拟机已创建'
    : mode === 'edit'
      ? '系统已更新'
      : '系统已创建';

  // 打开弹窗时填充表单
  useEffect(() => {
    if (!visible) return;
    if (mode === 'edit' && record) {
      const values: Partial<SystemFormValues> = {
        name: record.name,
        description: record.description ?? '',
        parent_system_id: record.parent_system_id ?? '',
        ip: record.ip ?? '',
        os_type: record.os_type ?? '',
        os_version: record.os_version ?? '',
        status: record.status,
        environment: record.environment,
        tags: record.tags,
        notes: record.notes ?? '',
      };
      if (record.cpu_allocated != null) values.cpu_allocated = record.cpu_allocated;
      if (record.ram_allocated != null) values.ram_allocated = record.ram_allocated;
      if (record.disk_allocated != null) values.disk_allocated = record.disk_allocated;
      form.setFieldsValue(values);
    } else {
      form.resetFields();
    }
  }, [visible, mode, record, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: SystemFormValues = { name: values.name };
      if (values.description) payload.description = values.description;
      if (values.ip) payload.ip = values.ip;
      if (values.os_type) payload.os_type = values.os_type;
      if (values.os_version) payload.os_version = values.os_version;
      if (values.cpu_allocated != null) payload.cpu_allocated = values.cpu_allocated;
      if (values.ram_allocated != null) payload.ram_allocated = values.ram_allocated;
      if (values.disk_allocated != null) payload.disk_allocated = values.disk_allocated;
      if (values.status) payload.status = values.status;
      if (values.environment) payload.environment = values.environment;
      if (values.tags && values.tags.length > 0) payload.tags = values.tags;
      if (values.notes) payload.notes = values.notes;
      // 创建 VM：父系统归属由调用方指定，提交时置入
      if (mode === 'create' && parentSystemId) {
        payload.parent_system_id = parentSystemId;
      }

      setSubmitting(true);
      const res =
        mode === 'edit' && record
          ? await updateSystem(record.id, payload)
          : await createSystem({ ...payload, server_id: serverId });
      if (res.code === 0) {
        message.success(successMsg);
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
      title={title}
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
      <Form
        form={form}
        layout="vertical"
        initialValues={{ status: 'running', environment: 'production' }}
      >
        <Form.Item name="name" label="系统名称" rules={[{ required: true, message: '请输入系统名称' }]}>
          <Input placeholder="请输入系统名称" />
        </Form.Item>

        {/* 编辑 VM：父系统归属只读展示，不可修改 */}
        {mode === 'edit' && record?.is_vm ? (
          <Form.Item name="parent_system_id" label="所属系统" extra="虚拟机归属创建后不可修改">
            <Input disabled />
          </Form.Item>
        ) : null}

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="ip"
              label="IP 地址"
              rules={[
                {
                  validator: (_rule, value: unknown) =>
                    isIpAddress(value == null ? '' : String(value))
                      ? Promise.resolve()
                      : Promise.reject(new Error('请输入合法的 IPv4 或 IPv6 地址')),
                },
              ]}
            >
              <Input placeholder="例如 192.168.1.100（可选）" allowClear />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="os_type" label="操作系统类型">
              <Input placeholder="例如 Ubuntu / CentOS（可选）" allowClear />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="os_version" label="操作系统版本">
              <Input placeholder="例如 22.04（可选）" allowClear />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="cpu_allocated" label="CPU 分配">
              <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="核心数" suffix="核" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="ram_allocated" label="内存分配">
              <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="内存大小" suffix="GB" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="disk_allocated" label="磁盘分配">
              <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="磁盘大小" suffix="GB" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="status" label="状态">
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="environment" label="环境">
              <Select options={ENVIRONMENT_OPTIONS} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="tags" label="标签">
          <Select
            mode="tags"
            placeholder="输入标签后回车创建"
            tokenSeparators={[',']}
            maxTagCount="responsive"
            allowClear
          />
        </Form.Item>

        <Form.Item name="description" label="描述">
          <TextArea placeholder="请输入系统描述（可选）" rows={3} />
        </Form.Item>

        <Form.Item name="notes" label="备注">
          <TextArea placeholder="请输入备注（可选）" rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
