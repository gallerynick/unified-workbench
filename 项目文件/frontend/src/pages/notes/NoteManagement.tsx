import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Typography, Modal, message, Space, Input, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, PushpinOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { listNotes, createNote, updateNote, deleteNote } from '../../api/notes';
import type { Note } from '../../types/note';
import styles from './NoteManagement.module.css';

const { Title } = Typography;

export default function NoteManagement() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('');

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try { const params: { page: number; page_size: number; search?: string } = { page, page_size: 20 }; if (search) params.search = search; const res = await listNotes(params); if (res.code === 0) { setNotes(res.data.items); setTotal(res.data.total); } }
    catch { message.error('获取笔记列表失败'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const handleCreate = async () => {
    if (!formTitle.trim()) { message.warning('请输入笔记标题'); return; }
    try {
      const payload: { title: string; content: string; category?: string } = { title: formTitle, content: formContent };
      if (formCategory) payload.category = formCategory;
      const res = await createNote(payload);
      if (res.code === 0) { message.success('笔记已创建'); setModalVisible(false); setFormTitle(''); setFormContent(''); setFormCategory(''); fetchNotes(); }
    } catch { message.error('创建失败'); }
  };

  const handleDelete = (note: Note) => {
    Modal.confirm({ title: '确认删除', content: `确定要删除笔记「${note.title}」吗？`, okText: '删除', okType: 'danger', cancelText: '取消',
      onOk: async () => { try { const res = await deleteNote(note.id); if (res.code === 0) { message.success('笔记已删除'); fetchNotes(); } } catch { message.error('删除失败'); } },
    });
  };

  const handleTogglePin = async (note: Note) => {
    try { const res = await updateNote(note.id, { is_pinned: !note.is_pinned }); if (res.code === 0) { message.success(note.is_pinned ? '已取消置顶' : '已置顶'); fetchNotes(); } }
    catch { message.error('操作失败'); }
  };

  const columns: ColumnsType<Note> = [
    { title: '标题', dataIndex: 'title', key: 'title', render: (t: string, r) => <>{r.is_pinned && <PushpinOutlined style={{ marginRight: 4 }} />}{t}</> },
    { title: '分类', dataIndex: 'category', key: 'category', render: (c: string | null) => c ? <Tag>{c}</Tag> : '-' },
    { title: '标签', dataIndex: 'tags', key: 'tags', render: (tags: string[] | null) => tags?.map((t) => <Tag key={t}>{t}</Tag>) ?? '-' },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', render: (d: string) => new Date(d).toLocaleString('zh-CN') },
    { title: '操作', key: 'action', render: (_, record) => (
      <Space size="small">
        <Button type="link" size="small" icon={<PushpinOutlined />} onClick={() => handleTogglePin(record)} />
        <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
      </Space>
    ) },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4}>笔记管理</Title>
        <Space>
          <Input placeholder="搜索笔记" prefix={<SearchOutlined />} allowClear value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 200 }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>新建笔记</Button>
        </Space>
      </div>
      <Table<Note> columns={columns} dataSource={notes} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize: 20, total, onChange: (p) => setPage(p) }} />
      <Modal title="新建笔记" open={modalVisible} onOk={handleCreate} onCancel={() => setModalVisible(false)} okText="创建" cancelText="取消" width={600}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Input placeholder="笔记标题" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
          <Input placeholder="分类（可选）" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} />
          <Input.TextArea placeholder="笔记内容" value={formContent} onChange={(e) => setFormContent(e.target.value)} rows={8} />
        </Space>
      </Modal>
    </div>
  );
}
