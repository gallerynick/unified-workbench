import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined, CheckCircleOutlined, DownloadOutlined, LoadingOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Button, Tag, Space, message, Spin, Typography, Empty } from 'antd';
import { getMeetingRecord, startMeeting, pauseMeeting, resumeMeeting, endMeeting, updateMeetingRecord } from '../../api/meeting-records';
import type { MeetingRecord, MeetingTranscriptSegment, TranscriptSegmentData} from '../../types/meeting-record';
import { getVisibilityConfig } from '../../utils/visibility';
import { useMeetingWebSocket } from '../../hooks/useMeetingWebSocket';
import styles from './MeetingRoom.module.css';

const { Title, Text, Paragraph } = Typography;

/** 转录条目：可能来自后端分页读取，也可能来自 WebSocket 实时推送 */
type TranscriptItem = MeetingTranscriptSegment | TranscriptSegmentData;

export default function MeetingRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<MeetingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [noteContent, setNoteContent] = useState<string>('');
  const [charCount, setCharCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [activeTab, setActiveTab] = useState<string>('notes');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const [noteSaveState, setNoteSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [noteSavedAt, setNoteSavedAt] = useState('');
  const noteBaseline = useRef('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const lastTranscriptSeq = useRef(0);

  // 会议状态
  const isRecording = meeting?.status === 'recording';
  const isPaused = meeting?.status === 'paused';
  
  // 会议状态决定是否连接 WebSocket（仅录音/暂停状态）
  const shouldConnect = isRecording || isPaused;

  // WebSocket 连接
  const { 
    connected: wsConnected, 
    segments: wsSegments,
    durationSeconds: wsDuration,

    error: wsError,
    sendMessage,
  } = useMeetingWebSocket(id, shouldConnect);

  const fetchMeeting = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getMeetingRecord(id);
      if (res.code === 0 && res.data) {
        setMeeting(res.data);
        setTranscript(res.data.segments || []);
        // 笔记编辑区只承载用户手记（meeting_record.notes）。
        // AI 纪要存在独立的 meeting_minutes 表，不能塞进 notes 再写回去。
        const notesText = res.data.notes ?? '';
        setNoteContent(notesText);
        setCharCount(notesText.length);
        noteBaseline.current = notesText;
        setNoteSaveState('idle');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeeting();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      // 组件卸载时停止音频采集，避免后台占用麦克风
      stopAudioCapture();
    };
  }, [id]);

  // 当 WebSocket 连接建立时启动音频采集
  useEffect(() => {
    if (wsConnected && isRecording) {
      startAudioCapture();
    }
    return () => {
      // 组件卸载时停止音频采集
    };
  }, [wsConnected, isRecording]);

  // 会议结束后轮询纪要生成状态（处理中→完成）
  useEffect(() => {
    if (meeting?.status !== 'processing' && meeting?.status !== 'completed') return;
    if (meeting?.minutes_status === 'done') return;
    const interval = setInterval(async () => {
      if (!id) return;
      const res = await getMeetingRecord(id);
      if (res.code === 0 && res.data) {
        setMeeting(res.data);
        if (res.data.minutes_status === 'done') {
          clearInterval(interval);
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [id, meeting?.status, meeting?.minutes_status]);



  // 当 WebSocket 收到新的转录片段时更新
  useEffect(() => {
    if (wsSegments.length > 0 && wsSegments.length > lastTranscriptSeq.current) {
      setTranscript(prev => {
        const newSegments = wsSegments.slice(lastTranscriptSeq.current);
        lastTranscriptSeq.current = wsSegments.length;
        return [...prev, ...newSegments];
      });
    }
  }, [wsSegments]);

  // 当 WebSocket 状态更新时更新时间
  useEffect(() => {
    if (wsDuration > 0) {
      setElapsedTime(wsDuration);
    }
  }, [wsDuration]);

  // 当会议状态变为录音时启动计时器
  useEffect(() => {
    if (meeting?.status === 'recording') {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [meeting?.status]);

  // 格式化时间 mm:ss
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 格式化时间戳（从毫秒转换为 mm:ss）
  const formatTimestamp = (ms: number | null) => {
    if (!ms || ms <= 0) return '00:00';
    return formatTime(Math.floor(ms / 1000));
  };

  // 自动保存笔记：停止输入 2 秒后 PATCH 到后端
  const handleNoteChange = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const newContent = e.currentTarget.value;
    setNoteContent(newContent);
    setCharCount(newContent.length);
    if (newContent === noteBaseline.current) {
      return;
    }
    setNoteSaveState('idle');
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      if (!id || newContent === noteBaseline.current) return;
      setNoteSaveState('saving');
      try {
        const res = await updateMeetingRecord(id, { notes: newContent });
        if (res.code === 0) {
          noteBaseline.current = newContent;
          setNoteSaveState('saved');
          setNoteSavedAt(new Date().toLocaleTimeString());
        } else {
          setNoteSaveState('failed');
        }
      } catch {
        setNoteSaveState('failed');
      }
    }, 2000);
  };

  // 开始录音 - 启动麦克风采集
  const startAudioCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      audioSourceRef.current = source;

      // 使用 ScriptProcessorNode 获取音频数据
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      audioProcessorRef.current = processor;

      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        const inputBuffer = e.inputBuffer;
        if (!inputBuffer) return;
        const channelData = inputBuffer.getChannelData(0);
        if (!channelData) return;

        // 转换为 16bit PCM
        const pcmData = new Int16Array(channelData.length);
        for (let i = 0; i < channelData.length; i++) {
          const sample = channelData[i] ?? 0;
          pcmData[i] = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
        }

        // 计算音量级别
        let sum = 0;
        for (let i = 0; i < channelData.length; i++) {
          const sample = channelData[i] ?? 0;
          sum += sample * sample;
        }
        const rms = Math.sqrt(sum / channelData.length);
        setAudioLevel(rms);

        // 发送到 WebSocket
        if (wsConnected) {
          const bytes = new Uint8Array(pcmData.buffer);
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode(...chunk);
          }
          const base64 = btoa(binary);

          sendMessage({
            type: 'audio_chunk',
            data: {
              audio: base64,
              sample_rate: 16000,
              channels: 1,
              duration: channelData.length / 16000,
            }
          });
        }
      };
    } catch (err) {
      console.error('Failed to start audio capture:', err);
      message.error('无法访问麦克风，请检查权限设置');
    }
  };

  // 停止录音
  const stopAudioCapture = () => {
    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect();
      audioProcessorRef.current = null;
    }
    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setAudioLevel(0);
  };

  const handleStart = async () => {
    if (!id || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await startMeeting(id);
      if (res.code === 0) {
        message.success('会议已开始');
        setElapsedTime(0);
        fetchMeeting();
        // WebSocket 连接后自动启动音频采集（由 wsConnected 状态驱动）
      } else {
        message.error(res.msg || '开始会议失败');
      }
    } catch (err) {
      console.error('Start meeting error:', err);
      message.error('网络错误，请稍后重试');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (!id || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await pauseMeeting(id);
      if (res.code === 0) {
        message.success('会议已暂停');
        stopAudioCapture();
        // 通知后端暂停音频写入
        sendMessage({ type: 'pause' });
        fetchMeeting();
      } else {
        message.error(res.msg || '暂停会议失败');
      }
    } catch {
      message.error('网络错误，请稍后重试');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!id || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await resumeMeeting(id);
      if (res.code === 0) {
        message.success('会议已恢复');
        fetchMeeting();
        // 通知后端恢复音频写入
        sendMessage({ type: 'resume' });
      } else {
        message.error(res.msg || '恢复会议失败');
      }
    } catch {
      message.error('网络错误，请稍后重试');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnd = async () => {
    if (!id || actionLoading) return;
    setActionLoading(true);
    try {
      stopAudioCapture();
      // 通知后端结束音频
      sendMessage({ type: 'end' });
      const res = await endMeeting(id);
      if (res.code === 0) {
        message.success('会议已结束，正在处理中...');
        fetchMeeting();
      } else {
        message.error(res.msg || '结束会议失败');
      }
    } catch {
      message.error('网络错误，请稍后重试');
    } finally {
      setActionLoading(false);
    }
  };

  if (!meeting) {
    return (
      <div style={{ padding: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        {loading ? <Spin size="large" /> : <Empty description="会议不存在或已删除" />}
      </div>
    );
  }

  const visibilityCfg = getVisibilityConfig(meeting.visibility);

  return (
    <div className={styles.container}>
      {/* 顶部栏 */}
      <div className={styles.header}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/meetings')}>
            返回
          </Button>
          <Title level={4} style={{ margin: 0, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {meeting.title}
          </Title>
          <Tag color={visibilityCfg.color}>
            {visibilityCfg.text}
          </Tag>
        </Space>
        <Space>
          {/* 结束会议按钮 */}
          {(isRecording || isPaused) && (
            <Button danger onClick={handleEnd}>
              结束会议
            </Button>
          )}
          
          {/* 下载音频 */}
          {meeting.status === 'completed' && meeting.audio_file_path && (
            <Button icon={<DownloadOutlined />} onClick={() => window.open('/api/v1/meetings/' + id + '/audio', '_blank')}>
              下载音频
            </Button>
          )}
        </Space>
      </div>



      {/* 主内容区 */}
      <div className={styles.mainContent}>
        {/* 左侧：转录 */}
        <div className={styles.transcriptPanel}>
          <div className={styles.panelHeader}>
            <Text strong>实时转录</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {wsError && (isRecording || isPaused) && (
                <Tag color="red" style={{ fontSize: 11, margin: 0 }}>
                  {wsError}
                </Tag>
              )}
              {isRecording && (
                <span className={styles.recordingIndicator}>
                  <span className={styles.recordingDot} />
                  {wsConnected ? '识别中' : '连接中...'}
                </span>
              )}
              {isPaused && (
                <Tag color="orange" style={{ margin: 0 }}>已暂停</Tag>
              )}
            </div>
          </div>
          <div className={styles.transcriptList}>
            {transcript.length === 0 ? (
              <Empty description="暂无转录内容" style={{ padding: '40px 0' }} />
            ) : (
              transcript.map((seg, idx) => {
                const itemKey = 'id' in seg ? seg.id : `ws-${idx}`;
                const speaker = 'speaker' in seg ? seg.speaker : null;
                return (
                <div key={itemKey} className={styles.transcriptItem}>
                  <div className={styles.transcriptMeta}>
                    <span className={styles.timestamp}>
                      [{formatTimestamp(seg.audio_start_ms)}]
                    </span>
                    <Text strong>{speaker || '发言人'}</Text>
                  </div>
                  <Paragraph style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
                    {seg.text}
                  </Paragraph>
                </div>
                );
              })
            )}
          </div>
          
          {/* 底部控制栏 */}
          <div className={styles.controlBar}>
            <div className={styles.audioMeter}>
              <div className={styles.meterBars}>
                {[...Array(10)].map((_, i) => {
                  // 根据音频电平和索引计算每个条的高度，创建视觉波动效果
                  const baseHeight = Math.max(10, audioLevel * 100);
                  const variation = Math.sin(Date.now() / 100 + i) * 20;
                  const height = isRecording ? Math.max(10, Math.min(100, baseHeight + variation)) : 10;
                  return (
                    <div
                      key={i}
                      className={`${styles.meterBar} ${isRecording ? 'active' : ''}`}
                      style={{ height: `${height}%` }}
                    />
                  );
                })}
              </div>
            </div>
            
            {/* 录音控制按钮 - 始终显示，绝对居中 */}
            <div className={styles.recordButtonWrapper}>
              <button
                className={`${styles.recordButton} ${isRecording ? styles.recordButtonActive : isPaused ? styles.recordButtonPaused : ''}`}
                onClick={isRecording ? handlePause : isPaused ? handleResume : handleStart}
                title={isRecording ? '暂停' : isPaused ? '恢复' : '开始'}
                disabled={actionLoading}
              >
                {isRecording ? (
                  <div className={styles.pauseIcon}>
                    <div className={styles.pauseBar} />
                    <div className={styles.pauseBar} />
                  </div>
                ) : isPaused ? (
                  <div className={styles.playIcon} />
                ) : (
                  <div className={styles.recordDot} />
                )}
              </button>
            </div>
            
            {/* 右侧时间显示 */}
            <div className={styles.controlBarTime}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {formatTime(elapsedTime)}
              </Text>
            </div>
          </div>
        </div>

        {/* 右侧：笔记面板（带标签页） */}
        <div className={styles.notesPanel}>
          <div className={styles.panelHeader}>
            <div className={styles.tabRow}>
              {[
                { key: 'notes', label: '笔记' },
                { key: 'summary', label: '总结' },
                { key: 'highlights', label: '重点摘要' },
                { key: 'todos', label: '待办事项' },
                { key: 'recording', label: '录音' },
              ].map((t) => (
                <Button
                  key={t.key}
                  size="small"
                  type={activeTab === t.key ? 'primary' : 'text'}
                  onClick={() => setActiveTab(t.key)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
          {activeTab === 'notes' && (
            <>
              <div className={styles.toolbar}>
                <Button size='small' type='text'><Text strong>B</Text></Button>
                <Button size='small' type='text'><Text italic>I</Text></Button>
                <Button size='small' type='text'><Text underline>U</Text></Button>
                <Button size='small' type='text'>H1</Button>
                <Button size='small' type='text'>H2</Button>
              </div>
              <textarea
                className={styles.editor}
                value={noteContent}
                onChange={handleNoteChange}
                placeholder='开始记录你的笔记...'
                style={{ outline: 'none', resize: 'none' }}
              />
              <div className={styles.editorFooter}>
                <Text type='secondary' style={{ fontSize: 12 }}>
                  {noteSaveState === 'saving' && (
                    <span><LoadingOutlined style={{ marginRight: 4 }} />保存中</span>
                  )}
                  {noteSaveState === 'saved' && (
                    <span>
                      <CheckCircleOutlined style={{ marginRight: 4, color: 'var(--color-success)' }} />
                      已保存 {noteSavedAt}
                    </span>
                  )}
                  {noteSaveState === 'failed' && '自动保存失败，继续编辑后重试'}
                  {noteSaveState === 'idle' && (noteContent ? '自动保存' : '未开始记录')}
                </Text>
                <Text type='secondary' style={{ fontSize: 12 }}>
                  字数 {charCount}
                </Text>
              </div>
            </>
          )}
          {activeTab === 'summary' && (
            <div className={styles.editor} style={{ padding: 16, overflowY: 'auto' }}>
              {meeting?.minutes?.summary ? (
                <Paragraph style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
                  {meeting.minutes.summary}
                </Paragraph>
              ) : (
                <Empty description='会议结束后将自动生成总结' image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          )}
          {activeTab === 'highlights' && (
            <div className={styles.editor} style={{ padding: 16, overflowY: 'auto' }}>
              {meeting?.minutes?.key_points && meeting.minutes.key_points.length > 0 ? (
                <ul style={{ paddingLeft: 20, lineHeight: '2' }}>
                  {meeting.minutes.key_points.map((point, i) => (
                    <li key={i} style={{ marginBottom: 8 }}>
                      <Text>{point}</Text>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty description='会议结束后将自动生成重点摘要' image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          )}
          {activeTab === 'todos' && (
            <div className={styles.editor} style={{ padding: 16, overflowY: 'auto' }}>
              {meeting?.minutes?.todos && meeting.minutes.todos.length > 0 ? (
                <ul style={{ paddingLeft: 20, lineHeight: '2' }}>
                  {meeting.minutes.todos.map((todo, i) => (
                    <li key={i} style={{ marginBottom: 8 }}>
                      <Text>{todo.content}</Text>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty description='会议结束后将自动生成待办事项' image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          )}
          {activeTab === 'recording' && (
            <div className={styles.editor} style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <PlayCircleOutlined style={{ fontSize: 48, color: 'var(--color-info)' }} />
              {meeting?.audio_file_path ? (
                <>
                  <Text style={{ fontSize: 14 }}>录音文件已保存</Text>
                  <Button
                    type='primary'
                    icon={<DownloadOutlined />}
                    onClick={() => {
                      if (meeting?.audio_file_path) {
                        window.open('/' + meeting.audio_file_path, '_blank');
                      }
                    }}
                  >
                    下载录音
                  </Button>
                </>
              ) : (
                <Text type='secondary'>暂无录音文件</Text>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 底部状态栏 */}
      <div className={styles.statusBar}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          时长 {formatTime(elapsedTime)}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          WebSocket: {wsConnected ? '已连接' : (isRecording || isPaused) ? '未连接' : '未启动'}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {transcript.length} 条
        </Text>
      </div>
    </div>
  );
}