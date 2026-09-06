import { useEffect, useMemo, useState } from 'react';
import {
  AutoComplete,
  Form,
  Input,
  Modal,
  Select,
  message,
} from 'antd';
import type { Project } from '../../../types/project';
import type {
  ProjectMember,
  ProjectMemberCreate,
  ProjectMemberUpdate,
} from '../../../types/project-member';
import type { User } from '../../../types/user';
import {
  createProjectMember,
  updateProjectMember,
} from '../../../api/project-members';
import { listUsers } from '../../../api/users';
import { updateProject } from '../../../api/projects';

const { TextArea } = Input;

/** 职务预设（下拉可选 + 自由填写） */
const ROLE_PRESETS = ['开发', '设计', '测试', '运维', '文档', '顾问', '其他'];

interface MemberModalProps {
  project: Project;
  /** 控制弹窗显隐 */
  open: boolean;
  /** 非空表示编辑模式；null 表示新建 */
  editingMember?: ProjectMember | null;
  /** 项目现有成员（用于新建时过滤已加入的用户） */
  existingMembers: ProjectMember[];
  /** 是否为项目负责人（新建成功后决定是否同步项目访问权限） */
  isOwner: boolean;
  onClose: () => void;
  /** 保存成功回调（父组件刷新列表） */
  onSaved: () => void;
}

interface MemberFormValues {
  user_ids?: string[];
  role_title?: string;
  notes?: string;
}

/**
 * 项目成员 新建/编辑 共用弹窗
 *
 * 供「项目成员管理 Tab」（ProjectMemberTab）复用，
 * 保证添加/编辑成员的表单与逻辑全局一致，后续只需修改此处一处。
 * 移除/拉回/权限设置等操作仍由 Tab 内的权限按钮负责。
 */
export default function MemberModal({
  project,
  open,
  editingMember = null,
  existingMembers,
  isOwner,
  onClose,
  onSaved,
}: MemberModalProps) {
  const [form] = Form.useForm<MemberFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  // 打开弹窗时：重置表单、回填编辑值、加载可选用户
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editingMember) {
      form.setFieldsValue({
        ...(editingMember.role_title ? { role_title: editingMember.role_title } : {}),
        ...(editingMember.notes ? { notes: editingMember.notes } : {}),
      });
    }

    listUsers({ page_size: 100 }).then((res) => {
      if (res.code === 0) setUsers(res.data.items);
    }).catch(() => {});
  }, [open, editingMember, form]);

  // 可选用户：排除项目负责人与已加入（含历史）的成员
  const userOptions = useMemo(() => {
    const memberIds = new Set(existingMembers.map((m) => m.user_id));
    return users
      .filter((u) => u.id !== project.owner_id && !memberIds.has(u.id))
      .map((u) => ({
        value: u.id,
        label:
          u.username && u.username !== u.nickname ? `${u.nickname}（${u.username}）` : u.nickname,
      }));
  }, [users, existingMembers, project.owner_id]);

  const handleSubmit = async () => {
    let values: MemberFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验未通过，Modal 会显示错误
    }
    setSubmitting(true);
    try {
      if (editingMember) {
        const roleTitle = (values.role_title as string | undefined)?.trim();
        const notes = (values.notes as string | undefined)?.trim();
        const payload: ProjectMemberUpdate = {
          ...(roleTitle ? { role_title: roleTitle } : {}),
          ...(notes ? { notes } : {}),
        };
        const res = await updateProjectMember(editingMember.id, payload);
        if (res.code === 0) {
          message.success('成员信息已更新');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '更新失败');
        }
      } else {
        const userIds: string[] = values.user_ids ?? [];
        if (userIds.length === 0) {
          message.warning('请选择要添加的用户');
          return;
        }
        const roleTitle = (values.role_title as string | undefined)?.trim();
        const notes = (values.notes as string | undefined)?.trim();

        const addedIds: string[] = [];
        for (const uid of userIds) {
          const payload: ProjectMemberCreate = {
            project_id: project.id,
            user_id: uid,
            ...(roleTitle ? { role_title: roleTitle } : {}),
            ...(notes ? { notes } : {}),
          };
          const res = await createProjectMember(payload);
          if (res.code === 0) addedIds.push(uid);
        }

        if (addedIds.length > 0) {
          if (isOwner) {
            const syncRes = await updateProject(project.id, {
              member_ids: [...(project.member_ids ?? []), ...addedIds],
            });
            if (syncRes.code === 0) {
              message.success(`已添加 ${addedIds.length} 名成员`);
            } else {
              message.warning(syncRes.msg || '成员已添加，但同步项目访问权限失败');
            }
          } else {
            message.success(`已添加 ${addedIds.length} 名成员（如需同步项目访问权限请联系项目负责人）`);
          }
          onClose();
          onSaved();
        } else {
          message.warning('没有成功添加任何成员');
        }
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '保存成员失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={editingMember ? '编辑成员信息' : '添加项目成员'}
      open={open}
      onOk={() => void handleSubmit()}
      onCancel={onClose}
      confirmLoading={submitting}
      okText="保存"
      cancelText="取消"
      destroyOnClose
      width={560}
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Form form={form} layout="vertical">
        {!editingMember && (
          <Form.Item
            name="user_ids"
            label="选择用户"
            rules={[{ required: true, message: '请至少选择一位用户' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择要添加的用户"
              showSearch
              optionFilterProp="label"
              maxTagCount="responsive"
              options={userOptions}
            />
          </Form.Item>
        )}
        <Form.Item
          name="role_title"
          label="职务"
          rules={[{ required: true, whitespace: true, message: '请输入职务' }]}
        >
          {editingMember ? (
            <Input placeholder="请输入职务" maxLength={50} />
          ) : (
            <AutoComplete
              placeholder="请选择或输入职务"
              options={ROLE_PRESETS.map((r) => ({ value: r, label: r }))}
            />
          )}
        </Form.Item>
        <Form.Item name="notes" label="备注">
          <TextArea placeholder="选填，成员备注说明" rows={3} maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
