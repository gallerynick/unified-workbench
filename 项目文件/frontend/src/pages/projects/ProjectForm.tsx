import { useEffect, useCallback, useState } from 'react';
import { Modal, Form, Input, Select, message } from 'antd';
import { createProject, updateProject } from '../../api/projects';
import { listUsers } from '../../api/users';
import type { Project, ProjectCreate, ProjectUpdate } from '../../types/project';
import type { Visibility } from '../../utils/visibility';
import VisibilitySetting from '@/components/VisibilitySetting/VisibilitySetting';

const { TextArea } = Input;

const STATUS_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'ongoing', label: '进行中' },
  { value: 'done', label: '已完成' },
  { value: 'archived', label: '已归档' },
];

interface UserOption {
  value: string;
  label: string;
}

interface ProjectFormProps {
  visible: boolean;
  mode: 'create' | 'edit';
  project: Project | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface UserItem {
  id: string;
  nickname?: string;
  username?: string;
}

export default function ProjectForm({ visible, mode, project, onClose, onSuccess }: ProjectFormProps) {
  const [form] = Form.useForm();
  const isEdit = mode === 'edit';
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [restrictedUsers, setRestrictedUsers] = useState<string[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);

  useEffect(() => {
    if (visible) {
      listUsers({ page: 1, page_size: 200 }).then((res) => {
        if (res.code === 0 && res.data) {
          const users = ((res.data as { items?: UserItem[] }).items || res.data) as UserItem[];
          setUserOptions(
            (Array.isArray(users) ? users : []).map((u) => ({
              value: u.id,
              label: (u.nickname) || (u.username) || u.id,
            }))
          );
        }
      }).catch(() => {});
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      if (isEdit && project) {
        form.setFieldsValue({
          title: project.title,
          number: project.number,
          description: project.description,
          status: project.status,
        });
        setVisibility((project.visibility as Visibility) || 'private');
        setRestrictedUsers(project.restricted_users || []);
        setMemberIds(project.member_ids || []);
      } else {
        form.resetFields();
        setVisibility('private');
        setRestrictedUsers([]);
        setMemberIds([]);
      }
    }
  }, [visible, isEdit, project, form]);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (isEdit && project) {
        const data: ProjectUpdate = {
          title: values.title,
          number: values.number || null,
          description: values.description || null,
          status: values.status,
          visibility,
          ...(visibility === 'restricted' && restrictedUsers.length > 0 ? { restricted_users: restrictedUsers } : {}),
          ...(memberIds.length > 0 ? { member_ids: memberIds } : {}),
        };
        const res = await updateProject(project.id, data);
        if (res.code === 0) {
          message.success('项目更新成功');
          onSuccess();
        } else {
          message.error(res.msg || '更新失败');
        }
      } else {
        const data: ProjectCreate = {
          title: values.title,
          number: values.number || undefined,
          description: values.description || undefined,
          status: 'draft',
          visibility,
          ...(values.owner_id ? { owner_id: values.owner_id } : {}),
          ...(visibility === 'restricted' && restrictedUsers.length > 0 ? { restricted_users: restrictedUsers } : {}),
          ...(memberIds.length > 0 ? { member_ids: memberIds } : {}),
        };
        const res = await createProject(data);
        if (res.code === 0) {
          message.success('项目创建成功');
          onSuccess();
        } else {
          message.error(res.msg || '创建失败');
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    }
  }, [form, isEdit, project, onSuccess, visibility, restrictedUsers, memberIds]);

  return (
    <Modal
      title={isEdit ? '编辑项目' : '新建项目'}
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnClose
      width={560}
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="title"
          label="项目名称"
          rules={[{ required: true, message: '请输入项目名称' }]}
        >
          <Input placeholder="请输入项目名称" maxLength={200} showCount />
        </Form.Item>
        <Form.Item
          name="number"
          label="项目编号"
          tooltip="可选的项目标识编号"
        >
          <Input placeholder="请输入项目编号（可选）" maxLength={50} />
        </Form.Item>
        <Form.Item
          name="description"
          label="项目描述"
        >
          <TextArea placeholder="请输入项目描述（可选）" rows={3} maxLength={500} showCount />
        </Form.Item>
        {!isEdit && (
          <Form.Item
            name="owner_id"
            label="项目负责人"
            tooltip="不选择时默认由创建者本人担任项目负责人"
          >
            <Select
              placeholder="选择项目负责人（不选默认创建者本人）"
              options={userOptions}
              optionFilterProp="label"
              allowClear
            />
          </Form.Item>
        )}
        <Form.Item label="项目成员">
          <Select
            mode="multiple"
            placeholder="选择项目成员（可选）"
            options={userOptions}
            value={memberIds}
            onChange={setMemberIds}
            optionFilterProp="label"
            allowClear
          />
        </Form.Item>
        {isEdit && (
          <Form.Item
            name="status"
            label="项目状态"
            rules={[{ required: true, message: '请选择项目状态' }]}
          >
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
        )}
        <Form.Item label="可见性">
          <VisibilitySetting
            value={visibility}
            restrictedUsers={restrictedUsers}
            onChange={setVisibility}
            onRestrictedUsersChange={setRestrictedUsers}
            showRestrictedTags={false}
            label=""
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
