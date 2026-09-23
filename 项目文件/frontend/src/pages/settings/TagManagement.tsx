import { useState } from 'react';
import { Table, Button, Typography, Modal, message, Space, Tag, Tooltip, Result } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTagContext } from '../../contexts/TagContext';
import { isAdmin } from '../../utils/auth';
import { deleteTag } from '../../api/tags';
import type { Tag as TagType } from '../../api/tags';
import TagModal from './TagModal';
import styles from './TagManagement.module.css';

const { Title } = Typography;

export default function TagManagement() {
  const { tags, refresh } = useTagContext();

  // ── 弹窗状态（共用组件 TagModal） ──
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagType | null>(null);

  if (!isAdmin()) {
    return <Result status="403" title="权限不足" subTitle="只有管理员可以管理标签" icon={<LockOutlined />} />;
  }

  // ── 打开新建/编辑（弹窗共用 TagModal） ──
  const handleCreate = () => {
    setEditingTag(null);
    setTagModalOpen(true);
  };

  const handleEdit = (tag: TagType) => {
    setEditingTag(tag);
    setTagModalOpen(true);
  };

  const handleDelete = (tag: TagType) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除标签「${tag.name}」吗？删除后，所有用户关联的此标签将被移除。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteTag(tag.id);
          if (res.code === 0) {
            message.success('标签已删除');
            refresh();
          }
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const columns: ColumnsType<TagType> = [
    {
      title: '标签名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <Tag color={record.color || 'default'}>{name}</Tag>
      ),
    },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      width: 100,
      render: (color: string | null) => color || '默认',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
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
        <Title level={4} className={styles.title ?? ''}>用户标签分类</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建标签</Button>
      </div>

      <Table<TagType>
        className={styles.table ?? ''}
        columns={columns}
        dataSource={tags}
        rowKey="id"
        pagination={{ showSizeChanger: true, showQuickJumper: true, showTotal: (t) => `共 ${t} 条` }}
      />

      {/* 新建/编辑 标签（共用组件 TagModal） */}
      <TagModal
        open={tagModalOpen}
        editingTag={editingTag}
        onClose={() => setTagModalOpen(false)}
        onSaved={() => void refresh()}
      />
    </div>
  );
}
