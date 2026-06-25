import { useState, useEffect } from 'react';
import { Modal, Switch, DatePicker, Alert, Space, Typography, Divider, message } from 'antd';
import { FolderOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import VisibilitySetting from './VisibilitySetting';
import type { Visibility } from '../../utils/visibility';
import type { Folder } from '../../types/file';
import { updateFolder } from '../../api/files';
import styles from './FolderSettingsModal.module.css';

const { Text } = Typography;

interface FolderSettingsModalProps {
  visible: boolean;
  folder: Folder | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FolderSettingsModal({
  visible,
  folder,
  onClose,
  onSuccess,
}: FolderSettingsModalProps) {
  const [unifiedManagement, setUnifiedManagement] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [restrictedUsers, setRestrictedUsers] = useState<string[]>([]);
  const [restrictedTags, setRestrictedTags] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<Dayjs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (folder && visible) {
      setUnifiedManagement(folder.unified_management);
      setVisibility(folder.visibility);
      setRestrictedUsers(folder.restricted_users ?? []);
      setRestrictedTags(folder.restricted_tags ?? []);
      setExpiresAt(folder.expires_at ? dayjs(folder.expires_at) : null);
    }
  }, [folder, visible]);

  const handleSave = async () => {
    if (!folder) return;

    setSaving(true);
    try {
      const res = await updateFolder(folder.id, {
        unified_management: unifiedManagement,
        visibility,
        restricted_users: visibility === 'restricted' ? restrictedUsers : [],
        restricted_tags: visibility === 'restricted' ? restrictedTags : [],
        expires_at: expiresAt ? expiresAt.toISOString() : null,
      });

      if (res.code === 0) {
        message.success('文件夹设置已保存');
        onSuccess();
        onClose();
      } else {
        message.error(res.msg || '保存失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存失败';
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleUnifiedToggle = (checked: boolean) => {
    setUnifiedManagement(checked);
  };

  if (!folder) return null;

  return (
    <Modal
      title={
        <Space>
          <FolderOutlined />
          <span>文件夹设置 — {folder.name}</span>
        </Space>
      }
      open={visible}
      onOk={handleSave}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      confirmLoading={saving}
      width={520}
      destroyOnClose
    >
      <div className={styles.content}>
        {/* 统一管理开关 */}
        <div className={styles.section}>
          <div className={styles.switchRow}>
            <div className={styles.switchLabel}>
              <Text strong>统一管理</Text>
              <Text type="secondary" className={styles.switchDesc ?? ''}>
                开启后，文件夹内所有文件将继承文件夹的可见性和过期设置
              </Text>
            </div>
            <Switch
              checked={unifiedManagement}
              onChange={handleUnifiedToggle}
            />
          </div>

          {unifiedManagement && (
            <Alert
              message="开启统一管理后，文件夹内所有文件的可见性和过期时间将与文件夹保持一致。已有文件的独立设置将被覆盖。"
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              className={styles.warningAlert ?? ''}
            />
          )}
        </div>

        {unifiedManagement && (
          <>
            <Divider className={styles.divider ?? ''} />

            {/* 可见性设置 */}
            <div className={styles.section}>
              <Text strong className={styles.sectionTitle ?? ''}>可见性设置</Text>
              <div className={styles.settingContent}>
                <VisibilitySetting
                  value={visibility}
                  restrictedUsers={restrictedUsers}
                  restrictedTags={restrictedTags}
                  onChange={setVisibility}
                  onRestrictedUsersChange={setRestrictedUsers}
                  onRestrictedTagsChange={setRestrictedTags}
                  showDescription
                  layout="vertical"
                />
              </div>
            </div>

            <Divider className={styles.divider ?? ''} />

            {/* 过期时间设置 */}
            <div className={styles.section}>
              <Text strong className={styles.sectionTitle ?? ''}>过期时间</Text>
              <div className={styles.settingContent}>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Text type="secondary" className={styles.hint ?? ''}>
                    设置后，文件夹及其所有文件将在到期后自动标记为过期
                  </Text>
                  <DatePicker
                    showTime
                    format="YYYY-MM-DD HH:mm"
                    value={expiresAt}
                    onChange={(date) => setExpiresAt(date)}
                    placeholder="选择过期时间（可选）"
                    style={{ width: '100%' }}
                    allowClear
                    disabledDate={(current) => current && current < dayjs().startOf('day')}
                  />
                </Space>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
