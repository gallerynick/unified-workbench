import { useState } from 'react';
import { Modal, Upload, Progress, TreeSelect, DatePicker, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadFile, RcFile } from 'antd/es/upload';
import type { Dayjs } from 'dayjs';
import { uploadWithProgress } from '../../utils/request';
import VisibilitySetting from './VisibilitySetting';
import type { Visibility } from '../../utils/visibility';
import type { Folder } from '../../types/file';
import styles from './FileUploadModal.module.css';

const { Dragger } = Upload;

function buildFolderTree(folders: Folder[]): Array<{ value: string; title: string; children?: Array<{ value: string; title: string }> }> {
  const map = new Map<string, { value: string; title: string; children: Array<{ value: string; title: string }> }>();
  const roots: Array<{ value: string; title: string; children?: Array<{ value: string; title: string }> }> = [];

  for (const f of folders) {
    map.set(f.id, { value: f.id, title: f.name, children: [] });
  }

  for (const f of folders) {
    const node = map.get(f.id)!;
    if (f.parent_id && map.has(f.parent_id)) {
      map.get(f.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

interface FileUploadModalProps {
  visible: boolean;
  folders: Folder[];
  currentFolderId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

// 允许的文件类型
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-rar-compressed',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export default function FileUploadModal({
  visible,
  folders,
  currentFolderId,
  onClose,
  onSuccess,
}: FileUploadModalProps) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId);
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [restrictedUsers, setRestrictedUsers] = useState<string[]>([]);
  const [restrictedTags, setRestrictedTags] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<Dayjs | null>(null);

  const resetState = () => {
    setFileList([]);
    setUploading(false);
    setProgress(0);
    setSelectedFolderId(currentFolderId);
    setVisibility('private');
    setRestrictedUsers([]);
    setRestrictedTags([]);
    setExpiresAt(null);
  };

  const handleClose = () => {
    if (!uploading) {
      resetState();
      onClose();
    }
  };

  const validateFile = (file: RcFile): boolean => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      message.error('不支持的文件类型');
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      message.error('文件大小不能超过 50MB');
      return false;
    }
    return true;
  };

  const handleUpload = async () => {
    const file = fileList[0]?.originFileObj;
    if (!file) {
      message.error('请先选择文件');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const extraData: Record<string, string> = {
        visibility,
      };

      if (selectedFolderId) {
        extraData.folder_id = selectedFolderId;
      }

      if (visibility === 'restricted') {
        if (restrictedUsers.length > 0) {
          extraData.restricted_users = restrictedUsers.join(',');
        }
        if (restrictedTags.length > 0) {
          extraData.restricted_tags = restrictedTags.join(',');
        }
      }

      if (expiresAt) {
        extraData.expires_at = expiresAt.toISOString();
      }

      const res = await uploadWithProgress(
        '/files/upload',
        file,
        (percent) => setProgress(percent),
        extraData
      );

      if (res.code === 0) {
        message.success('文件上传成功');
        resetState();
        onSuccess();
      } else {
        message.error(res.msg || '上传失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '上传失败';
      message.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const uploadProps = {
    onRemove: () => {
      setFileList([]);
    },
    beforeUpload: (file: RcFile) => {
      if (validateFile(file)) {
        setFileList([file as unknown as UploadFile]);
      }
      return false;
    },
    fileList,
    maxCount: 1,
    multiple: false,
  };

  return (
    <Modal
      title="上传文件"
      open={visible}
      onOk={handleUpload}
      onCancel={handleClose}
      okText="上传"
      cancelText="取消"
      confirmLoading={uploading}
      okButtonProps={{ disabled: fileList.length === 0 }}
      className={styles.modal ?? ''}
      destroyOnClose
    >
      <div className={styles.form ?? ''}>
        <div className={styles.uploadSection ?? ''}>
          <Dragger {...uploadProps} className={styles.uploadArea ?? ''}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">
              支持图片、文档、表格、压缩包等格式，单文件最大 50MB
            </p>
          </Dragger>
        </div>

        {uploading && (
          <div className={styles.progressSection ?? ''}>
            <p className={styles.progressLabel ?? ''}>上传进度</p>
            <Progress percent={progress} status="active" />
            {fileList[0] && (
              <p className={styles.fileName ?? ''}>{fileList[0].name}</p>
            )}
          </div>
        )}

        <div className={styles.formItem ?? ''}>
          <p className={styles.sectionLabel ?? ''}>目标文件夹</p>
          <TreeSelect
            placeholder="选择文件夹（可选）"
            value={selectedFolderId}
            onChange={setSelectedFolderId}
            allowClear
            treeLine
            style={{ width: '100%' }}
            treeData={[
              { value: '', title: '根目录', children: buildFolderTree(folders) },
            ]}
          />
        </div>

        <div className={styles.visibilitySection ?? ''}>
          <p className={styles.sectionLabel ?? ''}>可见性设置</p>
          <VisibilitySetting
            value={visibility}
            restrictedUsers={restrictedUsers}
            restrictedTags={restrictedTags}
            onChange={setVisibility}
            onRestrictedUsersChange={setRestrictedUsers}
            onRestrictedTagsChange={setRestrictedTags}
          />
        </div>

        <div className={styles.formItem ?? ''}>
          <p className={styles.sectionLabel ?? ''}>过期时间</p>
          <DatePicker
            showTime
            format="YYYY-MM-DD HH:mm"
            placeholder="选择过期时间（可选）"
            value={expiresAt}
            onChange={setExpiresAt}
            disabledDate={(current) => current && current.isBefore(Date.now(), 'day')}
            style={{ width: '100%' }}
            allowClear
          />
        </div>
      </div>
    </Modal>
  );
}
