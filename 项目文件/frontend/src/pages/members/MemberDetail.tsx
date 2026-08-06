import { useState, useEffect, useCallback } from 'react';
import { Card, Avatar, Tag, Typography, Button, Descriptions, Spin, message } from 'antd';
import { UserOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getUser } from '../../api/users';
import type { User } from '../../types/user';
import styles from './MemberDetail.module.css';

const { Title, Text } = Typography;

function RoleTag({ role }: { role: User['role'] }) {
  return (
    <Tag color={role === 'admin' ? 'red' : 'blue'}>
      {role === 'admin' ? '管理员' : '成员'}
    </Tag>
  );
}

function StatusTag({ status }: { status: User['status'] }) {
  return (
    <Tag color={status === 'active' ? 'green' : 'red'}>
      {status === 'active' ? '正常' : '已禁用'}
    </Tag>
  );
}

export default function MemberDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await getUser(userId);
      if (res.code === 0) {
        setUser(res.data);
      } else {
        message.error(res.msg || '获取成员信息失败');
      }
    } catch {
      message.error('获取成员信息失败');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (loading) {
    return <div style={{ padding: 'var(--spacing-xxl)', textAlign: 'center' }}><Spin /></div>;
  }

  if (!user) {
    return <div style={{ padding: 'var(--spacing-xxl)', textAlign: 'center' }}>成员不存在</div>;
  }

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/members')}
        >
          返回成员目录
        </Button>
      </div>

      <Card className={styles.card ?? ''}>
        <div className={styles.profile ?? ''}>
          <Avatar
            size={96}
            src={user.avatar || undefined}
            icon={<UserOutlined />}
            className={styles.avatar ?? ''}
          />
          <div className={styles.info ?? ''}>
            <Title level={4} style={{ margin: 0 }}>
              {user.nickname || user.username}
            </Title>
            <Text type="secondary">@{user.username}</Text>
            <div className={styles.tags ?? ''}>
              <RoleTag role={user.role} />
              <StatusTag status={user.status} />
            </div>
          </div>
        </div>

        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small" className={styles.descriptions ?? ''}>
          <Descriptions.Item label="用户名">
            <Text>{user.username}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="昵称">
            <Text>{user.nickname}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="邮箱">
            <Text>{user.email || '-'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="手机号">
            <Text>{user.phone || '-'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="性别">
            <Text>
              {user.gender === 'male' ? '男' : user.gender === 'female' ? '女' : user.gender === 'other' ? '其他' : '-'}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="注册时间">
            <Text>{user.created_at ? new Date(user.created_at).toLocaleString('zh-CN') : '-'}</Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
