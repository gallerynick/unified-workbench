import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Typography, Modal, message, Space, Input, Tag, Progress, Tooltip, Form, Checkbox, Radio } from 'antd';
import { PlusOutlined, DeleteOutlined, BarChartOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { listVotes, createVote, deleteVote, getVoteResults, submitVote } from '../../api/votes';
import type { Vote, VoteResult } from '../../types/vote';
import type { Visibility } from '../../utils/visibility';
import VisibilitySetting from '../files/VisibilitySetting';
import { useUser } from '../../contexts/UserContext';
import styles from './VoteManagement.module.css';

const { Title, Text } = Typography;

export default function VoteManagement() {
  const { user } = useUser();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [results, setResults] = useState<VoteResult[]>([]);
  const [form] = Form.useForm();
  const [formOptions, setFormOptions] = useState(['', '']);
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [restrictedUsers, setRestrictedUsers] = useState<string[]>([]);
  const [restrictedTags, setRestrictedTags] = useState<string[]>([]);
  const [voteModalVisible, setVoteModalVisible] = useState(false);
  const [currentVote, setCurrentVote] = useState<Vote | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchVotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listVotes({ page, page_size: 20 });
      if (res.code === 0) { setVotes(res.data.items); setTotal(res.data.total); }
    } catch { message.error('获取投票列表失败'); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchVotes(); }, [fetchVotes]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const opts = formOptions.filter((o) => o.trim());
      if (opts.length < 2) { message.warning('至少需要2个选项'); return; }
      const res = await createVote({
        title: values.title,
        description: values.description ?? '',
        options: opts,
        visibility,
        restricted_users: visibility === 'restricted' ? restrictedUsers : undefined,
        restricted_tags: visibility === 'restricted' ? restrictedTags : undefined,
      });
      if (res.code === 0) { message.success('投票已创建'); handleCloseModal(); fetchVotes(); }
    } catch { message.error('创建失败'); }
  };

  const handleDelete = (vote: Vote) => {
    Modal.confirm({
      title: '确认删除', content: `确定要删除投票「${vote.title}」吗？`,
      okText: '删除', okType: 'danger', cancelText: '取消',
      onOk: async () => {
        try { const res = await deleteVote(vote.id); if (res.code === 0) { message.success('投票已删除'); fetchVotes(); } }
        catch { message.error('删除失败'); }
      },
    });
  };

  const handleViewResults = async (vote: Vote) => {
    try {
      const res = await getVoteResults(vote.id);
      if (res.code === 0) { setResults(res.data); setResultsVisible(true); }
    } catch { message.error('获取结果失败'); }
  };

  const handleOpenVote = (vote: Vote) => {
    setCurrentVote(vote);
    setSelectedOptions([]);
    setVoteModalVisible(true);
  };

  const handleSubmitVote = async () => {
    if (!currentVote || selectedOptions.length === 0) {
      message.warning('请至少选择一个选项');
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitVote(currentVote.id, selectedOptions);
      if (res.code === 0) {
        message.success('投票成功');
        setVoteModalVisible(false);
        fetchVotes();
      } else {
        message.error(res.msg || '投票失败');
      }
    } catch {
      message.error('投票失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    form.resetFields();
    setFormOptions(['', '']);
    setVisibility('private');
    setRestrictedUsers([]);
    setRestrictedTags([]);
  };

  const columns: ColumnsType<Vote> = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '选项数', key: 'options', render: (_, r) => r.options.length },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s === 'active' ? '进行中' : '已结束'}</Tag> },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (d: string) => new Date(d).toLocaleString('zh-CN') },
    {
      title: '操作', key: 'action', width: 200,
      render: (_, record) => (
        <Space size="small">
          {record.status === 'active' && (
            <Tooltip title="参与投票">
              <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleOpenVote(record)}>投票</Button>
            </Tooltip>
          )}
          <Tooltip title="查看结果">
            <Button type="link" size="small" icon={<BarChartOutlined />} onClick={() => handleViewResults(record)}>结果</Button>
          </Tooltip>
          {record.owner_id === user?.id && (
            <Tooltip title="删除">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>投票决策</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>新建投票</Button>
      </div>
      <Table<Vote> columns={columns} dataSource={votes} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize: 20, total, onChange: (p) => setPage(p) }} />
      <Modal title="新建投票" open={modalVisible} onOk={handleCreate} onCancel={handleCloseModal} okText="创建" cancelText="取消" width={560} styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="投票标题" rules={[{ required: true, message: '请输入投票标题' }]}>
            <Input placeholder="请输入投票标题" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入描述（可选）" rows={2} />
          </Form.Item>
          {formOptions.map((opt, i) => (
            <Form.Item key={i} label={`选项 ${i + 1}`}>
              <Input placeholder={`请输入选项 ${i + 1}`} value={opt} onChange={(e) => { const n = [...formOptions]; n[i] = e.target.value; setFormOptions(n); }} />
            </Form.Item>
          ))}
          <Button type="dashed" onClick={() => setFormOptions([...formOptions, ''])} block>添加选项</Button>
          <div style={{ marginTop: 16 }}>
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
      <Modal title="投票结果" open={resultsVisible} onCancel={() => setResultsVisible(false)} footer={null} width={560} styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}>
        {results.map((r) => (
          <div key={r.option} style={{ marginBottom: 8 }}>
            <Text>{r.option}</Text>
            <Progress percent={r.percentage} format={() => `${r.count}票 (${r.percentage}%)`} />
          </div>
        ))}
      </Modal>
      <Modal
        title={currentVote ? `参与投票：${currentVote.title}` : '参与投票'}
        open={voteModalVisible}
        onOk={handleSubmitVote}
        onCancel={() => setVoteModalVisible(false)}
        okText="提交投票"
        cancelText="取消"
        confirmLoading={submitting}
        width={560}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        {currentVote && (
          <div>
            {currentVote.description && <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>{currentVote.description}</Text>}
            {currentVote.allow_multiple ? (
              <Checkbox.Group value={selectedOptions} onChange={setSelectedOptions} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {currentVote.options.map((opt) => (
                  <Checkbox key={opt} value={opt}>{opt}</Checkbox>
                ))}
              </Checkbox.Group>
            ) : (
              <Radio.Group value={selectedOptions[0]} onChange={(e) => setSelectedOptions([e.target.value])} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {currentVote.options.map((opt) => (
                  <Radio key={opt} value={opt}>{opt}</Radio>
                ))}
              </Radio.Group>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
