import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Row,
  Col,
  message,
  Divider,
  Tag,
  Button,
  Space,
  Card,
  Typography,
} from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { createServer, updateServer } from '../../api/servers';
import { listUsers } from '../../api/users';
import { UNIT_OPTIONS } from '../../types/server';
import type {
  ServerRecord,
  ServerFormValues,
  ServerStatus,
  HardwareSpec,
} from '../../types/server';
import type { User } from '../../types/user';

const { Text } = Typography;
const { TextArea } = Input;

const STATUS_OPTIONS: { value: ServerStatus; label: string }[] = [
  { value: 'active', label: '运行中' },
  { value: 'maintenance', label: '维护中' },
  { value: 'retired', label: '已退役' },
];

const HARDWARE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'cpu', label: 'CPU' },
  { value: 'memory', label: '内存' },
  { value: 'disk', label: '磁盘' },
  { value: 'network', label: '网卡' },
  { value: 'gpu', label: 'GPU' },
];

const DISK_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'SSD', label: 'SSD' },
  { value: 'HDD', label: 'HDD' },
  { value: 'NVMe', label: 'NVMe' },
];

const UNIT_OPTION_LIST = UNIT_OPTIONS.map((u) => ({ value: u, label: u }));

function formatHardwareSpec(spec: HardwareSpec): string {
  const parts: string[] = [];
  if (spec.type === 'cpu') parts.push('CPU');
  else if (spec.type === 'memory') parts.push('内存');
  else if (spec.type === 'disk') parts.push('磁盘');
  else if (spec.type === 'network') parts.push('网卡');
  else if (spec.type === 'gpu') parts.push('GPU');
  else parts.push(spec.type);
  if (spec.model) parts.push(spec.model);
  if (spec.type_detail) parts.push(spec.type_detail);
  if (spec.speed) parts.push(spec.speed);
  if (spec.capacity != null && spec.unit) parts.push(`${spec.capacity} ${spec.unit}`);
  if (spec.memory != null && spec.memory_unit) parts.push(`${spec.memory} ${spec.memory_unit}`);
  if (spec.count != null && spec.count > 1) parts.push(`x${spec.count}`);
  return parts.join(' · ');
}

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
  const [hardwareSpecs, setHardwareSpecs] = useState<HardwareSpec[]>([]);
  const [hardwareKeys, setHardwareKeys] = useState<number[]>([]);
  const hardwareKeyRef = useRef(0);
  const [addingHardware, setAddingHardware] = useState(false);
  const [hwType, setHwType] = useState<string>('cpu');
  const [hwModel, setHwModel] = useState('');
  const [hwCapacity, setHwCapacity] = useState<number | undefined>();
  const [hwUnit, setHwUnit] = useState<string>('GB');
  const [hwTypeDetail, setHwTypeDetail] = useState<string>('SSD');
  const [hwSpeed, setHwSpeed] = useState('');
  const [hwMemory, setHwMemory] = useState<number | undefined>();
  const [hwMemoryUnit, setHwMemoryUnit] = useState<string>('GB');
  const [hwCount, setHwCount] = useState<number>(1);

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
        ...(record.ram_capacity != null ? { ram_capacity: record.ram_capacity } : {}),
        ...(record.ram_unit ? { ram_unit: record.ram_unit } : {}),
        ...(record.disk_capacity != null ? { disk_capacity: record.disk_capacity } : {}),
        ...(record.disk_unit ? { disk_unit: record.disk_unit } : {}),
        model: record.model ?? '',
        serial_number: record.serial_number ?? '',
        tags: record.tags ?? [],
        description: record.description ?? '',
        notes: record.notes ?? '',
        status: record.status,
        maintainer_ids: record.maintainer_ids ?? [],
      });
      setHardwareSpecs(record.hardware_specs ?? []);
      setHardwareKeys((record.hardware_specs ?? []).map(() => hardwareKeyRef.current++));
    } else {
      form.resetFields();
      form.setFieldsValue({ status: 'active', maintainer_ids: [] });
      setHardwareSpecs([]);
      setHardwareKeys([]);
    }
  }, [visible, mode, record, form]);

  const handleAddHardware = () => {
    if (!hwModel.trim()) {
      message.warning('请输入组件型号');
      return;
    }
    const spec: HardwareSpec = { type: hwType, model: hwModel.trim() };
    if (hwType === 'memory') {
      if (hwCapacity != null) spec.capacity = hwCapacity;
      spec.unit = hwUnit;
    } else if (hwType === 'disk') {
      spec.type_detail = hwTypeDetail;
      if (hwCapacity != null) spec.capacity = hwCapacity;
      spec.unit = hwUnit;
    } else if (hwType === 'network') {
      if (hwSpeed.trim()) spec.speed = hwSpeed.trim();
    } else if (hwType === 'gpu') {
      if (hwMemory != null) spec.memory = hwMemory;
      spec.memory_unit = hwMemoryUnit;
    }
    if (hwCount > 0) spec.count = hwCount;
    setHardwareSpecs((prev) => [...prev, spec]);
    setHardwareKeys((prev) => [...prev, hardwareKeyRef.current++]);
    setHwModel('');
    setHwCapacity(undefined);
    setHwSpeed('');
    setHwMemory(undefined);
    setHwCount(1);
    setAddingHardware(false);
  };

  const handleRemoveHardware = (index: number) => {
    setHardwareSpecs((prev) => prev.filter((_, i) => i !== index));
    setHardwareKeys((prev) => prev.filter((_, i) => i !== index));
  };

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
      if (values.ram_capacity !== undefined) payload.ram_capacity = values.ram_capacity;
      if (values.ram_unit) payload.ram_unit = values.ram_unit;
      if (values.disk_capacity !== undefined) payload.disk_capacity = values.disk_capacity;
      if (values.disk_unit) payload.disk_unit = values.disk_unit;
      if (values.model) payload.model = values.model;
      if (values.serial_number) payload.serial_number = values.serial_number;
      if (values.tags && values.tags.length > 0) payload.tags = values.tags;
      if (values.description) payload.description = values.description;
      if (values.notes) payload.notes = values.notes;
      payload.hardware_specs = hardwareSpecs;

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
            <Form.Item name="ram_capacity" label="内存">
              <InputNumber min={1} style={{ width: '100%' }} placeholder="例如 16" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="ram_unit" label="内存单位" initialValue="GB">
              <Select options={UNIT_OPTION_LIST} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="disk_capacity" label="磁盘">
              <InputNumber min={1} style={{ width: '100%' }} placeholder="例如 500" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="disk_unit" label="磁盘单位" initialValue="GB">
              <Select options={UNIT_OPTION_LIST} />
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

        <Divider orientation="left" style={{ margin: 'var(--spacing-xs) 0 var(--spacing-sm)' }}>
          硬件配置单
        </Divider>

        {hardwareSpecs.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--spacing-xs)',
              marginBottom: 'var(--spacing-sm)',
            }}
          >
            {hardwareSpecs.map((spec, index) => (
              <Tag
                key={hardwareKeys[index] ?? `${spec.type}-${index}`}
                closable
                onClose={() => handleRemoveHardware(index)}
              >
                {formatHardwareSpec(spec)}
              </Tag>
            ))}
          </div>
        )}

        {!addingHardware ? (
          <Button
            type="default"
            shape="round"
            icon={<PlusOutlined />}
            onClick={() => setAddingHardware(true)}
            style={{ marginBottom: 'var(--spacing-sm)' }}
          >
            添加组件
          </Button>
        ) : (
          <Card size="small" style={{ marginBottom: 'var(--spacing-sm)' }}>
            <Row gutter={8}>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  组件类型
                </Text>
                <Select
                  value={hwType}
                  onChange={setHwType}
                  style={{ width: '100%', marginTop: 4 }}
                  options={HARDWARE_TYPE_OPTIONS}
                />
              </Col>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  型号
                </Text>
                <Input
                  value={hwModel}
                  onChange={(e) => setHwModel(e.target.value)}
                  placeholder="请输入型号"
                  style={{ marginTop: 4 }}
                />
              </Col>
              {(hwType === 'memory' || hwType === 'disk') && (
                <>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      容量
                    </Text>
                    <InputNumber<number>
                      value={hwCapacity ?? null}
                      onChange={(v) => setHwCapacity(typeof v === 'number' ? v : undefined)}
                      min={1}
                      style={{ width: '100%', marginTop: 4 }}
                      placeholder="容量"
                    />
                  </Col>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      单位
                    </Text>
                    <Select
                      value={hwUnit}
                      onChange={setHwUnit}
                      style={{ width: '100%', marginTop: 4 }}
                      options={UNIT_OPTION_LIST}
                    />
                  </Col>
                </>
              )}
              {hwType === 'disk' && (
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    磁盘类型
                  </Text>
                  <Select
                    value={hwTypeDetail}
                    onChange={setHwTypeDetail}
                    style={{ width: '100%', marginTop: 4 }}
                    options={DISK_TYPE_OPTIONS}
                  />
                </Col>
              )}
              {hwType === 'network' && (
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    速率
                  </Text>
                  <Input
                    value={hwSpeed}
                    onChange={(e) => setHwSpeed(e.target.value)}
                    placeholder="例如 10Gbps"
                    style={{ marginTop: 4 }}
                  />
                </Col>
              )}
              {hwType === 'gpu' && (
                <>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      显存
                    </Text>
                    <InputNumber<number>
                      value={hwMemory ?? null}
                      onChange={(v) => setHwMemory(typeof v === 'number' ? v : undefined)}
                      min={1}
                      style={{ width: '100%', marginTop: 4 }}
                      placeholder="显存"
                    />
                  </Col>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      显存单位
                    </Text>
                    <Select
                      value={hwMemoryUnit}
                      onChange={setHwMemoryUnit}
                      style={{ width: '100%', marginTop: 4 }}
                      options={UNIT_OPTION_LIST}
                    />
                  </Col>
                </>
              )}
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  数量
                </Text>
                <InputNumber
                  value={hwCount}
                  onChange={(v) => setHwCount(v ?? 1)}
                  min={1}
                  style={{ width: '100%', marginTop: 4 }}
                  placeholder="数量"
                />
              </Col>
            </Row>
            <Space style={{ marginTop: 12 }}>
              <Button type="primary" size="small" icon={<CheckOutlined />} onClick={handleAddHardware}>
                确认添加
              </Button>
              <Button size="small" icon={<CloseOutlined />} onClick={() => setAddingHardware(false)}>
                取消
              </Button>
            </Space>
          </Card>
        )}

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
