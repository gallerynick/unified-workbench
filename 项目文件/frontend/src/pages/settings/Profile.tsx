import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, message, Avatar, Divider, Upload } from 'antd';
import { UserOutlined, SaveOutlined, LockOutlined, CameraOutlined } from '@ant-design/icons';
import ImgCrop from 'antd-img-crop';
import type { RcFile } from 'antd/es/upload/interface';
import type { UploadProps } from 'antd';
import { getMe, updateMe, changePassword } from '../../api/auth';
import type { User } from '../../types/user';
import styles from './Profile.module.css';

const { Title, Text } = Typography;

function readFileAsDataURL(file: RcFile): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.onabort = () => reject(new Error('文件读取已取消'));
    reader.readAsDataURL(file);
  });
}

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
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

  const handleAvatarChange: UploadProps['beforeUpload'] = async (file) => {
    const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_AVATAR_SIZE) {
      message.error('头像图片不能超过 2MB');
      return false;
    }

    setAvatarSaving(true);
    try {
      const dataUrl = await readFileAsDataURL(file);
      const res = await updateMe({ avatar: dataUrl });
      if (res.code === 0) {
        message.success('头像已更新');
        setUser(res.data);
      } else {
        message.error(res.msg || '头像更新失败');
      }
    } catch (err) {
      console.error('头像上传失败:', err);
      message.error('头像上传失败');
    } finally {
      setAvatarSaving(false);
    }
    return false;
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div className={styles.container}>
      <Title level={4}>个人资料</Title>

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

        <Form form={profileForm} layout="vertical">
          <Form.Item label="姓名" name="nickname" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="请输入姓名" variant="filled" />
          </Form.Item>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleUpdateProfile}>
            保存资料
          </Button>
        </Form>
      </Card>

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
    </div>
  );
}
