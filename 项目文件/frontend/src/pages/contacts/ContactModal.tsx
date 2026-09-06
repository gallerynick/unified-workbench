import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { Contact, ContactType } from '../../types/contact';
import type { Visibility } from '../../utils/visibility';
import VisibilitySetting from '@/components/VisibilitySetting/VisibilitySetting';
import { createContact, updateContact } from '../../api/contacts';

const TYPE_MAP: Record<ContactType, { color: string; text: string }> = {
  customer: { color: 'blue', text: '客户' },
  supplier: { color: 'green', text: '供应商' },
  partner: { color: 'purple', text: '合作伙伴' },
  other: { color: 'default', text: '其他' },
};

interface ContactModalProps {
  open: boolean;
  /** 非空表示编辑模式；null 表示新建 */
  editingContact?: Contact | null;
  onClose: () => void;
  /** 保存成功回调（父组件刷新列表） */
  onSaved: () => void;
}

interface CustomField {
  key: string;
  value: string;
}

/**
 * 联系人 新建/编辑 共用弹窗
 *
 * 供「联系人管理」页（ContactManagement）复用，表单与提交逻辑内聚于此，
 * 页面只负责打开/关闭/刷新，一处修改、多处以一。
 */
export default function ContactModal({
  open,
  editingContact = null,
  onClose,
  onSaved,
}: ContactModalProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formType, setFormType] = useState<ContactType>('customer');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [restrictedUsers, setRestrictedUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editingContact) {
      setFormName(editingContact.name);
      setFormCompany(editingContact.company || '');
      setFormEmail(editingContact.email || '');
      setFormPhone(editingContact.phone || '');
      setFormType(editingContact.contact_type);
      setVisibility((editingContact.visibility as Visibility) || 'private');
      setRestrictedUsers(editingContact.restricted_users || []);
      const tags = editingContact.tags as Record<string, unknown> | null;
      setCustomFields(
        tags?.customFields && Array.isArray(tags.customFields)
          ? tags.customFields as CustomField[]
          : []
      );
    } else {
      setFormName('');
      setFormCompany('');
      setFormEmail('');
      setFormPhone('');
      setFormType('customer');
      setCustomFields([]);
      setVisibility('private');
      setRestrictedUsers([]);
    }
  }, [open, editingContact, form]);

  const handleSubmit = async () => {
    if (!formName.trim()) { message.warning('请输入联系人姓名'); return; }
    setSubmitting(true);
    try {
      const payload = {
        name: formName,
        company: formCompany,
        email: formEmail,
        phone: formPhone,
        contact_type: formType,
        tags: formType === 'other' && customFields.length > 0 ? { customFields } : null,
        visibility,
        ...(visibility === 'restricted' && restrictedUsers.length > 0 ? { restricted_users: restrictedUsers } : {}),
      };
      if (editingContact) {
        const res = await updateContact(editingContact.id, payload);
        if (res.code === 0) {
          message.success('联系人已更新');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '更新失败');
        }
      } else {
        const res = await createContact(payload);
        if (res.code === 0) {
          message.success('联系人已创建');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '创建失败');
        }
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={editingContact ? '编辑联系人' : '新建联系人'}
      open={open}
      onOk={() => void handleSubmit()}
      onCancel={onClose}
      confirmLoading={submitting}
      okText="保存"
      cancelText="取消"
      destroyOnClose
      width={560}
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="姓名" required>
          <Input placeholder="请输入姓名" value={formName} onChange={(e) => setFormName(e.target.value)} />
        </Form.Item>
        <Form.Item label="公司">
          <Input placeholder="请输入公司" value={formCompany} onChange={(e) => setFormCompany(e.target.value)} />
        </Form.Item>
        <Form.Item label="邮箱">
          <Input placeholder="请输入邮箱" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
        </Form.Item>
        <Form.Item label="电话">
          <Input placeholder="请输入电话" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
        </Form.Item>
        <Form.Item label="类型">
          <Select value={formType} onChange={(v) => setFormType(v as ContactType)} options={Object.entries(TYPE_MAP).map(([k, v]) => ({ value: k, label: v.text }))} />
        </Form.Item>
        <Form.Item label="可见性">
          <VisibilitySetting
            value={visibility}
            restrictedUsers={restrictedUsers}
            onChange={setVisibility}
            onRestrictedUsersChange={setRestrictedUsers}
            showRestrictedTags={false}
            label=""
          />
        </Form.Item>
        {formType === 'other' && (
          <div style={{ border: 'var(--border-width-thin) solid var(--border-primary)', borderRadius: 'var(--rounded-chip)', padding: "var(--spacing-sm)" }}>
            <div style={{ marginBottom: "var(--spacing-xs)", fontWeight: 600 }}>自定义字段</div>
            {customFields.map((f, i) => (
              <Space key={i} style={{ marginBottom: "var(--spacing-xs)", display: 'flex' }}>
                <Input placeholder="字段名" value={f.key} style={{ width: 120 }}
                  onChange={(e) => { const n = [...customFields]; n[i]!.key = e.target.value; setCustomFields(n); }} />
                <Input placeholder="值" value={f.value} style={{ width: 160 }}
                  onChange={(e) => { const n = [...customFields]; n[i]!.value = e.target.value; setCustomFields(n); }} />
                <Button type="link" danger size="small" onClick={() => setCustomFields(customFields.filter((_, idx) => idx !== i))}>删除</Button>
              </Space>
            ))}
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => setCustomFields([...customFields, { key: '', value: '' }])}>
              添加字段
            </Button>
          </div>
        )}
      </Form>
    </Modal>
  );
}
