import { useEffect, useState } from 'react';
import { Modal, Upload, Form, Input, InputNumber, Button, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadFile, RcFile, UploadProps } from 'antd/es/upload';
import { getToken } from '../../utils/auth';
import { UPLOAD_BASE } from '../../api/file-shares';
import styles from './ShareUploadModal.module.css';

const { Dragger } = Upload;

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB

interface ShareUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ShareUploadModal({ visible, onClose, onSuccess }: ShareUploadModalProps) {
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [minutes, setMinutes] = useState(0);
  const [hours, setHours] = useState(0);
  const [days, setDays] = useState(0);

  useEffect(() => {
    if (visible) {
      setFileList([]);
      setMinutes(0);
      setHours(0);
      setDays(0);
      form.resetFields();
    }
  }, [visible, form]);

  const handleClose = () => {
    setFileList([]);
    onClose();
  };

  const validateFileSize = (file: RcFile): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      message.error('文件大小不能超过 1GB');
      return false;
    }
    return true;
  };

  const uploadProps: UploadProps = {
    action: UPLOAD_BASE,
    method: 'post',
    headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    data: (file: UploadFile) => {
      const values = form.getFieldsValue();
      const extra: Record<string, string | number> = {
        file_name: file.name,
        file_size: file.size ?? 0,
        expires_in_minutes: minutes,
        expires_in_hours: hours,
        expires_in_days: days,
      };
      if (file.type) extra.mime_type = file.type;
      if (values.password) extra.password = values.password;
      if (values.max_downloads != null) extra.max_downloads = values.max_downloads;
      return extra;
    },
    beforeUpload: async (file: RcFile) => {
      if (!validateFileSize(file)) return false;
      try {
        await form.validateFields();
        return true;
      } catch {
        return false;
      }
    },
    onChange: (info) => {
      setFileList(info.fileList);
      const { status } = info.file;
      if (status === 'done') {
        const response = info.file.response as { code?: number; msg?: string } | undefined;
        if (response && response.code === 0) {
          message.success('文件分享创建成功');
          onClose();
          onSuccess();
        } else {
          message.error(response?.msg || '上传失败');
          setFileList([]);
        }
      } else if (status === 'error') {
        message.error('上传失败');
        setFileList([]);
      }
    },
    fileList,
    maxCount: 1,
    multiple: false,
    showUploadList: true,
  };

  return (
    <Modal
      title="上传文件分享"
      open={visible}
      onCancel={handleClose}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          取消
        </Button>,
      ]}
      width={560}
      destroyOnClose
      className={styles.modal ?? ''}
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="选择文件" required extra="支持任意类型文件，单文件最大 1GB">
          <Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">支持任意格式，单文件最大 1GB</p>
          </Dragger>
        </Form.Item>

        <Form.Item
          label="有效期"
          required
          rules={[
            {
              validator: () => {
                if (minutes <= 0 && hours <= 0 && days <= 0) {
                  return Promise.reject(new Error('至少需指定一个过期时间（分钟/小时/天）'));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
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

        <Form.Item
          name="password"
          label="访问密码（可选）"
          rules={[{ min: 4, message: '密码至少 4 位' }]}
        >
          <Input.Password placeholder="设置后他人需输入密码才能下载" autoComplete="new-password" />
        </Form.Item>

        <Form.Item name="max_downloads" label="最大下载次数（可选）">
          <InputNumber min={1} placeholder="留空表示不限" style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
