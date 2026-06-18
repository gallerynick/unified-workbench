import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Input,
  Badge,
  Tag,
  Typography,
  Modal,
  message,
  Space,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { listUsers, disableUser } from '../../api/users';
import type { User } from '../../types/user';
import UserFormModal from './UserFormModal';
import styles from './UserManagement.module.css';

const { Title } = Typography;

const ROLE_BADGE_MAP: Record<User['role'], { color: string; text: string }> = {
  admin: { color: 'gold', text: '管理员' },
  member: { color: 'blue', text: '普通成员' },
};

const STATUS_BADGE_MAP: Record<User['status'], { status: 'success' | 'error'; text: string }> = {
  active: { status: 'success', text: '启用' },
  disabled: { status: 'error', text: '禁用' },
};

// 预设标签颜色映射（与 UserFormModal 保持一致）
const TAG_COLOR_MAP: Record<string, string> = {
  'tag-1': 'blue',
  'tag-2': 'purple',
  'tag-3': 'green',
  'tag-4': 'gold',
};

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUsers({ page, page_size: pageSize, search });
      if (res.code === 0) {
        setUsers(res.data.items);
        setTotal(res.data.total);
      } else {
        message.error(res.msg || '获取用户列表失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取用户列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleCreate = () => {
    setModalMode('create');
    setEditingUser(null);
    setModalVisible(true);
  };

  const handleEdit = (user: User) => {
    setModalMode('edit');
    setEditingUser(user);
    setModalVisible(true);
  };

  const handleDisable = (user: User) => {
    Modal.confirm({
      title: '确认禁用',
      content: `确定要禁用用户「${user.nickname}」吗？禁用后该用户将无法登录。`,
      okText: '禁用',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await disableUser(user.id);
          if (res.code === 0) {
            message.success('用户已禁用');
            fetchUsers();
          } else {
            message.error(res.msg || '禁用失败');
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '禁用失败';
          message.error(msg);
        }
      },
    });
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setEditingUser(null);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditingUser(null);
    fetchUsers();
  };

  const columns: ColumnsType<User> = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 140,
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
      width: 140,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: User['role']) => {
        const cfg = ROLE_BADGE_MAP[role];
        return <Badge color={cfg.color} text={cfg.text} />;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: User['status']) => {
        const cfg = STATUS_BADGE_MAP[status];
        return <Badge status={cfg.status} text={cfg.text} />;
      },
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 200,
      render: (tags: User['tags']) => (
        <Space size={[0, 4]} wrap>
          {tags.map((tag) => (
            <Tag key={tag.id} color={tag.color ?? TAG_COLOR_MAP[tag.id] ?? 'default'}>
              {tag.name}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, record: User) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {record.status === 'active' && (
            <Button
              type="link"
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => handleDisable(record)}
            >
              禁用
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>
          用户管理
        </Title>
        <Space>
          <Input
            placeholder="搜索用户名/昵称"
            prefix={<SearchOutlined />}
            allowClear
            className={styles.searchInput ?? ''}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建用户
          </Button>
        </Space>
      </div>

      <Table<User>
        className={styles.table ?? ''}
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <UserFormModal
        visible={modalVisible}
        mode={modalMode}
        user={editingUser}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
