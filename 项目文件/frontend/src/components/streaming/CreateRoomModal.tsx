import { useEffect } from 'react';
import { Modal, Form, Input, Radio, Switch, message } from 'antd';
import { createRoom } from '../../api/stream';
import type { StreamRoomCreate } from '../../types/stream';

interface CreateRoomModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateRoomModal({ open, onClose, onCreated }: CreateRoomModalProps) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({
        mode: 'builtin',
        room_type: 'temporary',
        is_open: true,
      });
    }
  }, [open, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const payload: StreamRoomCreate = {
        name: values.name.trim(),
        mode: values.mode,
        room_type: values.room_type,
        is_open: values.is_open ?? true,
      };

      const res = await createRoom(payload);
      if (res.code === 0) {
        message.success('房间创建成功');
        onCreated();
      } else {
        message.error(res.msg || '创建失败');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    }
  };

  return (
    <Modal
      title="新建房间"
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnClose
      width={520}
      okText="创建"
      cancelText="取消"
      styles={{ body: { paddingBottom: 16 } }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          mode: 'builtin',
          room_type: 'temporary',
          is_open: true,
        }}
      >
        <Form.Item
          name="name"
          label="房间名称"
          rules={[
            { required: true, message: '请输入房间名称' },
            { min: 1, message: '房间名称至少 1 个字符' },
            { max: 50, message: '房间名称不能超过 50 个字符' },
            { whitespace: true, message: '房间名称不能为空白' },
          ]}
        >
          <Input placeholder="输入房间名称" maxLength={50} showCount />
        </Form.Item>

        <Form.Item
          name="mode"
          label="推流模式"
          rules={[{ required: true, message: '请选择推流模式' }]}
        >
          <Radio.Group>
            <Radio value="builtin">内置推流</Radio>
            <Radio value="external">外部推流</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.mode !== curr.mode}>
          {({ getFieldValue }) =>
            getFieldValue('mode') === 'external' ? (
              <div
                style={{
                  padding: '8px 12px',
                  marginBottom: 16,
                  background: 'var(--bg-secondary, #f5f5f5)',
                  borderRadius: 6,
                  fontSize: 13,
                  color: 'var(--text-secondary, #666)',
                  lineHeight: 1.6,
                }}
              >
                使用 OBS 等外部工具填入 RTMP 地址即可推流，无需配置码率等参数
              </div>
            ) : null
          }
        </Form.Item>

        <Form.Item
          name="room_type"
          label="房间类型"
          rules={[{ required: true, message: '请选择房间类型' }]}
        >
          <Radio.Group>
            <Radio value="temporary">临时</Radio>
            <Radio value="permanent">常驻</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.room_type !== curr.room_type}>
          {({ getFieldValue }) =>
            getFieldValue('room_type') === 'temporary' ? (
              <div
                style={{
                  padding: '8px 12px',
                  marginBottom: 16,
                  background: 'var(--bg-secondary, #f5f5f5)',
                  borderRadius: 6,
                  fontSize: 13,
                  color: 'var(--text-secondary, #666)',
                  lineHeight: 1.6,
                }}
              >
                非活跃状态 30 分钟后自动删除
              </div>
            ) : null
          }
        </Form.Item>

        <Form.Item
          name="is_open"
          label="开放访问"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}
