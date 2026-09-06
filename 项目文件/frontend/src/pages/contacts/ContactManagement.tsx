import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Typography, Modal, message, Space, Tooltip } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { listContacts, deleteContact } from '../../api/contacts';
import type { Contact, ContactType } from '../../types/contact';
import ContactModal from './ContactModal';
import styles from './ContactManagement.module.css';

const { Title, Paragraph, Text } = Typography;

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

  // ── 弹窗状态（共用组件 ContactModal） ──
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [permissionVisible, setPermissionVisible] = useState(false);

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

  // ── 打开新建/编辑（弹窗共用 ContactModal） ──
  const handleCreate = () => {
    setEditingContact(null);
    setContactModalOpen(true);
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setContactModalOpen(true);
  };

  const handleDelete = (contact: Contact) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除联系人「${contact.name}」吗？`,
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
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
        <Title level={4} className={styles.title ?? ''}>联系人管理</Title>
        <Space>
          <Input
            placeholder="搜索姓名/公司/邮箱"
            prefix={<SearchOutlined style={{ color: 'var(--text-secondary)' }} />}
            allowClear
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            variant="filled"
            className={styles.searchInput ?? ''}
          />
          <Select value={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1); }} placeholder="类型筛选" allowClear style={{ width: 120 }}
            options={[{ value: '', label: '全部' }, ...Object.entries(TYPE_MAP).map(([k, v]) => ({ value: k, label: v.text }))]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建联系人</Button>
          <Tooltip title="权限说明">
            <Button
              type="text"
              size="small"
              icon={<QuestionCircleOutlined />}
              onClick={() => setPermissionVisible(true)}
            />
          </Tooltip>
        </Space>
      </div>

      <Table<Contact> className={styles.table ?? ''} columns={columns} dataSource={contacts} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, showQuickJumper: true, showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />

      {/* 新建/编辑 联系人（共用组件 ContactModal） */}
      <ContactModal
        open={contactModalOpen}
        editingContact={editingContact}
        onClose={() => setContactModalOpen(false)}
        onSaved={() => void fetchContacts()}
      />

      <Modal
        title="权限说明"
        open={permissionVisible}
        width={560}
        footer={null}
        onCancel={() => setPermissionVisible(false)}
      >
        <div className={styles.permissionContent ?? ''}>
          <Title level={5}>创建者权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>创建者拥有联系人记录的完整管理权限，可以编辑联系信息、删除记录和设置可见范围。</Paragraph>
          <Title level={5}>成员/指定用户权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>可见范围内的成员可以查看联系人信息；被指定的用户只能查看被授权给自己的联系人。</Paragraph>
          <Title level={5}>可见范围</Title>
          <ul className={styles.permissionList ?? ''}>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                公开：所有成员都可以查看该联系人
              </Text>
            </li>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                私有：仅创建者和被授权成员可以查看
              </Text>
            </li>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                指定用户：仅被指定的用户可以看到该联系人
              </Text>
            </li>
          </ul>
          <Title level={5}>管理员</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>系统管理员可以管理自己创建以及被指定给自己的联系人。</Paragraph>
          <Title level={5}>创建权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>所有成员都可以创建联系人，创建时需设定可见范围。</Paragraph>
        </div>
      </Modal>
    </div>
  );
}
