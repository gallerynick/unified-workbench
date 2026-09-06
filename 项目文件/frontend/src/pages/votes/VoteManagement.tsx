import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Typography, Modal, message, Space, Tag, Progress, Tooltip, Checkbox, Radio } from 'antd';
import { PlusOutlined, DeleteOutlined, BarChartOutlined, CheckCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { listVotes, deleteVote, getVoteResults, submitVote } from '../../api/votes';
import type { Vote, VoteResult } from '../../types/vote';
import { useUser } from '../../contexts/UserContext';
import VoteModal from './VoteModal';
import styles from './VoteManagement.module.css';

const { Title, Paragraph, Text } = Typography;

export default function VoteManagement() {
  const { user } = useUser();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [results, setResults] = useState<VoteResult[]>([]);
  const [voteModalVisible, setVoteModalVisible] = useState(false);
  const [currentVote, setCurrentVote] = useState<Vote | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [permissionVisible, setPermissionVisible] = useState(false);

  const fetchVotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listVotes({ page, page_size: pageSize });
      if (res.code === 0) { setVotes(res.data.items); setTotal(res.data.total); }
    } catch { message.error('获取投票列表失败'); }
    finally { setLoading(false); }
  }, [page, pageSize]);

  useEffect(() => { fetchVotes(); }, [fetchVotes]);

  const handleDelete = (vote: Vote) => {
    Modal.confirm({
      title: '确认删除', content: `确定要删除投票「${vote.title}」吗？`,
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
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
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>新建投票</Button>
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
      <Table<Vote> className={styles.table ?? ''} columns={columns} dataSource={votes} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, showQuickJumper: true, showTotal: (t) => `共 ${t} 条`, onChange: (p, ps) => { setPage(p); setPageSize(ps); } }} />
      <VoteModal
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onSaved={fetchVotes}
      />
      <Modal title="投票结果" open={resultsVisible} onCancel={() => setResultsVisible(false)} footer={null} width={560} destroyOnClose styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}>
        {results.map((r) => (
          <div key={r.option} style={{ marginBottom: 'var(--spacing-xs)' }}>
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
        destroyOnClose
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        {currentVote && (
          <div>
            {currentVote.description && <Text type="secondary" style={{ display: 'block', marginBottom: 'var(--spacing-card-gap)' }}>{currentVote.description}</Text>}
            {currentVote.allow_multiple ? (
              <Checkbox.Group value={selectedOptions} onChange={setSelectedOptions} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                {currentVote.options.map((opt) => (
                  <Checkbox key={opt} value={opt}>{opt}</Checkbox>
                ))}
              </Checkbox.Group>
            ) : (
              <Radio.Group value={selectedOptions[0]} onChange={(e) => setSelectedOptions([e.target.value])} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                {currentVote.options.map((opt) => (
                  <Radio key={opt} value={opt}>{opt}</Radio>
                ))}
              </Radio.Group>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="权限说明"
        open={permissionVisible}
        width={560}
        footer={null}
        onCancel={() => setPermissionVisible(false)}
      >
        <div className={styles.permissionContent ?? ''}>
          <Title level={5}>创建者权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>创建者拥有投票的完整管理权限，可以编辑投票内容、查看结果和删除投票。</Paragraph>
          <Title level={5}>成员/指定用户权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>可见范围内的成员可以参与投票并查看结果；被指定的用户只能参与被授权给自己的投票。</Paragraph>
          <Title level={5}>可见范围</Title>
          <ul className={styles.permissionList ?? ''}>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                公开：所有成员都可以查看并参与该投票
              </Text>
            </li>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                私有：仅创建者和被授权成员可以查看
              </Text>
            </li>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                指定用户：仅被指定的用户可以看到并参与该投票
              </Text>
            </li>
          </ul>
          <Title level={5}>管理员</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>系统管理员可以查看和管理所有投票。</Paragraph>
          <Title level={5}>创建权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>所有成员都可以创建投票，创建时需设定可见范围。</Paragraph>
        </div>
      </Modal>
    </div>
  );
}
