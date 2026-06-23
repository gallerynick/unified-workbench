import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Typography, Modal, message, Space, Tooltip } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { listContacts, createContact, updateContact, deleteContact } from '../../api/contacts';
import type { Contact, ContactType } from '../../types/contact';
import styles from './ContactManagement.module.css';

const { Title } = Typography;

const TYPE_MAP: Record<ContactType, { color: string; text: string }> = {
  customer: { color: 'blue', text: '客户' },
  supplier: { color: 'green', text: '供应商' },
  partner: { color: 'purple', text: '合作伙伴' },
  other: { color: 'default', text: '其他' },
};

export default function ContactManagement() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formName, setFormName] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formType, setFormType] = useState<ContactType>('customer');

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params: { page: number; page_size: number; contact_type?: string; search?: string } = {
        page,
        page_size: pageSize,
      };
      if (typeFilter) params.contact_type = typeFilter;
      if (search) params.search = search;
      const res = await listContacts(params);
      if (res.code === 0) {
        setContacts(res.data.items);
        setTotal(res.data.total);
      }
    } catch {
      message.error('获取联系人列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeFilter, search]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const handleCreate = () => {
    setEditingContact(null);
    setFormName('');
    setFormCompany('');
    setFormEmail('');
    setFormPhone('');
    setFormType('customer');
    setModalVisible(true);
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormName(contact.name);
    setFormCompany(contact.company || '');
    setFormEmail(contact.email || '');
    setFormPhone(contact.phone || '');
    setFormType(contact.contact_type);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { message.warning('请输入联系人姓名'); return; }
    try {
      if (editingContact) {
        const res = await updateContact(editingContact.id, {
          name: formName, company: formCompany, email: formEmail, phone: formPhone, contact_type: formType,
        });
        if (res.code === 0) { message.success('联系人已更新'); setModalVisible(false); fetchContacts(); }
      } else {
        const res = await createContact({
          name: formName, company: formCompany, email: formEmail, phone: formPhone, contact_type: formType,
        });
        if (res.code === 0) { message.success('联系人已创建'); setModalVisible(false); fetchContacts(); }
      }
    } catch { message.error('操作失败'); }
  };

  const handleDelete = (contact: Contact) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除联系人「${contact.name}」吗？`,
      okText: '删除', okType: 'danger', cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteContact(contact.id);
          if (res.code === 0) { message.success('联系人已删除'); fetchContacts(); }
        } catch { message.error('删除失败'); }
      },
    });
  };

  const columns: ColumnsType<Contact> = [
    { title: '姓名', dataIndex: 'name', key: 'name', width: 120 },
    { title: '公司', dataIndex: 'company', key: 'company', width: 150, render: (v: string | null) => v || '-' },
    { title: '邮箱', dataIndex: 'email', key: 'email', width: 180, render: (v: string | null) => v || '-' },
    { title: '电话', dataIndex: 'phone', key: 'phone', width: 130, render: (v: string | null) => v || '-' },
    {
      title: '类型', dataIndex: 'contact_type', key: 'contact_type', width: 100,
      render: (type: ContactType) => <Tag color={TYPE_MAP[type].color}>{TYPE_MAP[type].text}</Tag>,
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作', key: 'action', width: 140,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          </Tooltip>
          <Tooltip title="删除">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>客户管理</Title>
        <Space>
          <Input placeholder="搜索姓名/公司/邮箱" prefix={<SearchOutlined />} allowClear value={search}
            onChange={(e) => setSearch(e.target.value)} style={{ width: 200 }} />
          <Select value={typeFilter} onChange={setTypeFilter} placeholder="类型筛选" allowClear style={{ width: 120 }}
            options={[{ value: '', label: '全部' }, ...Object.entries(TYPE_MAP).map(([k, v]) => ({ value: k, label: v.text }))]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建联系人</Button>
        </Space>
      </div>

      <Table<Contact> columns={columns} dataSource={contacts} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />

      <Modal title={editingContact ? '编辑联系人' : '新建联系人'} open={modalVisible} onOk={handleSave}
        onCancel={() => setModalVisible(false)} okText="保存" cancelText="取消">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Input placeholder="姓名 *" value={formName} onChange={(e) => setFormName(e.target.value)} />
          <Input placeholder="公司" value={formCompany} onChange={(e) => setFormCompany(e.target.value)} />
          <Input placeholder="邮箱" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
          <Input placeholder="电话" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
          <Select value={formType} onChange={(v) => setFormType(v as ContactType)} style={{ width: '100%' }}
            options={Object.entries(TYPE_MAP).map(([k, v]) => ({ value: k, label: v.text }))}
          />
        </Space>
      </Modal>
    </div>
  );
}
