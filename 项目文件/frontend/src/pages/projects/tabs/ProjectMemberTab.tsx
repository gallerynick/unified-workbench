import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AutoComplete,
  Avatar,
  Button,
  Form,
  Input,
  Modal,
  Radio,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  CrownOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  SettingOutlined,
  UndoOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  createProjectMember,
  listProjectMembers,
  updateProjectMember,
} from '../../../api/project-members';
import { listUsers } from '../../../api/users';
import { updateProject } from '../../../api/projects';
import { PERMISSION_SECTIONS } from '../../../constants/project';
import type { Project } from '../../../types/project';
import type { ProjectMember } from '../../../types/project-member';
import type { User } from '../../../types/user';
import { useUser } from '../../../contexts/UserContext';
import styles from './ProjectMemberTab.module.css';

const { Text } = Typography;

/** 职务预设（下拉可选 + 自由填写） */
const ROLE_PRESETS = ['开发', '设计', '测试', '运维', '文档', '顾问', '其他'];

interface ProjectMemberTabProps {
  project: Project;
  /** 项目数据更新回调（成员权限保存后刷新 project 数据） */
  onUpdate?: (data: Record<string, unknown>) => Promise<void>;
}

/** 格式化日期，null / 非法值显示为 - */
function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ProjectMemberTab({ project, onUpdate }: ProjectMemberTabProps) {
  const { user } = useUser();

  // ── 数据状态 ──
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // ── UI 状态 ──
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<ProjectMember | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [permissionMember, setPermissionMember] = useState<ProjectMember | null>(null);
  const [permissionValues, setPermissionValues] = useState<Record<string, string>>({});

  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const isOwner = !!user && user.id === project.owner_id;

  // 权限：负责人/管理员全权限；普通成员按 project.member_permissions 的 members 分区判断，
  // 分区为 readonly 时操作按钮禁用，未配置默认允许（与后端校验一致）
  const canManage = useMemo(() => {
    if (!user) return false;
    if (user.id === project.owner_id || user.role === 'admin') return true;
    return project.member_permissions?.[user.id]?.['members'] !== 'readonly';
  }, [user, project]);

  // 私有项目不允许添加项目成员
  const isPrivate = project.visibility === 'private';

  // ── 数据加载 ──
  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listProjectMembers({ project_id: project.id, page_size: 100 });
      if (res.code === 0) {
        setMembers(res.data.items);
      } else {
        message.error(res.msg || '获取成员列表失败');
      }
    } catch (err: unknown) {
      if (err instanceof Error) message.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await listUsers({ page_size: 100 });
      if (res.code === 0) setUsers(res.data.items);
    } catch {
      // 用户列表加载失败不阻断成员列表展示
    }
  }, []);

  useEffect(() => {
    void fetchMembers();
    void fetchUsers();
  }, [fetchMembers, fetchUsers]);

  // ── 派生数据 ──
  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  const activeMembers = useMemo(() => members.filter((m) => m.is_active), [members]);
  const historyMembers = useMemo(() => members.filter((m) => !m.is_active), [members]);

  const getDisplayName = useCallback(
    (m: ProjectMember): string => {
      const u = userMap.get(m.user_id);
      if (u) return u.nickname || u.username || m.user_id;
      return m.user_id;
    },
    [userMap],
  );

  const getUsername = useCallback(
    (m: ProjectMember): string => {
      const u = userMap.get(m.user_id);
      return u?.username ?? '';
    },
    [userMap],
  );

  const getAvatar = useCallback(
    (m: ProjectMember): string | undefined => {
      const u = userMap.get(m.user_id);
      return u?.avatar || undefined;
    },
    [userMap],
  );

  const existingMemberIds = useMemo(
    () => new Set(activeMembers.map((m) => m.user_id)),
    [activeMembers],
  );

  const historyMemberIds = useMemo(
    () => new Set(historyMembers.map((m) => m.user_id)),
    [historyMembers],
  );

  // 可选用户：排除已是当前成员/历史成员的用户与项目负责人
  const userOptions = useMemo(
    () =>
      users
        .filter((u) => u.id !== project.owner_id && !existingMemberIds.has(u.id) && !historyMemberIds.has(u.id))
        .map((u) => ({
          value: u.id,
          label:
            u.username && u.username !== u.nickname ? `${u.nickname}（${u.username}）` : u.nickname,
        })),
    [users, project.owner_id, existingMemberIds, historyMemberIds],
  );

  // ── 添加成员 ──
  const openAddModal = useCallback(() => {
    addForm.resetFields();
    setAddModalVisible(true);
  }, [addForm]);

  const handleAddMembers = useCallback(async () => {
    try {
      const values = await addForm.validateFields();
      const userIds: string[] = values.user_ids ?? [];
      if (userIds.length === 0) {
        message.warning('请选择要添加的用户');
        return;
      }
      const roleTitle = (values.role_title as string | undefined)?.trim();
      const notes = (values.notes as string | undefined)?.trim();
      setSubmitting(true);

      const addedIds: string[] = [];
      for (const uid of userIds) {
        const res = await createProjectMember({
          project_id: project.id,
          user_id: uid,
          ...(roleTitle ? { role_title: roleTitle } : {}),
          ...(notes ? { notes } : {}),
        });
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
        setAddModalVisible(false);
        await fetchMembers();
      } else {
        message.warning('没有成功添加任何成员');
      }
    } catch (err: unknown) {
      if (err instanceof Error) message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }, [addForm, project.id, project.member_ids, isOwner, fetchMembers]);

  // ── 编辑成员 ──
  const openEditModal = useCallback(
    (member: ProjectMember) => {
      setEditingMember(member);
      editForm.setFieldsValue({
        role_title: member.role_title ?? '',
        notes: member.notes ?? '',
      });
      setEditModalVisible(true);
    },
    [editForm],
  );

  const handleUpdateMember = useCallback(async () => {
    if (!editingMember) return;
    try {
      const values = await editForm.validateFields();
      const roleTitle = (values.role_title as string | undefined)?.trim();
      const notes = (values.notes as string | undefined)?.trim();
      setSubmitting(true);
      const res = await updateProjectMember(editingMember.id, {
        ...(roleTitle ? { role_title: roleTitle } : {}),
        ...(notes ? { notes } : {}),
      });
      if (res.code === 0) {
        message.success('成员信息已更新');
        setEditModalVisible(false);
        await fetchMembers();
      } else {
        message.error(res.msg || '更新失败');
      }
    } catch (err: unknown) {
      if (err instanceof Error) message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }, [editingMember, editForm, fetchMembers]);

  // ── 移除成员（软删除：is_active=false + left_at） ──
  const handleRemoveMember = useCallback(
    (member: ProjectMember) => {
      Modal.confirm({
        title: '确认移除成员',
        icon: <ExclamationCircleOutlined />,
        content: `确定要将「${getDisplayName(member)}」从项目中移除吗？移除后可在历史成员中查看。`,
        okText: '移除',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          try {
            const res = await updateProjectMember(member.id, {
              is_active: false,
              left_at: new Date().toISOString(),
            });
            if (res.code !== 0) {
              message.error(res.msg || '移除失败');
              return;
            }
            if (isOwner) {
              const nextIds = (project.member_ids ?? []).filter((id) => id !== member.user_id);
              const syncRes = await updateProject(project.id, { member_ids: nextIds });
              if (syncRes.code !== 0) {
                message.warning(syncRes.msg || '成员已移除，但同步项目访问权限失败');
              }
            }
            message.success('成员已移除');
            await fetchMembers();
          } catch (err: unknown) {
            if (err instanceof Error) message.error(err.message);
          }
        },
      });
    },
    [getDisplayName, isOwner, project.id, project.member_ids, fetchMembers],
  );

  // ── 拉回历史成员（is_active=true + left_at=null） ──
  const handleRecoverMember = useCallback(
    async (member: ProjectMember) => {
      try {
        const res = await updateProjectMember(member.id, {
          is_active: true,
          left_at: null,
        });
        if (res.code !== 0) {
          message.error(res.msg || '拉回失败');
          return;
        }
        if (isOwner) {
          const syncRes = await updateProject(project.id, {
            member_ids: [...(project.member_ids ?? []), member.user_id],
          });
          if (syncRes.code !== 0) {
            message.warning(syncRes.msg || '成员已拉回，但同步项目访问权限失败');
          }
        }
        message.success(`已拉回「${getDisplayName(member)}」`);
        await fetchMembers();
      } catch (err: unknown) {
        if (err instanceof Error) message.error(err.message);
      }
    },
    [getDisplayName, isOwner, project.id, project.member_ids, fetchMembers],
  );

  // ── 成员权限设置 ──
  const openPermissionModal = useCallback(
    (member: ProjectMember) => {
      const current = project.member_permissions?.[member.user_id] ?? {};
      const initial: Record<string, string> = {};
      for (const key of Object.keys(PERMISSION_SECTIONS)) {
        initial[key] = current[key] ?? 'manage';
      }
      setPermissionValues(initial);
      setPermissionMember(member);
      setPermissionModalVisible(true);
    },
    [project.member_permissions],
  );

  const handleSavePermission = useCallback(async () => {
    if (!permissionMember) return;
    const newPerms = {
      ...(project.member_permissions ?? {}),
      [permissionMember.user_id]: { ...permissionValues },
    };
    try {
      const res = await updateProject(project.id, { member_permissions: newPerms });
      if (res.code === 0) {
        message.success('权限已更新');
        setPermissionModalVisible(false);
        if (onUpdate) {
          await onUpdate({ member_permissions: newPerms });
        }
      } else {
        message.error(res.msg || '权限更新失败');
      }
    } catch (err: unknown) {
      if (err instanceof Error) message.error(err.message);
    }
  }, [permissionMember, permissionValues, project.id, project.member_permissions, onUpdate]);

  // ── 表格列 ──
  const columns = useMemo<ColumnsType<ProjectMember>>(() => {
    const baseColumns: ColumnsType<ProjectMember> = [
      {
        title: '成员',
        key: 'member',
        render: (_, member) => {
          const avatarUrl = getAvatar(member);
          return (
            <div className={styles.memberCell ?? ''}>
              <Avatar size={32} src={avatarUrl || undefined} icon={<UserOutlined />}>
                {avatarUrl ? null : getDisplayName(member).slice(0, 1)}
              </Avatar>
              <div className={styles.memberInfo ?? ''}>
                <Text className={styles.memberName ?? ''}>{getDisplayName(member)}</Text>
                {getUsername(member) && (
                  <Text className={styles.memberUsername ?? ''}>@{getUsername(member)}</Text>
                )}
              </div>
            </div>
          );
        },
      },
      {
        title: '职务',
        dataIndex: 'role_title',
        key: 'role_title',
        render: (value: string | null) =>
          value || <Text type="secondary">未设置</Text>,
      },
      {
        title: '身份',
        key: 'role',
        width: 110,
        render: (_, member) => {
          const isProjectOwner = member.user_id === project.owner_id;
          if (isProjectOwner || member.is_owner) {
            return (
              <Tag color="gold" icon={<CrownOutlined />}>
                负责人
              </Tag>
            );
          }
          return <Tag>成员</Tag>;
        },
      },
      {
        title: '加入时间',
        dataIndex: 'joined_at',
        key: 'joined_at',
        width: 170,
        render: (value: string | null) => formatDate(value),
      },
      {
        title: '备注',
        dataIndex: 'notes',
        key: 'notes',
        render: (value: string | null) =>
          value ? <span className={styles.notes ?? ''}>{value}</span> : <Text type="secondary">-</Text>,
      },
    ];

    // 当前成员视图：附加操作列（仅可管理时显示操作按钮）
    if (viewMode === 'active') {
      const actionColumn: ColumnsType<ProjectMember>[number] = {
        title: '操作',
        key: 'action',
        width: 150,
        align: 'right',
        render: (_, member) => {
          if (!canManage) return null;
          const isOwnerMember = member.is_owner || member.user_id === project.owner_id;
          return (
            <Space size={4} className={styles.actionCell ?? ''}>
              {isOwner && (
                <Tooltip title="权限设置">
                  <Button
                    type="text"
                    size="small"
                    icon={<SettingOutlined />}
                    aria-label="权限设置"
                    onClick={() => openPermissionModal(member)}
                  />
                </Tooltip>
              )}
              <Tooltip title="编辑职务/备注">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  aria-label="编辑"
                  onClick={() => openEditModal(member)}
                />
              </Tooltip>
              {isOwnerMember ? (
                <Tooltip title="负责人不可移除">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label="移除"
                    disabled
                  />
                </Tooltip>
              ) : (
                <Tooltip title="移除成员">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label="移除"
                    onClick={() => handleRemoveMember(member)}
                  />
                </Tooltip>
              )}
            </Space>
          );
        },
      };
      return [...baseColumns, actionColumn];
    }

    // 历史成员视图：操作列 + 离开时间列
    const historyActionColumn: ColumnsType<ProjectMember>[number] = {
      title: '操作',
      key: 'action',
      width: 100,
      align: 'right',
      render: (_, member) => {
        if (!canManage) return null;
        return (
          <Tooltip title="拉回成员">
            <Button
              type="link"
              size="small"
              icon={<UndoOutlined />}
              onClick={() => handleRecoverMember(member)}
            >
              拉回
            </Button>
          </Tooltip>
        );
      },
    };
    return [
      ...baseColumns,
      historyActionColumn,
      {
        title: '离开时间',
        dataIndex: 'left_at',
        key: 'left_at',
        width: 170,
        render: (value: string | null) => formatDate(value),
      },
    ];
  }, [
    canManage,
    isOwner,
    project.owner_id,
    viewMode,
    getAvatar,
    getDisplayName,
    getUsername,
    openEditModal,
    openPermissionModal,
    handleRemoveMember,
    handleRecoverMember,
  ]);

  const dataSource = viewMode === 'active' ? activeMembers : historyMembers;

  return (
    <div className={styles.container ?? ''}>
      {/* 项目负责人 */}
      {userMap.get(project.owner_id) && (
        <div className={styles.ownerCard ?? ''}>
          <Avatar size={40} src={userMap.get(project.owner_id)?.avatar || undefined} icon={<UserOutlined />}>
            {userMap.get(project.owner_id)?.avatar ? null : (userMap.get(project.owner_id)?.nickname || userMap.get(project.owner_id)?.username || '?').slice(0, 1)}
          </Avatar>
          <div className={styles.ownerInfo ?? ''}>
            <Text className={styles.memberName ?? ''}>
              {userMap.get(project.owner_id)?.nickname || userMap.get(project.owner_id)?.username || project.owner_id}
            </Text>
            {userMap.get(project.owner_id)?.username && userMap.get(project.owner_id)?.username !== userMap.get(project.owner_id)?.nickname && (
              <Text className={styles.memberUsername ?? ''}>@{userMap.get(project.owner_id)?.username}</Text>
            )}
          </div>
          <Tag color="gold" icon={<CrownOutlined />} style={{ marginLeft: 'auto' }}>项目负责人</Tag>
        </div>
      )}

      <div className={styles.toolbar ?? ''}>
        <Segmented
          options={[
            { label: `当前成员（${activeMembers.length}）`, value: 'active' },
            { label: `历史成员（${historyMembers.length}）`, value: 'history' },
          ]}
          value={viewMode}
          onChange={(value) => setViewMode(value as 'active' | 'history')}
        />
        {viewMode === 'active' && canManage && (
          <Tooltip title={isPrivate ? '私有项目不允许添加项目成员' : undefined}>
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={openAddModal}
              disabled={isPrivate}
            >
              添加成员
            </Button>
          </Tooltip>
        )}
      </div>

      <Table<ProjectMember>
        rowKey="id"
        columns={columns}
        dataSource={dataSource}
        loading={loading}
        pagination={false}
        locale={{
          emptyText: viewMode === 'active' ? '暂无当前成员' : '暂无历史成员',
        }}
      />

      {/* 添加成员弹窗 */}
      <Modal
        title="添加项目成员"
        open={addModalVisible}
        onOk={handleAddMembers}
        onCancel={() => setAddModalVisible(false)}
        confirmLoading={submitting}
        destroyOnClose
        width={560}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Form form={addForm} layout="vertical">
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
          <Form.Item
            name="role_title"
            label="职务"
            rules={[{ required: true, whitespace: true, message: '请输入职务' }]}
          >
            <AutoComplete
              placeholder="请选择或输入职务"
              options={ROLE_PRESETS.map((r) => ({ value: r, label: r }))}
            />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea placeholder="选填，成员备注说明" rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑成员弹窗 */}
      <Modal
        title="编辑成员信息"
        open={editModalVisible}
        onOk={handleUpdateMember}
        onCancel={() => setEditModalVisible(false)}
        confirmLoading={submitting}
        destroyOnClose
        width={560}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="role_title"
            label="职务"
            rules={[{ required: true, whitespace: true, message: '请输入职务' }]}
          >
            <Input placeholder="请输入职务" maxLength={50} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea placeholder="选填，成员备注说明" rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* 权限设置弹窗 */}
      <Modal
        title={permissionMember ? `权限设置 - ${getDisplayName(permissionMember)}` : '权限设置'}
        open={permissionModalVisible}
        onOk={handleSavePermission}
        onCancel={() => setPermissionModalVisible(false)}
        destroyOnClose
        width={560}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Form layout="vertical">
          {Object.entries(PERMISSION_SECTIONS).map(([key, label]) => (
            <Form.Item key={key} label={label}>
              <Radio.Group
                value={permissionValues[key] ?? 'manage'}
                onChange={(e) =>
                  setPermissionValues((prev) => ({ ...prev, [key]: e.target.value }))
                }
                options={[
                  { value: 'readonly', label: '只读' },
                  { value: 'manage', label: '可管理' },
                ]}
              />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  );
}
