import { useState, useEffect, useCallback } from 'react';
import { Table, Typography, message, Avatar, Tag } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { listUsers } from '../../api/users';
import type { User } from '../../types/user';
import styles from './MemberDirectory.module.css';

const { Title } = Typography;

export default function MemberDirectory() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try { const res = await listUsers({ page: 1, page_size: 100 }); if (res.code === 0) { setUsers(res.data.items); } }
    catch { message.error('获取成员列表失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const columns: ColumnsType<User> = [
    { title: '', key: 'avatar', width: 50, render: (_, r) => <Avatar src={r.avatar} icon={<UserOutlined />} /> },
    { title: '姓名', dataIndex: 'nickname', key: 'nickname' },
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '角色', dataIndex: 'role', key: 'role', render: (role: string) => <Tag color={role === 'admin' ? 'gold' : 'blue'}>{role === 'admin' ? '管理员' : '成员'}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (status: string) => <Tag color={status === 'active' ? 'green' : 'red'}>{status === 'active' ? '活跃' : '已禁用'}</Tag> },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4}>成员目录</Title>
      </div>
      <Table<User> columns={columns} dataSource={users} rowKey="id" loading={loading} pagination={false} />
    </div>
  );
}
