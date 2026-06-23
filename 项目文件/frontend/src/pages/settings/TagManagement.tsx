import { useState } from 'react';
import { Table, Button, Input, Typography, Modal, message, Space, Tag, Tooltip, Result } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTagContext } from '../../contexts/TagContext';
import { isAdmin } from '../../utils/auth';
import { createTag, updateTag, deleteTag } from '../../api/tags';
import type { Tag as TagType } from '../../api/tags';
import styles from './TagManagement.module.css';

const { Title } = Typography;

const COLOR_OPTIONS = [
  { value: 'blue', label: '蓝色' },
  { value: 'purple', label: '紫色' },
  { value: 'green', label: '绿色' },
  { value: 'gold', label: '金色' },
  { value: 'red', label: '红色' },
  { value: 'orange', label: '橙色' },
  { value: 'cyan', label: '青色' },
  { value: 'magenta', label: '品红' },
];

export default function TagManagement() {
  const { tags, refresh } = useTagContext();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('blue');

  if (!isAdmin()) {
    return <Result status="403" title="权限不足" subTitle="只有管理员可以管理标签" icon={<LockOutlined />} />;
  }

  const handleCreate = () => {
    setEditingTag(null);
    setFormName('');
    setFormColor('blue');
    setModalVisible(true);
  };

  const handleEdit = (tag: TagType) => {
    setEditingTag(tag);
    setFormName(tag.name);
    setFormColor(tag.color || 'blue');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      message.warning('请输入标签名称');
      return;
    }
    try {
      if (editingTag) {
        const res = await updateTag(editingTag.id, { name: formName, color: formColor });
        if (res.code === 0) {
          message.success('标签已更新');
          setModalVisible(false);
          refresh();
        }
      } else {
        const res = await createTag({ name: formName, color: formColor });
        if (res.code === 0) {
          message.success('标签已创建');
          setModalVisible(false);
          refresh();
        }
      }
    } catch {
      message.error('操作失败');
    }
  };

  const handleDelete = (tag: TagType) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除标签「${tag.name}」吗？删除后，所有用户关联的此标签将被移除。`,
      okText: '删除',
      okType: 'danger',
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
        <Title level={4} className={styles.title ?? ''}>标签管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建标签</Button>
      </div>

      <Table<TagType>
        columns={columns}
        dataSource={tags}
        rowKey="id"
        pagination={false}
      />

      <Modal
        title={editingTag ? '编辑标签' : '新建标签'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Input
            placeholder="标签名称"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <div>
            <p style={{ marginBottom: 8, fontSize: 13, color: 'rgba(0, 0, 0, 0.65)' }}>选择颜色</p>
            <Space wrap>
              {COLOR_OPTIONS.map((opt) => (
                <Tag
                  key={opt.value}
                  color={opt.value}
                  style={{ cursor: 'pointer', opacity: formColor === opt.value ? 1 : 0.5 }}
                  onClick={() => setFormColor(opt.value)}
                >
                  {opt.label}
                </Tag>
              ))}
            </Space>
          </div>
        </Space>
      </Modal>
    </div>
  );
}
