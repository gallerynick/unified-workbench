import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Play, Pause, Stop, Download, 
  CheckCircle, AlertCircle, Loader2
} from 'lucide-react';
import { Button, Card, Tag, Space, Steps, message } from 'antd';
import { getMeetingRecord, startMeeting, pauseMeeting, resumeMeeting, endMeeting } from '../../api/meeting-records';
import type { MeetingRecord, MeetingTranscriptSegment } from '../../types/meeting-record';
import { UnifiedResponse } from '../../types/user';

export default function MeetingRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<MeetingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [transcript, setTranscript] = useState<MeetingTranscriptSegment[]>([]);

  const fetchMeeting = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res: UnifiedResponse<any> = await getMeetingRecord(id);
      if (res.code === 0 && res.data) {
        setMeeting(res.data);
        setTranscript(res.data.segments || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeeting();
  }, [id]);

  const handleStart = async () => {
    if (!id) return;
    const res: UnifiedResponse<any> = await startMeeting(id);
    if (res.code === 0) {
      message.success('会议已开始');
      fetchMeeting();
    }
  };

  const handlePause = async () => {
    if (!id) return;
    const res: UnifiedResponse<any> = await pauseMeeting(id);
    if (res.code === 0) {
      message.success('会议已暂停');
      fetchMeeting();
    }
  };

  const handleResume = async () => {
    if (!id) return;
    const res: UnifiedResponse<any> = await resumeMeeting(id);
    if (res.code === 0) {
      message.success('会议已恢复');
      fetchMeeting();
    }
  };

  const handleEnd = async () => {
    if (!id) return;
    const res: UnifiedResponse<any> = await endMeeting(id);
    if (res.code === 0) {
      message.success('会议已结束，正在处理中...');
      fetchMeeting();
    }
  };

  if (loading || !meeting) {
    return (
      <div className="p-6 flex justify-center items-center h-full">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  const steps = [
    { title: '录制', description: '实时转录' },
    { title: '处理', description: '说话人分离 + AI 纪要' },
    { title: '完成', description: '可导出' },
  ];

  const currentStep = meeting.status === 'completed' ? 2 : 
                     meeting.status === 'processing' ? 1 : 0;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <Space>
          <Button icon={<ArrowLeft />} onClick={() => navigate('/meetings')}>
            返回
          </Button>
          <h1 className="text-2xl font-bold">{meeting.title}</h1>
        </Space>
        <Tag>{meeting.number}</Tag>
      </div>

      <Card className="mb-4">
        <Steps current={currentStep} items={steps} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="控制">
          <Space vertical>
            {meeting.status === 'not_started' && (
              <Button type="primary" icon={<Play />} onClick={handleStart} size="large" block>
                开始转录
              </Button>
            )}
            {meeting.status === 'recording' && (
              <Space>
                <Button icon={<Pause />} onClick={handlePause} size="large">
                  暂停
                </Button>
                <Button danger icon=<Stop />} onClick={handleEnd} size="large">
                  结束会议
                </Button>
              </Space>
            )}
            {meeting.status === 'paused' && (
              <Space>
                <Button type="primary" icon={<Play />} onClick={handleResume} size="large">
                  恢复
                </Button>
                <Button danger icon=<Stop />} onClick={handleEnd} size="large">
                  结束会议
                </Button>
              </Space>
            )}
            {meeting.status === 'processing' && (
              <div className="flex items-center gap-2">
                <Loader2 className="animate-spin" size={20} />
                <span>正在处理中，请稍候...</span>
              </div>
            )}
            {meeting.status === 'completed' && (
              <Space>
                <Button icon=<Download />} size="large">导出转录</Button>
                <Button icon=<Download />} size="large">导出纪要</Button>
              </Space>
            )}
          </Space>
        </Card>

        <Card title="信息">
          <div className="space-y-2">
            <div>状态: <Tag>{meeting.status}</Tag></div>
            <div>时长: {Math.floor(meeting.duration_seconds / 60)}分{meeting.duration_seconds % 60}秒</div>
            <div>转录句子: {transcript.length}</div>
            {meeting.diarization_status === 'done' && (
              <div className="text-green-600">✓ 说话人分离完成</div>
            )}
            {meeting.minutes_status === 'done' && (
              <div className="text-green-600">✓ 纪要生成完成</div>
            )}
          </div>
        </Card>
      </div>

      <Card title="转录内容" className="mt-4">
        {transcript.length === 0 ? (
          <p className="text-gray-500">暂无转录内容</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {transcript.map((seg) => (
              <div key={seg.id} className="mb-2 p-2 bg-gray-50 rounded">
                <span className="text-gray-500 text-sm mr-2">[{seg.speaker || '说话人'}]</span>
                <span>{seg.text}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
