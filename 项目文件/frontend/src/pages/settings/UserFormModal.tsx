import { useEffect } from 'react';
import { Modal, Form, Input, Select, message } from 'antd';
import { createUser, updateUser } from '../../api/users';
import type { User, UserCreateRequest, UserUpdateRequest } from '../../types/user';
import styles from './UserFormModal.module.css';

interface UserFormModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  user: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

// 预设标签选项（后续可从 API 获取）
const TAG_OPTIONS = [
  { value: 'tag-1', label: '开发', color: 'blue' },
  { value: 'tag-2', label: '设计', color: 'purple' },
  { value: 'tag-3', label: '运营', color: 'green' },
  { value: 'tag-4', label: '管理', color: 'gold' },
];

export default function UserFormModal({
  visible,
  mode,
  user,
  onClose,
  onSuccess,
}: UserFormModalProps) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      if (mode === 'edit' && user) {
        form.setFieldsValue({
          username: user.username,
          nickname: user.nickname,
          role: user.role,
          status: user.status,
          tags: user.tags.map((t) => t.id),
        });
      } else {
        form.resetFields();
      }
    }
  }, [visible, mode, user, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (mode === 'create') {
        const payload: UserCreateRequest = {
          username: values.username,
          password: values.password,
          nickname: values.nickname,
          role: values.role,
          tags: values.tags,
        };
        const res = await createUser(payload);
        if (res.code === 0) {
          message.success('用户创建成功');
          onSuccess();
        } else {
          message.error(res.msg || '创建失败');
        }
      } else if (user) {
        const payload: UserUpdateRequest = {
          nickname: values.nickname,
          role: values.role,
          status: values.status,
          tags: values.tags,
        };
        const res = await updateUser(user.id, payload);
        if (res.code === 0) {
          message.success('用户更新成功');
          onSuccess();
        } else {
          message.error(res.msg || '更新失败');
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    }
  };

  return (
    <Modal
      title={mode === 'create' ? '新建用户' : '编辑用户'}
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnClose
      className={styles.modal ?? ''}
    >
      <Form
        form={form}
        layout="vertical"
        className={styles.form ?? ''}
        initialValues={{ role: 'member' }}
      >
        <Form.Item
          name="username"
          label="用户名"
          rules={[{ required: true, message: '请输入用户名' }]}
        >
          <Input
            placeholder="请输入用户名"
            disabled={mode === 'edit'}
          />
        </Form.Item>

        {mode === 'create' && (
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
        )}

        <Form.Item
          name="nickname"
          label="昵称"
          rules={[{ required: true, message: '请输入昵称' }]}
        >
          <Input placeholder="请输入昵称" />
        </Form.Item>

        <Form.Item
          name="role"
          label="角色"
        >
          <Select
            options={[
              { value: 'admin', label: '管理员' },
              { value: 'member', label: '普通成员' },
            ]}
          />
        </Form.Item>

        {mode === 'edit' && (
          <Form.Item
            name="status"
            label="状态"
          >
            <Select
              options={[
                { value: 'active', label: '启用' },
                { value: 'disabled', label: '禁用' },
              ]}
            />
          </Form.Item>
        )}

        <Form.Item
          name="tags"
          label="标签"
        >
          <Select
            mode="multiple"
            placeholder="请选择标签"
            options={TAG_OPTIONS}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
