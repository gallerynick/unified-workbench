import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Typography,
  Modal,
  message,
  Input,
  Tag,
  Switch,
  Tooltip,
  Form,
  Card,
  Tabs,
  Space,
  Popconfirm,
  Empty,
  Pagination,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  PushpinOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { listAnnouncements, createAnnouncement, deleteAnnouncement, updateAnnouncement } from '../../api/announcements';
import type { Announcement } from '../../types/announcement';
import { getUserId, isAdmin } from '../../utils/auth';
import styles from './AnnouncementManagement.module.css';

const { Title, Text } = Typography;

type TabKey = 'all' | 'mine';

export default function AnnouncementManagement() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [formPinned, setFormPinned] = useState(false);
  const [editFormPinned, setEditFormPinned] = useState(false);
  const [editFormPublished, setEditFormPublished] = useState(false);

  const currentUserId = getUserId();
  const userIsAdmin = isAdmin();

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const params: { page: number; page_size: number; owner_id?: string } = {
        page,
        page_size: 12,
      };
      if (activeTab === 'mine' && currentUserId) {
        params.owner_id = currentUserId;
      }
      const res = await listAnnouncements(params);
      if (res.code === 0) {
        setAnnouncements(res.data.items);
        setTotal(res.data.total);
      }
    } catch {
      message.error('获取公告列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, activeTab, currentUserId]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleTabChange = (key: string) => {
    setActiveTab(key as TabKey);
    setPage(1);
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const res = await createAnnouncement({
        title: values.title,
        content: values.content,
        is_pinned: formPinned,
      });
      if (res.code === 0) {
        message.success('公告已发布');
        setModalVisible(false);
        form.resetFields();
        setFormPinned(false);
        fetchAnnouncements();
      }
    } catch {
      message.error('发布失败');
    }
  };

  const handleEdit = (a: Announcement) => {
    setEditingAnnouncement(a);
    editForm.setFieldsValue({
      title: a.title,
      content: a.content,
    });
    setEditFormPinned(a.is_pinned);
    setEditFormPublished(a.is_published);
    setEditModalVisible(true);
  };

  const handleUpdate = async () => {
    if (!editingAnnouncement) return;
    try {
      const values = await editForm.validateFields();
      const res = await updateAnnouncement(editingAnnouncement.id, {
        title: values.title,
        content: values.content,
        is_pinned: editFormPinned,
        is_published: editFormPublished,
      });
      if (res.code === 0) {
        message.success('公告已更新');
        setEditModalVisible(false);
        setEditingAnnouncement(null);
        editForm.resetFields();
        setEditFormPinned(false);
        setEditFormPublished(false);
        fetchAnnouncements();
      }
    } catch {
      message.error('更新失败');
    }
  };

  const handleDelete = async (a: Announcement) => {
    try {
      const res = await deleteAnnouncement(a.id);
      if (res.code === 0) {
        message.success('公告已删除');
        fetchAnnouncements();
      }
    } catch {
      message.error('删除失败');
    }
  };

  const canManage = (item: Announcement): boolean => {
    return item.owner_id === currentUserId || userIsAdmin;
  };

  const tabItems = [
    { key: 'all', label: '全部' },
    { key: 'mine', label: '我创建的' },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>
          公告通知
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          发布公告
        </Button>
      </div>

      <Tabs activeKey={activeTab} items={tabItems} onChange={handleTabChange} className={styles.tabs ?? ''} />

      {announcements.length === 0 && !loading ? (
        <Empty description="暂无公告" className={styles.empty ?? ''} />
      ) : (
        <>
          <div className={styles.cardGrid}>
            {announcements.map((item) => (
                <Card
                key={item.id}
                className={styles.card ?? ''}
                loading={loading}
                title={
                  <div className={styles.cardTitle}>
                    {item.is_pinned && (
                      <Tooltip title="置顶">
                        <PushpinOutlined className={styles.pinIcon} />
                      </Tooltip>
                    )}
                    <Text ellipsis className={styles.titleText ?? ''}>
                      {item.title}
                    </Text>
                  </div>
                }
                extra={
                  <Tag color={item.is_published ? 'green' : 'default'}>
                    {item.is_published ? '已发布' : '草稿'}
                  </Tag>
                }
              >
                <div className={styles.cardContent}>
                  <Text type="secondary" className={styles.contentPreview ?? ''}>
                    {item.content.length > 120 ? `${item.content.slice(0, 120)}...` : item.content}
                  </Text>
                  <Text type="secondary" className={styles.meta ?? ''}>
                    {new Date(item.created_at).toLocaleString('zh-CN')}
                  </Text>
                </div>
                {canManage(item) && (
                  <div className={styles.cardActions}>
                    <Space>
                      <Tooltip title="编辑">
                        <Button
                          type="link"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleEdit(item)}
                        >
                          编辑
                        </Button>
                      </Tooltip>
                      <Popconfirm
                        title="确认删除"
                        description={`确定要删除公告「${item.title}」吗？`}
                        okText="删除"
                        cancelText="取消"
                        okType="danger"
                        onConfirm={() => handleDelete(item)}
                      >
                        <Tooltip title="删除">
                          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                            删除
                          </Button>
                        </Tooltip>
                      </Popconfirm>
                    </Space>
                  </div>
                )}
              </Card>
            ))}
          </div>
          <div className={styles.pagination}>
            <Pagination
              current={page}
              pageSize={12}
              total={total}
              showSizeChanger={false}
              onChange={(p) => setPage(p)}
            />
          </div>
        </>
      )}

      {/* 创建公告弹窗 */}
      <Modal
        title="发布公告"
        open={modalVisible}
        onOk={handleCreate}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setFormPinned(false);
        }}
        okText="发布"
        cancelText="取消"
        width={560}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="公告标题" rules={[{ required: true, message: '请输入公告标题' }]}>
            <Input placeholder="请输入公告标题" />
          </Form.Item>
          <Form.Item name="content" label="公告内容" rules={[{ required: true, message: '请输入公告内容' }]}>
            <Input.TextArea placeholder="请输入公告内容" rows={5} />
          </Form.Item>
          <Form.Item label="置顶">
            <Switch
              checked={formPinned}
              onChange={setFormPinned}
              checkedChildren="置顶"
              unCheckedChildren="普通"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑公告弹窗 */}
      <Modal
        title="编辑公告"
        open={editModalVisible}
        onOk={handleUpdate}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingAnnouncement(null);
          editForm.resetFields();
          setEditFormPinned(false);
          setEditFormPublished(false);
        }}
        okText="保存"
        cancelText="取消"
        width={560}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="title" label="公告标题" rules={[{ required: true, message: '请输入公告标题' }]}>
            <Input placeholder="请输入公告标题" />
          </Form.Item>
          <Form.Item name="content" label="公告内容" rules={[{ required: true, message: '请输入公告内容' }]}>
            <Input.TextArea placeholder="请输入公告内容" rows={5} />
          </Form.Item>
          <Form.Item label="置顶">
            <Switch
              checked={editFormPinned}
              onChange={setEditFormPinned}
              checkedChildren="置顶"
              unCheckedChildren="普通"
            />
          </Form.Item>
          <Form.Item label="发布状态">
            <Switch
              checked={editFormPublished}
              onChange={setEditFormPublished}
              checkedChildren={<><EyeOutlined /> 已发布</>}
              unCheckedChildren={<><EyeInvisibleOutlined /> 草稿</>}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
