import { useCallback, useEffect, useState } from 'react';
import { Form, Modal, Radio, message } from 'antd';
import { updateProject } from '../../api/projects';
import { PERMISSION_SECTIONS } from '../../constants/project';
import type { Project } from '../../types/project';
import styles from './ProjectPermissionsModal.module.css';

/** 分区权限取值：readonly 只读 / manage 可管理 */
type SectionPermission = 'readonly' | 'manage';

interface ProjectPermissionsModalProps {
  project: Project;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const PERMISSION_OPTIONS = [
  { value: 'readonly', label: '只读' },
  { value: 'manage', label: '可管理' },
];

export default function ProjectPermissionsModal({
  project,
  open,
  onClose,
  onSuccess,
}: ProjectPermissionsModalProps) {
  const [form] = Form.useForm<Record<string, SectionPermission>>();
  const [submitting, setSubmitting] = useState(false);

  // 打开时从 member_permissions 回填各分区值：缺失视为 manage，
  // 历史受限值（view/viewer 等）按只读处理，保证两档语义不回退
  useEffect(() => {
    if (!open) return;
    const initial = Object.keys(PERMISSION_SECTIONS).reduce<Record<string, SectionPermission>>(
      (acc, key) => {
        const level = project.member_permissions?.[key];
        acc[key] =
          level === 'readonly' || level === 'view' || level === 'viewer' ? 'readonly' : 'manage';
        return acc;
      },
      {},
    );
    form.setFieldsValue(initial);
  }, [open, project.member_permissions, form]);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const member_permissions: Record<string, string> = {};
      for (const key of Object.keys(PERMISSION_SECTIONS)) {
        member_permissions[key] = values[key] === 'readonly' ? 'readonly' : 'manage';
      }
      setSubmitting(true);
      const res = await updateProject(project.id, { member_permissions });
      if (res.code === 0) {
        message.success('分区权限已保存');
        onClose();
        onSuccess?.();
      } else {
        message.error(res.msg || '保存失败');
      }
    } catch (err: unknown) {
      if (err instanceof Error) message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }, [form, project.id, onClose, onSuccess]);

  return (
    <Modal
      title="分区权限设置"
      open={open}
      width={560}
      onOk={handleSave}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      confirmLoading={submitting}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        {Object.entries(PERMISSION_SECTIONS).map(([key, label]) => (
          <Form.Item
            key={key}
            name={key}
            className={styles.formItem ?? ''}
          >
            <div className={styles.row ?? ''}>
              <span className={styles.label ?? ''}>{label}</span>
              <Radio.Group
                size="small"
                options={PERMISSION_OPTIONS}
              />
            </div>
          </Form.Item>
        ))}
      </Form>
    </Modal>
  );
}
