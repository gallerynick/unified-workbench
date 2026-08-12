import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, message, Avatar, Divider, Upload, Tag, Descriptions, Space, Modal, Select } from 'antd';
import { UserOutlined, EditOutlined, LockOutlined, CameraOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import ImgCrop from 'antd-img-crop';
import type { RcFile } from 'antd/es/upload/interface';
import type { UploadProps } from 'antd';
import { getMe, updateMe, changePassword } from '../../api/auth';
import type { User } from '../../types/user';
import { useUser } from '../../contexts/UserContext';
import styles from './Profile.module.css';

const { Title, Text } = Typography;

function readFileAsDataURL(file: RcFile): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.onabort = () => reject(new Error('文件读取已取消'));
    reader.readAsDataURL(file);
  });
}

const ROLE_MAP: Record<string, { label: string; color: string }> = {
  admin: { label: '管理员', color: 'red' },
  member: { label: '成员', color: 'blue' },
};

const STATUS_MAP: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  active: { label: '正常', icon: <CheckCircleOutlined />, color: 'green' },
  disabled: { label: '已禁用', icon: <CloseCircleOutlined />, color: 'red' },
};

export default function Profile() {
  const { setUser: setGlobalUser } = useUser();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
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
          username: res.data.username,
          nickname: res.data.nickname,
          email: res.data.email,
          phone: res.data.phone,
          gender: res.data.gender,
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
        username: values.username || undefined,
        nickname: values.nickname,
        email: values.email || null,
        phone: values.phone || null,
        gender: values.gender || null,
      });
      if (res.code === 0) {
        message.success('个人资料已更新');
        setUser(res.data);
        setEditModalVisible(false);
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
        setPasswordModalVisible(false);
      } else {
        message.error(res.msg || '修改失败');
      }
    } catch {
      message.error('请检查输入');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleAvatarChange: UploadProps['beforeUpload'] = async (file) => {
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      message.error('头像图片不能超过 2MB');
      return Upload.LIST_IGNORE;
    }

    setAvatarSaving(true);
    try {
      const dataUrl = await readFileAsDataURL(file);
      const res = await updateMe({ nickname: user?.nickname ?? '', avatar: dataUrl });
      if (res.code === 0) {
        message.success('头像已更新');
        setUser(res.data);
        setGlobalUser(res.data);
      } else {
        message.error(res.msg || '头像更新失败');
      }
    } catch (err) {
      console.error('头像上传失败:', err);
      message.error('头像上传失败，请重试');
    } finally {
      setAvatarSaving(false);
    }
    return false;
  };

  if (loading) {
    return <div style={{ padding: "var(--spacing-xxl)", textAlign: 'center' }}>加载中...</div>;
  }

  const roleInfo = ROLE_MAP[user?.role ?? ''] ?? { label: user?.role ?? '未知', color: 'default' };
  const statusInfo = STATUS_MAP[user?.status ?? ''] ?? { label: user?.status ?? '未知', icon: null, color: 'default' };

  return (
    <div className={styles.container}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>个人资料</Title>
      </div>

      {/* 用户信息卡片 */}
      <Card className={styles.card ?? ''}>
        <div className={styles.header ?? ''}>
          <ImgCrop
            rotationSlider
            quality={0.8}
            cropShape="round"
            zoomSlider
            minZoom={0.5}
            maxZoom={3}
          >
            <Upload
              showUploadList={false}
              beforeUpload={handleAvatarChange}
              accept="image/*"
              disabled={avatarSaving}
            >
              <div style={{ position: 'relative', cursor: 'pointer', display: 'inline-block' }}>
                <Avatar
                  size={80}
                  icon={<UserOutlined />}
                  src={user?.avatar}
                  style={{ border: 'var(--border-width-thin) solid var(--border-color, var(--border-primary))' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'var(--border-width-thin) solid var(--canvas)',
                  }}
                >
                  <CameraOutlined style={{ color: 'var(--canvas)', fontSize: 'var(--text-caption-size)' }} />
                </div>
              </div>
            </Upload>
          </ImgCrop>
          <div className={styles.userInfo}>
            <Title level={4} style={{ margin: 0 }}>{user?.nickname}</Title>
            <Text type="secondary">@{user?.username}</Text>
          </div>
        </div>

        <Divider />

        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="角色">
            <Tag color={roleInfo.color}>{roleInfo.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag icon={statusInfo.icon} color={statusInfo.color}>{statusInfo.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="用户名">
            <Text>{user?.username}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="姓名">
            <Text>{user?.nickname}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="邮箱">
            <Text>{user?.email || '-'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="手机号">
            <Text>{user?.phone || '-'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="性别">
            <Text>{user?.gender === 'male' ? '男' : user?.gender === 'female' ? '女' : user?.gender === 'other' ? '其他' : '-'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="标签">
            {user?.tags && user.tags.length > 0 ? (
              <Space wrap size={[4, 4]}>
                {user.tags.map((tag) => tag.color ? (
  <Tag key={tag.id} color={tag.color}>{tag.name}</Tag>
) : (
  <Tag key={tag.id}>{tag.name}</Tag>
))}
              </Space>
            ) : (
              <Text type="secondary">无标签</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="注册时间">
            <Text>{user?.created_at ? new Date(user.created_at).toLocaleDateString('zh-CN') : '-'}</Text>
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        <Space>
          <Button type="primary" icon={<EditOutlined />} onClick={() => setEditModalVisible(true)}>
            编辑资料
          </Button>
        </Space>
      </Card>

      <Modal
        title="编辑个人资料"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={560}
        destroyOnClose
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Form
          form={profileForm}
          layout="vertical"
          initialValues={{ username: user?.username, nickname: user?.nickname, email: user?.email, phone: user?.phone, gender: user?.gender }}
        >
          <Form.Item label="用户名" name="username">
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item label="姓名" name="nickname" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item label="邮箱" name="email">
            <Input type="email" placeholder="请输入邮箱地址" />
          </Form.Item>
          <Form.Item label="手机号" name="phone">
            <Input placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item label="性别" name="gender">
            <Select
              placeholder="请选择性别"
              options={[
                { label: '男', value: 'male' },
                { label: '女', value: 'female' },
                { label: '其他', value: 'other' },
              ]}
            />
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Button onClick={() => setEditModalVisible(false)} style={{ marginRight: 'var(--spacing-xs)' }}>
              取消
            </Button>
            <Button type="primary" icon={<EditOutlined />} loading={saving} onClick={handleUpdateProfile}>
              保存
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 修改密码 */}
      <Card className={styles.card ?? ''}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Typography.Text strong><LockOutlined /> 修改密码</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
              修改您的登录密码
            </Typography.Paragraph>
          </div>
          <Button icon={<LockOutlined />} onClick={() => setPasswordModalVisible(true)}>
            修改密码
          </Button>
        </div>
      </Card>

      <Modal
        title="修改密码"
        open={passwordModalVisible}
        onCancel={() => { setPasswordModalVisible(false); passwordForm.resetFields(); }}
        footer={null}
        width={560}
        destroyOnClose
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item label="当前密码" name="oldPassword" rules={[{ required: true, message: '请输入当前密码' }]}>
            <Input.Password placeholder="请输入当前密码" variant="filled" />
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
            <Input.Password placeholder="请输入新密码（至少 8 位，包含字母和数字）" variant="filled" />
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
            <Input.Password placeholder="请再次输入新密码" variant="filled" />
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Button onClick={() => { setPasswordModalVisible(false); passwordForm.resetFields(); }} style={{ marginRight: 'var(--spacing-xs)' }}>
              取消
            </Button>
            <Button type="primary" icon={<LockOutlined />} loading={changingPassword} onClick={handleChangePassword}>
              确认修改
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
