import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Input, List, Modal, Space, Tag, Typography, message } from 'antd';
import {
  MobileOutlined,
  SafetyOutlined,
  PlusOutlined,
  DeleteOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import {
  getTwoFAStatus,
  listTwoFADevices,
  setupTwoFA,
  activateTwoFA,
  removeTwoFADevice,
  disableTwoFA,
  generateRecoveryCodes,
} from '../../api/security';
import type { TwoFAStatus, TwoFADevice } from '../../types/user';
import { useCustomization } from '../../hooks/useCustomization';
import styles from './SecuritySettings.module.css';

const { Title, Text, Paragraph } = Typography;

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString('zh-CN') : '未使用');

export default function SecuritySettings() {
  const [status, setStatus] = useState<TwoFAStatus | null>(null);
  const [devices, setDevices] = useState<TwoFADevice[]>([]);

  // 密码确认弹窗（用于绑定/解绑/恢复码/关闭）
  const [pwdAction, setPwdAction] = useState<'setup' | 'disable' | 'recovery' | null>(null);
  const [pwdValue, setPwdValue] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  // 绑定向导弹窗
  const [bindInfo, setBindInfo] = useState<{ device_id: string; secret: string; uri: string } | null>(null);
  const [bindCode, setBindCode] = useState('');
  const [bindLoading, setBindLoading] = useState(false);

  // 恢复码展示弹窗
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const customization = useCustomization();
  const appLogo = customization.branding.logoCollapsed || customization.branding.logoExpanded;

  const refresh = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([getTwoFAStatus(), listTwoFADevices()]);
      if (s.code === 0) setStatus(s.data);
      if (d.code === 0) setDevices(d.data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const closePwd = () => {
    setPwdAction(null);
    setPwdValue('');
  };

  const confirmPwd = async () => {
    if (!pwdValue) {
      message.warning('请输入登录密码');
      return;
    }
    setPwdLoading(true);
    try {
      if (pwdAction === 'setup') {
        const res = await setupTwoFA(pwdValue, '认证器');
        if (res.code === 0) {
          setBindInfo({ device_id: res.data.device_id, secret: res.data.secret, uri: res.data.otpauth_uri });
          setBindCode('');
          closePwd();
        } else {
          message.error(res.msg || '创建失败');
        }
      } else if (pwdAction === 'disable') {
        const res = await disableTwoFA(pwdValue);
        if (res.code === 0) {
          message.success('已关闭双因素认证');
          closePwd();
          await refresh();
        } else {
          message.error(res.msg || '操作失败');
        }
      } else if (pwdAction === 'recovery') {
        const res = await generateRecoveryCodes(pwdValue);
        if (res.code === 0) {
          setRecoveryCodes(res.data.codes);
          closePwd();
          await refresh();
        } else {
          message.error(res.msg || '生成失败');
        }
      }
    } catch {
      message.error('操作失败，请检查密码');
    } finally {
      setPwdLoading(false);
    }
  };

  const confirmBind = async () => {
    if (!bindInfo || bindCode.length < 6) {
      message.warning('请输入 6 位动态码');
      return;
    }
    setBindLoading(true);
    try {
      const res = await activateTwoFA(bindInfo.device_id, bindCode);
      if (res.code === 0) {
        message.success('认证器绑定成功');
        setBindInfo(null);
        await refresh();
      } else {
        message.error(res.msg || '动态码错误');
      }
    } catch {
      message.error('绑定失败');
    } finally {
      setBindLoading(false);
    }
  };

  const confirmRemove = async (deviceId: string) => {
    let pwd = '';
    await new Promise<void>((resolve, reject) => {
      Modal.confirm({
        title: '请输入登录密码确认删除',
        content: (
          <Input.Password
            placeholder="登录密码"
            autoFocus
            onChange={(e) => { pwd = e.target.value; }}
          />
        ),
        okText: '确认删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
          if (!pwd) {
            message.warning('请输入密码');
            return;
          }
          try {
            const res = await removeTwoFADevice(deviceId, pwd);
            if (res.code === 0) {
              message.success('已删除该认证器');
              await refresh();
              resolve();
            } else {
              message.error(res.msg || '删除失败');
            }
          } catch {
            message.error('删除失败');
          }
        },
        onCancel: () => reject(new Error('cancel')),
      });
    }).catch(() => undefined);
  };

  const enabled = status ? status.device_count > 0 : false;

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>安全设置</Title>
      </div>

      {!enabled ? (
        <Alert
          type="info"
          showIcon
          icon={<SafetyOutlined />}
          message="双因素认证未开启"
          description="开启后，每次退出重新登录或新登录都需要输入认证器动态码或恢复码；工作台锁定后的解锁无需二次验证。"
        />
      ) : (
        <Alert
          type="success"
          showIcon
          icon={<SafetyOutlined />}
          message="双因素认证已开启"
          description="登录时将需要输入认证器动态码或恢复码完成二次验证；工作台锁定后的解锁无需二次验证。"
        />
      )}

      <Card title="认证器设备" className={styles.card ?? ''}>
        {devices.length === 0 ? (
          <Paragraph type="secondary">尚未绑定任何认证器。</Paragraph>
        ) : (
          <List
            dataSource={devices}
            renderItem={(d) => (
              <List.Item
                actions={[
                  <Button
                    key="rm"
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => confirmRemove(d.id)}
                  >删除</Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<MobileOutlined style={{ fontSize: 18 }} />}
                  title={d.label}
                  description={'绑定于 ' + fmtDate(d.created_at) + ' · 最后使用 ' + fmtDate(d.last_used_at)}
                />
                <Tag color="green">已启用</Tag>
              </List.Item>
            )}
          />
        )}
        <div style={{ marginTop: 'var(--spacing-card-gap)' }}>
          {enabled ? (
            <Button icon={<PlusOutlined />} onClick={() => setPwdAction('setup')}>添加认证器</Button>
          ) : (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setPwdAction('setup')}>开启双因素认证</Button>
          )}
        </div>
      </Card>

      {enabled ? (
        <Card title="恢复码" className={styles.card ?? ''}>
          <Paragraph type="secondary">
            恢复码用于在丢失认证器时登录，每个仅可使用一次。每次生成会作废旧的一批，请妥善保存。
          </Paragraph>
          <div style={{ marginTop: 'var(--spacing-card-gap)' }}>
            <Space wrap>
              <Button icon={<KeyOutlined />} onClick={() => setPwdAction('recovery')}>生成 / 查看恢复码</Button>
              <Button danger icon={<DeleteOutlined />} onClick={() => setPwdAction('disable')}>关闭双因素认证</Button>
            </Space>
          </div>
        </Card>
      ) : null}

      {/* 密码确认弹窗 */}
      <Modal
        title={pwdAction === 'setup' ? '验证登录密码' : pwdAction === 'disable' ? '关闭双因素认证' : '生成恢复码'}
        open={pwdAction !== null}
        onOk={confirmPwd}
        onCancel={closePwd}
        confirmLoading={pwdLoading}
        okText="确认"
        cancelText="取消"
      >
        <Text type="secondary">为保障账号安全，此操作需要验证您的登录密码。</Text>
        <Input.Password
          style={{ marginTop: 12 }}
          placeholder="登录密码"
          value={pwdValue}
          onChange={(e) => setPwdValue(e.target.value)}
          onPressEnter={confirmPwd}
          autoFocus
        />
      </Modal>

      {/* 绑定向导弹窗 */}
      <Modal
        title="绑定认证器"
        open={bindInfo !== null}
        onCancel={() => setBindInfo(null)}
        footer={null}
      >
        {bindInfo ? (
          <div className={styles.bindWrap ?? ''}>
            {/* 应用 Logo（类似 GitHub 2FA 设置显示自身图标） */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              {appLogo ? (
                <img src={appLogo} alt={customization.app.name} style={{ height: 56, width: 'auto', objectFit: 'contain', maxWidth: 200 }} />
              ) : (
                <SafetyOutlined style={{ fontSize: 56, color: 'var(--color-primary)' }} />
              )}
            </div>
            <Text>使用 Google Authenticator、微软 Authenticator 等应用扫描以下二维码，或手动输入密钥。</Text>
            <div style={{ marginTop: 16 }} className={styles.qrWrap ?? ''}>
              <QRCodeSVG value={bindInfo.uri} size={180} />
            </div>
            <Paragraph copyable style={{ textAlign: 'center', marginTop: 12 }}>
              <code>{bindInfo.secret}</code>
            </Paragraph>
            <Input
              size="large"
              maxLength={6}
              placeholder="输入 6 位动态码"
              value={bindCode}
              onChange={(e) => setBindCode(e.target.value.replace(/[^0-9]/g, ''))}
            />
            <Button
              type="primary"
              block
              style={{ marginTop: 12 }}
              loading={bindLoading}
              onClick={confirmBind}
            >确认绑定</Button>
          </div>
        ) : null}
      </Modal>

      {/* 恢复码展示弹窗 */}
      <Modal
        title="恢复码"
        open={recoveryCodes !== null}
        onCancel={() => setRecoveryCodes(null)}
        footer={null}
      >
        <Alert
          type="warning"
          showIcon
          message="请立即保存以下恢复码"
          description="每个恢复码仅可使用一次。关闭此窗口后不再显示，丢失认证器时将无法找回。"
        />
        <div className={styles.codeGrid ?? ''}>
          {(recoveryCodes ?? []).map((c) => (
            <code key={c} className={styles.codeItem ?? ''}>{c}</code>
          ))}
        </div>
        <Button type="primary" block onClick={() => setRecoveryCodes(null)}>我已保存</Button>
      </Modal>
    </div>
  );
}
