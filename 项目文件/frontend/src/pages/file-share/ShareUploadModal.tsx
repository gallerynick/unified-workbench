import { useEffect, useState } from 'react';
import { Modal, Upload, Form, Input, InputNumber, Button, message, Progress } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadFile, RcFile, UploadProps } from 'antd/es/upload';
import { uploadWithProgress } from '../../utils/request';
import styles from './ShareUploadModal.module.css';

const { Dragger } = Upload;

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB

interface ShareFormValues {
  password?: string;
  max_downloads?: number | null;
}

interface ShareUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ShareUploadModal({ visible, onClose, onSuccess }: ShareUploadModalProps) {
  const [form] = Form.useForm<ShareFormValues>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [minutes, setMinutes] = useState(0);
  const [hours, setHours] = useState(0);
  const [days, setDays] = useState(0);
  const [expiryError, setExpiryError] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (visible) {
      setFileList([]);
      setSelectedFile(null);
      setMinutes(0);
      setHours(0);
      setDays(0);
      setExpiryError(undefined);
      setUploading(false);
      setProgress(0);
      form.resetFields();
    }
  }, [visible, form]);

  const handleClose = () => {
    setFileList([]);
    setSelectedFile(null);
    setUploading(false);
    setProgress(0);
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
    beforeUpload: (file: RcFile) => {
      if (!validateFileSize(file)) return Upload.LIST_IGNORE;
      setSelectedFile(file);
      return false; // 阻止 antd 自动上传，改由「确定上传」统一校验后手动发起
    },
    onChange: (info) => {
      setFileList(info.fileList);
      if (info.fileList.length === 0) {
        setSelectedFile(null);
      }
    },
    fileList,
    maxCount: 1,
    multiple: false,
    showUploadList: true,
  };

  const handleConfirm = async () => {
    // 1. 校验文件已选
    if (!selectedFile) {
      message.warning('请先选择文件');
      return;
    }
    // 2. 校验有效期至少一项 > 0
    if (minutes <= 0 && hours <= 0 && days <= 0) {
      const errorMsg = '至少需指定一个过期时间（分钟/小时/天）';
      setExpiryError(errorMsg);
      message.error(errorMsg);
      return;
    }
    setExpiryError(undefined);

    // 3. 校验表单（密码 >= 4 位 / 下载次数 >= 1），失败时表单已显示对应错误
    let values: ShareFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    // 4. 全部通过 → 手动上传（带进度）
    setUploading(true);
    setProgress(0);
    try {
      const extraData: Record<string, string> = {
        file_name: selectedFile.name,
        file_size: String(selectedFile.size),
        expires_in_minutes: String(minutes),
        expires_in_hours: String(hours),
        expires_in_days: String(days),
      };
      if (selectedFile.type) extraData.mime_type = selectedFile.type;
      if (values.password) extraData.password = values.password;
      if (values.max_downloads != null) extraData.max_downloads = String(values.max_downloads);

      const res = await uploadWithProgress('/file-shares/', selectedFile, setProgress, extraData);
      if (res.code === 0) {
        message.success('文件分享创建成功');
        onClose();
        onSuccess();
      } else {
        message.error(res.msg || '上传失败');
        setUploading(false);
      }
    } catch {
      message.error('上传失败');
      setUploading(false);
    }
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
        <Button key="confirm" type="primary" loading={uploading} onClick={handleConfirm}>
          确定上传
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
          {...(expiryError ? { validateStatus: 'error' as const, help: expiryError } : {})}
        >
          <div className={styles.expiryRow}>
            <InputNumber
              className={styles.expiryInput ?? ''}
              min={0}
              placeholder="分钟"
              value={minutes}
              onChange={(value) => {
                setExpiryError(undefined);
                setMinutes(value ?? 0);
              }}
              addonAfter="分钟"
            />
            <InputNumber
              className={styles.expiryInput ?? ''}
              min={0}
              placeholder="小时"
              value={hours}
              onChange={(value) => {
                setExpiryError(undefined);
                setHours(value ?? 0);
              }}
              addonAfter="小时"
            />
            <InputNumber
              className={styles.expiryInput ?? ''}
              min={0}
              placeholder="天"
              value={days}
              onChange={(value) => {
                setExpiryError(undefined);
                setDays(value ?? 0);
              }}
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

        <Form.Item
          name="max_downloads"
          label="最大下载次数（可选）"
          rules={[{ type: 'number', min: 1, message: '下载次数至少为 1' }]}
        >
          <InputNumber min={1} placeholder="留空表示不限" style={{ width: '100%' }} />
        </Form.Item>
      </Form>

      {uploading && (
        <div className={styles.progress}>
          <Progress percent={progress} />
        </div>
      )}
    </Modal>
  );
}
