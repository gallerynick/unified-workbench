import { useEffect, useState } from 'react';
import { AutoComplete, Form, Input, Modal, message } from 'antd';
import { CONTACT_TYPE_PRESETS } from '../../types/contact';
import type { Contact } from '../../types/contact';
import type { Visibility } from '../../utils/visibility';
import VisibilitySetting from '@/components/VisibilitySetting/VisibilitySetting';
import { createContact, updateContact } from '../../api/contacts';

interface ContactModalProps {
  open: boolean;
  /** 非空表示编辑模式；null 表示新建 */
  editingContact?: Contact | null;
  onClose: () => void;
  /** 保存成功回调（父组件刷新列表） */
  onSaved: () => void;
}

/**
 * 联系人 新建/编辑 共用弹窗
 *
 * 供「联系人管理」页（ContactManagement）复用，表单与提交逻辑内聚于此，
 * 页面只负责打开/关闭/刷新，一处修改、多处以一。
 *
 * 类型字段为 AutoComplete：可选「客户/供应商/合作伙伴」预设，也可直接输入
 * 自定义类型（后端 VARCHAR(100) 存储）；旧版「其他 + 自定义字段」方案已移除。
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
  const [formType, setFormType] = useState('customer');
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
      setFormType(editingContact.contact_type || 'customer');
      setVisibility((editingContact.visibility as Visibility) || 'private');
      setRestrictedUsers(editingContact.restricted_users || []);
    } else {
      setFormName('');
      setFormCompany('');
      setFormEmail('');
      setFormPhone('');
      setFormType('customer');
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
        // 预设与自定义类型共用同一字段；清空时回落到默认值 customer
        contact_type: formType.trim() || 'customer',
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
          <AutoComplete
            value={formType}
            onChange={(v) => setFormType(v)}
            options={CONTACT_TYPE_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
            placeholder="选择预设或直接输入自定义类型"
            allowClear
            onBlur={() => { if (!formType.trim()) setFormType('customer'); }}
          />
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
      </Form>
    </Modal>
  );
}
