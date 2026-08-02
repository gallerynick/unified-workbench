import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Typography, message } from 'antd';
import { updateFileShare } from '../../api/file-shares';
import type { FileShareUpdateRequest } from '../../api/file-shares';
import type { FileShareRecord } from '../../types/file-share';
import styles from './ShareSettingsModal.module.css';

const { Text } = Typography;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

interface ShareSettingsModalProps {
  record: FileShareRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ShareSettingsModal({ record, onClose, onSuccess }: ShareSettingsModalProps) {
  const [form] = Form.useForm();
  const [minutes, setMinutes] = useState(0);
  const [hours, setHours] = useState(0);
  const [days, setDays] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (record) {
      form.setFieldsValue({ max_downloads: record.max_downloads });
      setMinutes(0);
      setHours(0);
      setDays(0);
    }
  }, [record, form]);

  const handleSave = async () => {
    if (!record) return;
    try {
      const values = await form.validateFields();
      const payload: FileShareUpdateRequest = {};
      if (values.password) payload.password = values.password;
      if (minutes > 0) payload.expires_in_minutes = minutes;
      if (hours > 0) payload.expires_in_hours = hours;
      if (days > 0) payload.expires_in_days = days;
      payload.max_downloads = values.max_downloads ?? null;
      setSaving(true);
      const res = await updateFileShare(record.id, payload);
      if (res.code === 0) {
        message.success('分享设置已更新');
        onClose();
        onSuccess();
      } else {
        message.error(res.msg || '更新失败');
      }
    } catch {
      // 校验失败由表单展示
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="分享设置"
      open={record != null}
      onOk={handleSave}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      confirmLoading={saving}
      width={520}
      destroyOnClose
      className={styles.modal ?? ''}
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Form form={form} layout="vertical">
        <div className={styles.readonlyRow}>
          <span className={styles.readonlyLabel ?? ''}>分享码</span>
          <Text {...(record ? { copyable: { text: record.share_code } } : {})}>
            {record?.share_code}
          </Text>
        </div>
        <div className={styles.readonlyRow}>
          <span className={styles.readonlyLabel ?? ''}>文件名</span>
          <Text ellipsis style={{ maxWidth: 300 }}>
            {record?.original_name}
          </Text>
        </div>
        <div className={styles.readonlyRow}>
          <span className={styles.readonlyLabel ?? ''}>文件大小</span>
          <Text>{record ? formatBytes(record.file_size) : ''}</Text>
        </div>

        <Form.Item
          name="password"
          label="修改密码（留空保持不变）"
          rules={[{ min: 4, message: '密码至少 4 位' }]}
        >
          <Input.Password placeholder="输入新密码（可选）" autoComplete="new-password" />
        </Form.Item>

        <Form.Item label="重置有效期（可选，全部留 0 保持不变）">
          <div className={styles.expiryRow}>
            <InputNumber
              className={styles.expiryInput ?? ''}
              min={0}
              placeholder="分钟"
              value={minutes}
              onChange={(value) => setMinutes(value ?? 0)}
              addonAfter="分钟"
            />
            <InputNumber
              className={styles.expiryInput ?? ''}
              min={0}
              placeholder="小时"
              value={hours}
              onChange={(value) => setHours(value ?? 0)}
              addonAfter="小时"
            />
            <InputNumber
              className={styles.expiryInput ?? ''}
              min={0}
              placeholder="天"
              value={days}
              onChange={(value) => setDays(value ?? 0)}
              addonAfter="天"
            />
          </div>
        </Form.Item>

        <Form.Item name="max_downloads" label="最大下载次数（可选）">
          <InputNumber min={1} placeholder="留空表示不限" style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
