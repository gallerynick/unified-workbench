import { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, Descriptions, Spin, message, Tag } from 'antd';
import { LockOutlined, EyeOutlined } from '@ant-design/icons';
import { verifySecret } from '../../api/secrets';
import type { SecretVerifyResponse } from '../../types/secret';

interface PasswordVerifyModalProps {
  visible: boolean;
  secretId: string | null;
  secretName: string;
  onClose: () => void;
}

const SECRET_TYPE_LABEL_MAP: Record<string, { color: string; text: string }> = {
  api_key: { color: 'blue', text: 'API 密钥' },
  account: { color: 'green', text: '账号密码' },
  config: { color: 'orange', text: '配置项' },
  other: { color: 'default', text: '其他' },
};

export default function PasswordVerifyModal({
  visible,
  secretId,
  secretName,
  onClose,
}: PasswordVerifyModalProps) {
  const [form] = Form.useForm();
  const [verifying, setVerifying] = useState(false);
  const [decryptedData, setDecryptedData] = useState<SecretVerifyResponse | null>(null);

  useEffect(() => {
    if (visible) {
      form.resetFields();
      setDecryptedData(null);
      setVerifying(false);
    }
  }, [visible, form]);

  const handleVerify = async () => {
    if (!secretId) return;

    try {
      const values = await form.validateFields();
      setVerifying(true);

      const res = await verifySecret(secretId, values.password);
      if (res.code === 0) {
        setDecryptedData(res.data);
      } else {
        message.error(res.msg || '密码验证失败');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleClose = () => {
    setDecryptedData(null);
    form.resetFields();
    onClose();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const typeConfig = decryptedData
    ? SECRET_TYPE_LABEL_MAP[decryptedData.secret_type] ?? SECRET_TYPE_LABEL_MAP.other
    : null;

  return (
    <Modal
      title={decryptedData ? `密钥详情 — ${secretName}` : `查看密钥 — ${secretName}`}
      open={visible}
      onCancel={handleClose}
      footer={
        decryptedData
          ? [
              <Button key="close" onClick={handleClose}>
                关闭
              </Button>,
            ]
          : [
              <Button key="cancel" onClick={handleClose}>
                取消
              </Button>,
              <Button
                key="verify"
                type="primary"
                icon={<EyeOutlined />}
                loading={verifying}
                onClick={handleVerify}
              >
                验证并查看
              </Button>,
            ]
      }
      destroyOnClose
      width={decryptedData ? 560 : 420}
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      {!decryptedData ? (
        /* 密码输入阶段 */
        <Spin spinning={verifying}>
          <Form form={form} layout="vertical" style={{ paddingTop: 8 }}>
            <Form.Item
              name="password"
              label="请输入登录密码以验证身份"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                placeholder="请输入您的登录密码"
                prefix={<LockOutlined />}
                onPressEnter={handleVerify}
              />
            </Form.Item>
          </Form>
        </Spin>
      ) : (
        /* 解密数据显示阶段 */
        <Descriptions
          column={1}
          bordered
          size="small"
          labelStyle={{ width: 120, fontWeight: 500 }}
        >
          <Descriptions.Item label="名称">{decryptedData.name}</Descriptions.Item>
          <Descriptions.Item label="类型">
            <Tag color={typeConfig?.color ?? 'default'}>{typeConfig?.text ?? decryptedData.secret_type}</Tag>
          </Descriptions.Item>
          {decryptedData.note && (
            <Descriptions.Item label="备注">{decryptedData.note}</Descriptions.Item>
          )}
          <Descriptions.Item label="创建时间">
            {formatDate(decryptedData.created_at)}
          </Descriptions.Item>
          <Descriptions.Item label="数据">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(decryptedData.data).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontWeight: 500, minWidth: 100, color: 'rgba(0,0,0,0.65)' }}>
                    {k}
                  </span>
                  <span style={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    {String(v)}
                  </span>
                </div>
              ))}
            </div>
          </Descriptions.Item>
        </Descriptions>
      )}
    </Modal>
  );
}
