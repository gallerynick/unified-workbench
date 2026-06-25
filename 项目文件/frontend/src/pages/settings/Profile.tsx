import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, message, Avatar, Divider, Upload, Tag, Descriptions, Space, Modal } from 'antd';
import { UserOutlined, SaveOutlined, LockOutlined, CameraOutlined, CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import ImgCrop from 'antd-img-crop';
import type { RcFile } from 'antd/es/upload/interface';
import type { UploadProps } from 'antd';
import { getMe, updateMe, changePassword, deleteMe } from '../../api/auth';
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
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
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
        profileForm.setFieldsValue({ nickname: res.data.nickname });
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
      const res = await updateMe({ nickname: values.nickname });
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

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      message.warning('请输入密码');
      return;
    }
    setDeleting(true);
    try {
      const res = await deleteMe(deletePassword);
      if (res.code === 0) {
        message.success('账户已删除');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      } else {
        message.error(res.msg || '删除失败');
      }
    } catch {
      message.error('删除失败，请重试');
    } finally {
      setDeleting(false);
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
      const res = await updateMe({ avatar: dataUrl });
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
    return <div style={{ padding: 40, textAlign: 'center' }}>加载中...</div>;
  }

  const roleInfo = ROLE_MAP[user?.role ?? ''] ?? { label: user?.role ?? '未知', color: 'default' };
  const statusInfo = STATUS_MAP[user?.status ?? ''] ?? { label: user?.status ?? '未知', icon: null, color: 'default' };

  return (
    <div className={styles.container}>
      <Title level={4} className={styles.title ?? ''}>个人资料</Title>

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
                  style={{ border: '2px solid var(--border-color, #e2e8f0)' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#6366f1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #fff',
                  }}
                >
                  <CameraOutlined style={{ color: '#fff', fontSize: 13 }} />
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
          <Descriptions.Item label="昵称">
            <Text>{user?.nickname}</Text>
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

        <Form form={profileForm} layout="vertical">
          <Form.Item label="姓名" name="nickname" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="请输入姓名" variant="filled" />
          </Form.Item>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleUpdateProfile}>
            保存资料
          </Button>
        </Form>
      </Card>

      {/* 修改密码卡片 */}
      <Card title={<><LockOutlined /> 修改密码</>} className={styles.card ?? ''}>
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
          <Button type="primary" icon={<LockOutlined />} loading={changingPassword} onClick={handleChangePassword}>
            修改密码
          </Button>
        </Form>
      </Card>

      {/* 危险区域 */}
      <Card
        title={<><DeleteOutlined /> 危险操作</>}
        className={styles.card ?? ''}
        style={{ borderColor: '#ff4d4f' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Typography.Text strong>删除账户</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
              此操作不可恢复，删除后所有数据将被永久移除
            </Typography.Paragraph>
          </div>
          <Button danger icon={<DeleteOutlined />} onClick={() => setDeleteModalVisible(true)}>
            删除我的账户
          </Button>
        </div>
      </Card>

      <Modal
        title="确认删除账户"
        open={deleteModalVisible}
        onCancel={() => { setDeleteModalVisible(false); setDeletePassword(''); }}
        footer={null}
      >
        <Typography.Paragraph type="danger">
          此操作不可逆！请输入您的登录密码以确认删除。
        </Typography.Paragraph>
        <Input.Password
          placeholder="请输入登录密码"
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
          onPressEnter={handleDeleteAccount}
        />
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Button onClick={() => { setDeleteModalVisible(false); setDeletePassword(''); }} style={{ marginRight: 8 }}>
            取消
          </Button>
          <Button type="primary" danger loading={deleting} onClick={handleDeleteAccount}>
            确认删除
          </Button>
        </div>
      </Modal>
    </div>
  );
}
