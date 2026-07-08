import { useState, useEffect } from 'react';
import { Modal, Typography, Checkbox, Radio, Button, message, Empty } from 'antd';
import { listNotifications } from '../api/notifications';
import { listVotes, submitVote } from '../api/votes';
import type { Vote } from '../types/vote';

const { Text, Title } = Typography;

export default function VotePopup() {
  const [visible, setVisible] = useState(false);
  const [pendingVotes, setPendingVotes] = useState<Vote[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const checkPendingVotes = async () => {
      try {
        const notifRes = await listNotifications({ page: 1, page_size: 50, unread_only: true });
        if (notifRes.code !== 0) return;

        const voteNotifs = notifRes.data.items.filter((n) => n.message.includes('投票'));
        if (voteNotifs.length === 0) return;

        const votesRes = await listVotes({ page: 1, page_size: 50 });
        if (votesRes.code !== 0) return;

        const activeVotes = votesRes.data.items.filter((v) => v.status === 'active');
        if (activeVotes.length > 0) {
          setPendingVotes(activeVotes);
          setVisible(true);
        }
      } catch (e) { console.warn('Failed to check pending votes:', e); }
    };

    const timer = setTimeout(checkPendingVotes, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmitVote = async () => {
    const currentVote = pendingVotes[currentIndex];
    if (!currentVote || selectedOptions.length === 0) {
      message.warning('请至少选择一个选项');
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitVote(currentVote.id, selectedOptions);
      if (res.code === 0) {
        message.success('投票成功');
        if (currentIndex < pendingVotes.length - 1) {
          setCurrentIndex(currentIndex + 1);
          setSelectedOptions([]);
        } else {
          setVisible(false);
        }
      } else {
        message.error(res.msg || '投票失败');
      }
    } catch {
      message.error('投票失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (currentIndex < pendingVotes.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOptions([]);
    } else {
      setVisible(false);
    }
  };

  const currentVote = pendingVotes[currentIndex];

  return (
    <Modal
      title={`待参与投票 (${currentIndex + 1}/${pendingVotes.length})`}
      open={visible}
      onCancel={() => setVisible(false)}
      footer={null}
      width={420}
      maskClosable={false}
    >
      {currentVote && (
        <div>
          <Title level={5} style={{ marginBottom: 'var(--spacing-xs)' }}>{currentVote.title}</Title>
          {currentVote.description && <Text type="secondary" style={{ display: 'block', marginBottom: 'var(--spacing-card-gap)' }}>{currentVote.description}</Text>}
          {currentVote.allow_multiple ? (
            <Checkbox.Group value={selectedOptions} onChange={setSelectedOptions} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-card-gap)' }}>
              {currentVote.options.map((opt) => (
                <Checkbox key={opt} value={opt}>{opt}</Checkbox>
              ))}
            </Checkbox.Group>
          ) : (
            <Radio.Group value={selectedOptions[0]} onChange={(e) => setSelectedOptions([e.target.value])} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-card-gap)' }}>
              {currentVote.options.map((opt) => (
                <Radio key={opt} value={opt}>{opt}</Radio>
              ))}
            </Radio.Group>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-xs)' }}>
            <Button onClick={handleSkip}>跳过</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmitVote}>提交投票</Button>
          </div>
        </div>
      )}
      {pendingVotes.length === 0 && <Empty description="暂无待参与的投票" />}
    </Modal>
  );
}
