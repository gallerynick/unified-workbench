import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Video, Clock, CheckCircle, PlayCircle, PauseCircle } from 'lucide-react';
import { Button, Card, Input, Modal, Form, Select, Space, Tag, Empty } from 'antd';
import { listMeetingRecords, createMeetingRecord } from '../../api/meeting-records';
import type { MeetingRecord, MeetingStatus } from '../../types/meeting-record';
import { UnifiedResponse } from '../../types/user';

const statusMap: Record<MeetingStatus, { label: string; color: string; icon: any }> = {
  not_started: { label: '未开始', color: 'default', icon: Clock },
  recording: { label: '转录中', color: 'processing', icon: PlayCircle },
  paused: { label: '已暂停', color: 'warning', icon: PauseCircle },
  processing: { label: '处理中', color: 'blue', icon: Video },
  completed: { label: '已完成', color: 'success', icon: CheckCircle },
};

export default function MeetingList() {
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();
  const navigate = useNavigate();

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const res: UnifiedResponse<any> = await listMeetingRecords({ page: 1, page_size: 100 });
      if (res.code === 0 && res.data) {
        setMeetings(res.data.items || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      const res: UnifiedResponse<any> = await createMeetingRecord(values);
      if (res.code === 0) {
        message.success('会议已创建');
        setCreateModalOpen(false);
        createForm.resetFields();
        fetchMeetings();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleViewMeeting = (id: string) => {
    navigate('/meetings/' + id);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">会议记录</h1>
        <Button type="primary" icon={<Plus />} onClick={() => setCreateModalOpen(true)}>
          新建会议
        </Button>
      </div>

      {meetings.length === 0 ? (
        <Empty description="暂无会议" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {meetings.map((meeting) => {
            const statusInfo = statusMap[meeting.status];
            const StatusIcon = statusInfo.icon;
            return (
              <Card
                key={meeting.id}
                hoverable
                onClick={() => handleViewMeeting(meeting.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-sm text-gray-500">{meeting.number}</span>
                  <Tag color={statusInfo.color}>
                    <StatusIcon size={14} className="mr-1" />
                    {statusInfo.label}
                  </Tag>
                </div>
                <h3 className="text-lg font-semibold mb-2 truncate">{meeting.title}</h3>
                <div className="text-sm text-gray-500">
                  <span>时长: {Math.floor(meeting.duration_seconds / 60)}分{meeting.duration_seconds % 60}秒</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        title="新建会议"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => setCreateModalOpen(false)}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="title"
            label="会议标题"
            rules={[{ required: true, message: '请输入会议标题' }]}
          >
            <Input placeholder="请输入会议标题" />
          </Form.Item>
          <Form.Item
            name="visibility"
            label="可见性"
            initialValue="private"
          >
            <Select>
              <Select.Option value="private">私有</Select.Option>
              <Select.Option value="public">公开</Select.Option>
              <Select.Option value="restricted">受限</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
