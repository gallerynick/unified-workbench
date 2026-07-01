import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Typography, Modal, message, Space, Input, Tag, Switch, Tooltip, Form, Dropdown } from 'antd';
import { PlusOutlined, DeleteOutlined, FormOutlined, BarChartOutlined, ShareAltOutlined, QrcodeOutlined, CopyOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { listForms, createForm, deleteForm } from '../../api/forms';
import type { FormItem, FormField } from '../../types/form';
import type { Visibility } from '../../utils/visibility';
import VisibilitySetting from '../files/VisibilitySetting';
import styles from './FormManagement.module.css';

const { Title, Text } = Typography;

export default function FormManagement() {
  const [forms, setForms] = useState<FormItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [formFields, setFormFields] = useState<FormField[]>([{ key: 'field_1', type: 'text', label: '', required: false }]);
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [restrictedUsers, setRestrictedUsers] = useState<string[]>([]);
  const [restrictedTags, setRestrictedTags] = useState<string[]>([]);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrForm, setQrForm] = useState<FormItem | null>(null);

  const navigate = useNavigate();

  const fetchForms = useCallback(async () => {
    setLoading(true);
    try { const res = await listForms({ page, page_size: 20 }); if (res.code === 0) { setForms(res.data.items); setTotal(res.data.total); } }
    catch { message.error('获取表单列表失败'); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchForms(); }, [fetchForms]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const res = await createForm({
        title: values.title,
        description: values.description ?? '',
        fields: formFields,
        visibility,
        allow_anonymous: values.allow_anonymous || false,
        restricted_users: visibility === 'restricted' ? restrictedUsers : undefined,
        restricted_tags: visibility === 'restricted' ? restrictedTags : undefined,
      });
      if (res.code === 0) { message.success('表单已创建'); handleCloseModal(); fetchForms(); }
    } catch { message.error('创建失败'); }
  };

  const handleDelete = (form: FormItem) => {
    Modal.confirm({ title: '确认删除', content: `确定要删除表单「${form.title}」吗？`, okText: '删除', okType: 'danger', cancelText: '取消',
      onOk: async () => { try { const res = await deleteForm(form.id); if (res.code === 0) { message.success('表单已删除'); fetchForms(); } } catch { message.error('删除失败'); } },
    });
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    form.resetFields();
    setFormFields([{ key: 'field_1', type: 'text', label: '', required: false }]);
    setVisibility('private');
    setRestrictedUsers([]);
    setRestrictedTags([]);
  };

  const addField = () => setFormFields([...formFields, { key: `field_${formFields.length + 1}`, type: 'text', label: '', required: false }]);

  const columns: ColumnsType<FormItem> = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '字段数', key: 'fields', render: (_, r) => r.fields.length },
    { title: '状态', dataIndex: 'is_active', key: 'is_active', render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '关闭'}</Tag> },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (d: string) => new Date(d).toLocaleString('zh-CN') },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: FormItem) => (
        <Space>
          {record.is_active && record.visibility === 'public' && (
            <Tooltip title="填写表单">
              <Button type="link" size="small" icon={<FormOutlined />}
                onClick={() => window.open(`/forms/${record.id}/fill`, '_blank')}
              >填写</Button>
            </Tooltip>
          )}
          <Tooltip title="查看回复">
            <Button type="link" size="small" icon={<BarChartOutlined />}
              onClick={() => navigate(`/forms/${record.id}/responses`)}
            >回复 {record.response_count || 0}</Button>
          </Tooltip>
          {record.is_active && record.visibility === 'public' && (
            <Dropdown menu={{ items: [
              { key: 'copy', label: '复制链接', icon: <CopyOutlined />, onClick: () => { navigator.clipboard.writeText(`${window.location.origin}/forms/${record.id}/fill`); message.success('链接已复制'); }},
              { key: 'qr', label: '二维码', icon: <QrcodeOutlined />, onClick: () => { setQrForm(record); setShowQrModal(true); }},
            ]}}>
              <Button type="link" size="small" icon={<ShareAltOutlined />}>分享</Button>
            </Dropdown>
          )}
          <Button type="link" size="small" danger icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)} />
        </Space>
      )
    },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>表单收集</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>新建表单</Button>
      </div>
      <Table<FormItem> columns={columns} dataSource={forms} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize: 20, total, onChange: (p) => setPage(p) }} />
      <Modal title="新建表单" open={modalVisible} onOk={handleCreate} onCancel={handleCloseModal} okText="创建" cancelText="取消" width={600}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="表单标题" rules={[{ required: true, message: '请输入表单标题' }]}>
            <Input placeholder="请输入表单标题" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入描述（可选）" rows={2} />
          </Form.Item>
          {formFields.map((f, i) => (
            <Space key={i}>
              <Input placeholder="字段标签" value={f.label} onChange={(e) => { const n = [...formFields]; n[i]!.label = e.target.value; setFormFields(n); }} />
              <Switch checked={f.required ?? false} onChange={(v) => { const n = [...formFields]; n[i]!.required = v; setFormFields(n); }} checkedChildren="必填" unCheckedChildren="可选" />
            </Space>
          ))}
          <Button type="dashed" onClick={addField} block>添加字段</Button>
          <div style={{ marginTop: 16 }}>
            <Form.Item name="allow_anonymous" label="允许匿名提交" valuePropName="checked">
              <Switch />
            </Form.Item>
            <VisibilitySetting
              value={visibility}
              restrictedUsers={restrictedUsers}
              restrictedTags={restrictedTags}
              onChange={setVisibility}
              onRestrictedUsersChange={setRestrictedUsers}
              onRestrictedTagsChange={setRestrictedTags}
              showDescription
            />
          </div>
        </Form>
      </Modal>
      <Modal title="分享表单" open={showQrModal} onCancel={() => setShowQrModal(false)} footer={null} width={320}>
        {qrForm && (
          <div style={{ textAlign: 'center' }}>
            <QRCodeSVG value={`${window.location.origin}/forms/${qrForm.id}/fill`} size={200} />
            <div style={{ marginTop: 12 }}>
              <Text copyable>{`${window.location.origin}/forms/${qrForm.id}/fill`}</Text>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
