import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, message, Avatar, Divider } from 'antd';
import { UserOutlined, SaveOutlined, LockOutlined } from '@ant-design/icons';
import { getMe, updateMe, changePassword } from '../../api/auth';
import type { User } from '../../types/user';
import styles from './Profile.module.css';

const { Title, Text } = Typography;

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  useEffect(() => {
    fetchUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUser = async () => {
    try {
      setLoading(true);
      const res = await getMe();
      if (res.code === 0) {
        setUser(res.data);
        profileForm.setFieldsValue({
          nickname: res.data.nickname,
          avatar: res.data.avatar || '',
        });
      }
    } catch {
      message.error('获取用户信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const values = await profileForm.validateFields();
      setSaving(true);
      const res = await updateMe({
        nickname: values.nickname,
        avatar: values.avatar || undefined,
      });
      if (res.code === 0) {
        message.success('个人资料已更新');
        setUser(res.data);
      } else {
        message.error(res.msg || '更新失败');
      }
    } catch {
      message.error('请检查输入');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      setChangingPassword(true);
      const res = await changePassword({
        old_password: values.oldPassword,
        new_password: values.newPassword,
      });
      if (res.code === 0) {
        message.success('密码已修改');
        passwordForm.resetFields();
      } else {
        message.error(res.msg || '修改失败');
      }
    } catch {
      message.error('请检查输入');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div className={styles.container}>
      <Title level={4}>个人资料</Title>

      <Card className={styles.card ?? ''}>
        <div className={styles.header ?? ''}>
          <Avatar size={64} icon={<UserOutlined />} src={user?.avatar} />
          <div className={styles.userInfo}>
            <Title level={4} style={{ margin: 0 }}>{user?.nickname}</Title>
            <Text type="secondary">@{user?.username}</Text>
          </div>
        </div>

        <Divider />

        <Form form={profileForm} layout="vertical">
          <Form.Item label="姓名" name="nickname" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item label="头像 URL" name="avatar">
            <Input placeholder="https://example.com/avatar.png" />
          </Form.Item>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleUpdateProfile}>
            保存资料
          </Button>
        </Form>
      </Card>

      <Card title={<><LockOutlined /> 修改密码</>} className={styles.card ?? ''}>
        <Form form={passwordForm} layout="vertical">
          <Form.Item label="当前密码" name="oldPassword" rules={[{ required: true, message: '请输入当前密码' }]}>
            <Input.Password placeholder="请输入当前密码" />
          </Form.Item>
          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '密码至少 8 位' },
              { pattern: /^(?=.*[a-zA-Z])(?=.*\d)/, message: '密码需包含字母和数字' },
            ]}
          >
            <Input.Password placeholder="请输入新密码（至少 8 位，包含字母和数字）" />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
          <Button type="primary" icon={<LockOutlined />} loading={changingPassword} onClick={handleChangePassword}>
            修改密码
          </Button>
        </Form>
      </Card>
    </div>
  );
}
