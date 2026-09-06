import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Checkbox,
  Col,
  Input,
  Modal,
  Radio,
  Row,
  Segmented,
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
  SearchOutlined,
  SettingOutlined,
  UndoOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
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
import MemberModal from '../components/MemberModal';
import styles from './ProjectMemberTab.module.css';

const { Text, Title, Paragraph } = Typography;

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
  const [searchText, setSearchText] = useState('');
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<ProjectMember | null>(null);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [permissionMember, setPermissionMember] = useState<ProjectMember | null>(null);
  const [permissionValues, setPermissionValues] = useState<Record<string, string>>({});
  const [permissionRoles, setPermissionRoles] = useState<Record<string, boolean>>({});

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


  // ── 添加/编辑成员（弹窗共用 MemberModal） ──
  const openAddModal = useCallback(() => {
    setEditingMember(null);
    setMemberModalOpen(true);
  }, []);

  const openEditModal = useCallback((member: ProjectMember) => {
    setEditingMember(member);
    setMemberModalOpen(true);
  }, []);

  // ── 移除成员（软删除：is_active=false + left_at） ──
  const handleRemoveMember = useCallback(
    (member: ProjectMember) => {
      Modal.confirm({
        title: '确认移除成员',
        icon: <ExclamationCircleOutlined />,
        content: `确定要将「${getDisplayName(member)}」从项目中移除吗？移除后可在历史成员中查看。`,
        okText: '移除',
        okButtonProps: { danger: true },
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
      const roles: Record<string, boolean> = {};
      for (const key of Object.keys(PERMISSION_SECTIONS)) {
        initial[key] = typeof current[key] === 'string' ? current[key] : 'readonly';
      }
      if (current.proposals_approver === true) roles.proposals_approver = true;
      if (current.changes_approver === true) roles.changes_approver = true;
      setPermissionValues(initial);
      setPermissionRoles(roles);
      setPermissionMember(member);
      setPermissionModalVisible(true);
    },
    [project.member_permissions],
  );

  const handleSavePermission = useCallback(async () => {
    if (!permissionMember) return;
    const newPerms = {
      ...(project.member_permissions ?? {}),
      [permissionMember.user_id]: { ...permissionValues, ...permissionRoles },
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
  }, [permissionMember, permissionValues, permissionRoles, project.id, project.member_permissions, onUpdate]);

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
        width: 140,
        align: 'right',
        render: (_, member) => {
          if (!canManage) return null;
          const isOwnerMember = member.is_owner || member.user_id === project.owner_id;
          return (
            <Space size="small" className={styles.actionCell ?? ''}>
              {isOwner && (
                <Tooltip title="权限设置">
                  <Button
                    type="link"
                    size="small"
                    icon={<SettingOutlined />}
                    aria-label="权限设置"
                    onClick={() => openPermissionModal(member)}
                  />
                </Tooltip>
              )}
              <Tooltip title="编辑职务/备注">
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  aria-label="编辑"
                  onClick={() => openEditModal(member)}
                />
              </Tooltip>
              {isOwnerMember ? (
                <Tooltip title="负责人不可移除">
                  <Button
                    type="link"
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
                    type="link"
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
      width: 140,
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

  const filteredMembers = useMemo(() => {
    const kw = searchText.trim().toLowerCase();
    if (!kw) return dataSource;
    return dataSource.filter(
      (m) => getDisplayName(m).toLowerCase().includes(kw) || getUsername(m).toLowerCase().includes(kw),
    );
  }, [dataSource, searchText, getDisplayName, getUsername]);

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
        <Space>
          <Segmented
            options={[
              { label: `当前成员（${activeMembers.length}）`, value: 'active' },
              { label: `历史成员（${historyMembers.length}）`, value: 'history' },
            ]}
            value={viewMode}
            onChange={(value) => setViewMode(value as 'active' | 'history')}
          />
          <Input
            className={styles.searchInput ?? ''}
            variant="filled"
            placeholder="搜索成员..."
            prefix={<SearchOutlined style={{ color: 'var(--text-secondary)' }} />}
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
            }}
            allowClear
          />
        </Space>
        <Space>
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
        </Space>
      </div>

      <Table<ProjectMember>
        rowKey="id"
        columns={columns}
        dataSource={filteredMembers}
        loading={loading}
        className={styles.table ?? ''}
        pagination={{
          defaultPageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        locale={{
          emptyText: viewMode === 'active' ? '暂无当前成员' : '暂无历史成员',
        }}
      />

      {/* 添加/编辑成员（共用组件 MemberModal） */}
      <MemberModal
        project={project}
        open={memberModalOpen}
        editingMember={editingMember}
        existingMembers={members}
        isOwner={isOwner}
        onClose={() => setMemberModalOpen(false)}
        onSaved={() => void fetchMembers()}
      />

      {/* 权限设置弹窗 */}
      <Modal
        title={permissionMember ? `权限设置 - ${getDisplayName(permissionMember)}` : '权限设置'}
        open={permissionModalVisible}
        onOk={handleSavePermission}
        onCancel={() => setPermissionModalVisible(false)}
        destroyOnClose
        width={800}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' } }}
      >
        <div style={{ marginBottom: 24 }}>
          <Title level={5}>分区权限</Title>
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            提案和修改记录分区仅有「只读」和「可创建」；其他模块为「只读」或「可管理」。
          </Paragraph>
          <Row gutter={[16, 16]}>
            {Object.entries(PERMISSION_SECTIONS).map(([key, label]) => {
              const isSpecial = key === 'proposals' || key === 'changes';
              const curVal = permissionValues[key] ?? 'readonly';
              return (
                <Col key={key} span={8}>
                  <div style={{ padding: '12px 16px', border: '1px solid var(--border-secondary)', borderRadius: 8 }}>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>{label}</Text>
                    <Radio.Group
                      value={curVal}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPermissionValues((prev) => ({ ...prev, [key]: val }));
                        if (val === 'readonly') {
                          const roleKey = `${key}_approver`;
                          setPermissionRoles((prev) => {
                            if (!(roleKey in prev)) return prev;
                            const next = { ...prev };
                            delete next[roleKey];
                            return next;
                          });
                        }
                      }}
                      options={
                        isSpecial
                          ? [
                              { value: 'readonly', label: '只读' },
                              { value: 'create', label: '可创建' },
                            ]
                          : [
                              { value: 'readonly', label: '只读' },
                              { value: 'manage', label: '可管理' },
                            ]
                      }
                    />
                  </div>
                </Col>
              );
            })}
          </Row>
        </div>

        <div style={{ borderTop: '1px solid var(--border-secondary)', paddingTop: 24 }}>
          <Title level={5}>职务设置</Title>
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            仅当对应分区为「可创建」时，职务勾选才可用。勾选后获得该分区的完整操作权限。
          </Paragraph>
          <Space direction="vertical" size="middle">
            <Checkbox
              checked={!!permissionRoles.proposals_approver}
              disabled={permissionValues.proposals !== 'manage' && permissionValues.proposals !== 'create'}
              onChange={(e) => setPermissionRoles((prev) => ({ ...prev, proposals_approver: e.target.checked }))}
            >
              项目提案 - 管理人
            </Checkbox>
            <Checkbox
              checked={!!permissionRoles.changes_approver}
              disabled={permissionValues.changes !== 'manage' && permissionValues.changes !== 'create'}
              onChange={(e) => setPermissionRoles((prev) => ({ ...prev, changes_approver: e.target.checked }))}
            >
              修改记录 - 管理人
            </Checkbox>
          </Space>
        </div>
      </Modal>
    </div>
  );
}
