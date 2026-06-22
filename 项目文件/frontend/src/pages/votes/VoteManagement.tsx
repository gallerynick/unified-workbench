import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Typography, Modal, message, Space, Input, Tag, Progress, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, BarChartOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { listVotes, createVote, deleteVote, getVoteResults } from '../../api/votes';
import type { Vote, VoteResult } from '../../types/vote';
import styles from './VoteManagement.module.css';

const { Title, Text } = Typography;

export default function VoteManagement() {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [results, setResults] = useState<VoteResult[]>([]);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formOptions, setFormOptions] = useState(['', '']);

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
    if (!formTitle.trim()) { message.warning('请输入投票标题'); return; }
    const opts = formOptions.filter((o) => o.trim());
    if (opts.length < 2) { message.warning('至少需要2个选项'); return; }
    try {
      const res = await createVote({ title: formTitle, description: formDesc, options: opts });
      if (res.code === 0) { message.success('投票已创建'); setModalVisible(false); setFormTitle(''); setFormDesc(''); setFormOptions(['', '']); fetchVotes(); }
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

  const columns: ColumnsType<Vote> = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '选项数', key: 'options', render: (_, r) => r.options.length },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s === 'active' ? '进行中' : '已结束'}</Tag> },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (d: string) => new Date(d).toLocaleString('zh-CN') },
    {
      title: '操作', key: 'action', width: 160,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看结果">
            <Button type="link" size="small" icon={<BarChartOutlined />} onClick={() => handleViewResults(record)}>结果</Button>
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
        <Title level={4}>投票决策</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>新建投票</Button>
      </div>
      <Table<Vote> columns={columns} dataSource={votes} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize: 20, total, onChange: (p) => setPage(p) }} />
      <Modal title="新建投票" open={modalVisible} onOk={handleCreate} onCancel={() => setModalVisible(false)} okText="创建" cancelText="取消">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Input placeholder="投票标题" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
          <Input.TextArea placeholder="描述（可选）" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={2} />
          {formOptions.map((opt, i) => (
            <Input key={i} placeholder={`选项 ${i + 1}`} value={opt} onChange={(e) => { const n = [...formOptions]; n[i] = e.target.value; setFormOptions(n); }} />
          ))}
          <Button type="dashed" onClick={() => setFormOptions([...formOptions, ''])} block>添加选项</Button>
        </Space>
      </Modal>
      <Modal title="投票结果" open={resultsVisible} onCancel={() => setResultsVisible(false)} footer={null}>
        {results.map((r) => (
          <div key={r.option} style={{ marginBottom: 8 }}>
            <Text>{r.option}</Text>
            <Progress percent={r.percentage} format={() => `${r.count}票 (${r.percentage}%)`} />
          </div>
        ))}
      </Modal>
    </div>
  );
}
