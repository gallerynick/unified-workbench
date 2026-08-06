import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Avatar, Tag, Typography, Spin, Empty, message, Input, Segmented, Space } from 'antd';
import { UserOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { listUsers } from '../../api/users';
import type { User } from '../../types/user';
import styles from './MemberDirectory.module.css';

const { Title } = Typography;

function RoleTag({ role }: { role: User['role'] }) {
  return (
    <Tag color={role === 'admin' ? 'red' : 'blue'}>
      {role === 'admin' ? '管理员' : '成员'}
    </Tag>
  );
}

export default function MemberDirectory() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUsers({ page: 1, page_size: 100 });
      if (res.code === 0) {
        setUsers(res.data.items);
      } else {
        message.error(res.msg || '获取成员列表失败');
      }
    } catch {
      message.error('获取成员列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (roleFilter !== 'all' && user.role !== roleFilter) return false;
      if (!searchText) return true;
      const q = searchText.toLowerCase();
      return (
        (user.nickname || '').toLowerCase().includes(q) ||
        (user.username || '').toLowerCase().includes(q)
      );
    });
  }, [users, searchText, roleFilter]);

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>
          成员目录
        </Title>
        <Space wrap>
          <Input
            className={styles.searchInput ?? ''}
            prefix={<SearchOutlined />}
            placeholder="搜索成员"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            variant="filled"
          />
          <Segmented
            options={[
              { label: '全部', value: 'all' },
              { label: '管理员', value: 'admin' },
              { label: '成员', value: 'member' },
            ]}
            value={roleFilter}
            onChange={(val) => setRoleFilter(val as string)}
          />
        </Space>
      </div>

      {filteredUsers.length === 0 && !loading ? (
        <Empty description="暂无成员" />
      ) : (
        <Spin spinning={loading}>
          <div className={styles.cardGrid ?? ''}>
            {filteredUsers.map((user) => (
              <Card
                key={user.id}
                hoverable
                className={styles.card ?? ''}
                onClick={() => navigate(`/members/${user.id}`)}
              >
                <Card.Meta
                  avatar={
                    <Avatar
                      size={48}
                      src={user.avatar || undefined}
                      icon={<UserOutlined />}
                      className={styles.cardAvatar ?? ''}
                    />
                  }
                  title={user.nickname || user.username}
                  description={
                    <>
                      <div className={styles.username ?? ''}>@{user.username}</div>
                      <RoleTag role={user.role} />
                    </>
                  }
                />
              </Card>
            ))}
          </div>
        </Spin>
      )}
    </div>
  );
}
