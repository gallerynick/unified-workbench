import { useState, useEffect, useCallback } from 'react';
import { Card, Avatar, Tag, Typography, Modal, Spin, Empty, message } from 'antd';
import { UserOutlined, TeamOutlined } from '@ant-design/icons';
import { listUsers } from '../../api/users';
import type { User } from '../../types/user';
import styles from './MemberDirectory.module.css';

const { Title, Text } = Typography;

function RoleTag({ role }: { role: User['role'] }) {
  return (
    <Tag color={role === 'admin' ? 'red' : 'blue'}>
      {role === 'admin' ? '管理员' : '成员'}
    </Tag>
  );
}

export default function MemberDirectory() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

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

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>
          成员目录
        </Title>
      </div>

      {users.length === 0 && !loading ? (
        <Empty description="暂无成员" />
      ) : (
        <Spin spinning={loading}>
          <div className={styles.cardGrid ?? ''}>
            {users.map((user) => (
              <Card
                key={user.id}
                hoverable
                className={styles.card ?? ''}
                onClick={() => setSelectedUser(user)}
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

      <Modal
        open={selectedUser !== null}
        title={
          <span>
            <TeamOutlined /> 成员资料
          </span>
        }
        footer={null}
        onCancel={() => setSelectedUser(null)}
      >
        {selectedUser && (
          <div className={styles.modalBody ?? ''}>
            <Avatar
              size={96}
              src={selectedUser.avatar || undefined}
              icon={<UserOutlined />}
              className={styles.modalAvatar ?? ''}
            />
            <div className={styles.modalHeader ?? ''}>
              <Title level={4} className={styles.modalName ?? ''}>
                {selectedUser.nickname || selectedUser.username}
              </Title>
              <div className={styles.modalUsername ?? ''}>@{selectedUser.username}</div>
              <RoleTag role={selectedUser.role} />
            </div>
            <div className={styles.modalMeta ?? ''}>
              <div>
                <Text type="secondary">邮箱：</Text>
                {selectedUser.email ?? '-'}
              </div>
              <div>
                <Text type="secondary">简介：</Text>
                {selectedUser.bio ?? '-'}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
