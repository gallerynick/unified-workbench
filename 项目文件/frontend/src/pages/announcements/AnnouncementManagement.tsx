import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Typography, Modal, message, Space, Input, Tag, Switch, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, PushpinOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { listAnnouncements, createAnnouncement, deleteAnnouncement } from '../../api/announcements';
import type { Announcement } from '../../types/announcement';
import styles from './AnnouncementManagement.module.css';

const { Title } = Typography;

export default function AnnouncementManagement() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formPinned, setFormPinned] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try { const res = await listAnnouncements({ page, page_size: 20 }); if (res.code === 0) { setAnnouncements(res.data.items); setTotal(res.data.total); } }
    catch { message.error('获取公告列表失败'); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  const handleCreate = async () => {
    if (!formTitle.trim() || !formContent.trim()) { message.warning('请输入标题和内容'); return; }
    try {
      const res = await createAnnouncement({ title: formTitle, content: formContent, is_pinned: formPinned });
      if (res.code === 0) { message.success('公告已发布'); setModalVisible(false); setFormTitle(''); setFormContent(''); setFormPinned(false); fetchAnnouncements(); }
    } catch { message.error('发布失败'); }
  };

  const handleDelete = (a: Announcement) => {
    Modal.confirm({ title: '确认删除', content: `确定要删除公告「${a.title}」吗？`, okText: '删除', okType: 'danger', cancelText: '取消',
      onOk: async () => { try { const res = await deleteAnnouncement(a.id); if (res.code === 0) { message.success('公告已删除'); fetchAnnouncements(); } } catch { message.error('删除失败'); } },
    });
  };

  const columns: ColumnsType<Announcement> = [
    { title: '标题', dataIndex: 'title', key: 'title', render: (t: string, r) => <>{r.is_pinned && <PushpinOutlined style={{ marginRight: 4 }} />}{t}</> },
    { title: '发布时间', dataIndex: 'created_at', key: 'created_at', render: (d: string) => new Date(d).toLocaleString('zh-CN') },
    { title: '状态', dataIndex: 'is_published', key: 'is_published', render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '已发布' : '草稿'}</Tag> },
    { title: '操作', key: 'action', width: 100, render: (_, record) => (<Space size="small"><Tooltip title="删除"><Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button></Tooltip></Space>) },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>公告中心</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>发布公告</Button>
      </div>
      <Table<Announcement> columns={columns} dataSource={announcements} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize: 20, total, onChange: (p) => setPage(p) }} />
      <Modal title="发布公告" open={modalVisible} onOk={handleCreate} onCancel={() => setModalVisible(false)} okText="发布" cancelText="取消">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Input placeholder="公告标题" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
          <Input.TextArea placeholder="公告内容" value={formContent} onChange={(e) => setFormContent(e.target.value)} rows={5} />
          <Switch checked={formPinned} onChange={setFormPinned} checkedChildren="置顶" unCheckedChildren="普通" />
        </Space>
      </Modal>
    </div>
  );
}
