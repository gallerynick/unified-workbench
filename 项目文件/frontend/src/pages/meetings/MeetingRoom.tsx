import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined, CheckCircleOutlined, DownloadOutlined, LoadingOutlined } from '@ant-design/icons';
import { Button, Tag, Space, message, Spin, Typography, Empty, Tabs, Input } from 'antd';
import { getMeetingRecord, startMeeting, pauseMeeting, resumeMeeting, endMeeting, updateMeetingRecord, autosaveMeetingRecord, generateMinutes, updateSpeakerNames } from '../../api/meeting-records';
import type { MeetingRecord, MeetingTranscriptSegment, TranscriptSegmentData} from '../../types/meeting-record';
import { getVisibilityConfig } from '../../utils/visibility';
import { getToken } from '../../utils/auth';
import { useMeetingWebSocket } from '../../hooks/useMeetingWebSocket';
import './MeetingList';
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
  // 讲话人改名输入（key=原说话人标签，value=新名字）
  const [speakerEdits, setSpeakerEdits] = useState<Record<string, string>>({});
  const [speakerSaving, setSpeakerSaving] = useState(false);
  const [noteContent, setNoteContent] = useState<string>('');
  // 与 noteContent 同步的 ref：自动保存/卸载兜底必须读 ref，
  // 不能读闭包里的 state（setTimeout 回调会捕获输入前的旧值，导致笔记丢失）
  const noteContentRef = useRef('');
  const [charCount, setCharCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [activeTab, setActiveTab] = useState<string>('notes');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const [noteSaveState, setNoteSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [noteSavedAt, setNoteSavedAt] = useState('');
  const noteBaseline = useRef('');
  // 笔记富文本编辑器元素（contentEditable）
  const noteEditorRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  // 会议录音侧降噪链（仅会议记录使用，不改全局 ASR）：
  // 高通滤波 + 动态压缩，抑制键盘敲击/桌面震动等瞬态噪声
  const noiseHighpassRef = useRef<BiquadFilterNode | null>(null);
  const noiseCompressorRef = useRef<DynamicsCompressorNode | null>(null);
  const lastTranscriptSeq = useRef(0);
  const autosaveTimer = useRef<NodeJS.Timeout | null>(null);
  const autosaveInFlight = useRef(false);
  // 纪要完成/失败提醒去重：轮询期间只提示一次，避免每个 5s 间隔重复弹窗
  const minutesNotified = useRef(false);

  // 会议状态
  const isRecording = meeting?.status === 'recording';
  const isPaused = meeting?.status === 'paused';
  const isCompleted = meeting?.status === 'completed';
  const isProcessing = meeting?.status === 'processing';

  // 会议状态决定是否连接 WebSocket（仅录音/暂停状态）
  const shouldConnect = isRecording || isPaused;
  const isNonStartable = !isRecording && !isPaused && meeting?.status !== 'not_started';

  // WebSocket 连接
  const { 
    connected: wsConnected, 
    segments: wsSegments,
    durationSeconds: wsDuration,
    error: wsError,
    warningMessage: wsWarningMessage,
    sendMessage,
  } = useMeetingWebSocket(id, shouldConnect);

  const fetchMeeting = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getMeetingRecord(id);
      if (res.code === 0 && res.data) {
        setMeeting(res.data);
        const serverSegments = res.data.segments || [];
        // 会议结束（处理中/完成）后转录以服务端落库为准：实时 WS 片段已失效，
        // 直接替换避免「同一句被实时片段与服务端片段各保留一份」的重复串扰。
        if (res.data.status === 'processing' || res.data.status === 'completed') {
          setTranscript(serverSegments);
        } else {
          setTranscript((prev) => mergeServerSegments(prev, serverSegments));
        }
        // 笔记编辑区只承载用户手记（meeting_record.notes）。
        // AI 纪要存在独立的 meeting_minutes 表，不能塞进 notes 再写回去。
        const notesText = res.data.notes ?? '';
        setNoteContent(notesText);
        setCharCount(notesText.length);
        noteBaseline.current = notesText;
        setNoteSaveState('idle');
        // contentEditable 编辑器在首次加载时填充已保存笔记；
        // 仅当编辑器为空时写入，避免覆盖用户正在编辑的内容
        if (noteEditorRef.current && !noteEditorRef.current.innerText.trim()) {
          noteEditorRef.current.innerText = notesText;
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const flushAutosave = async (opts: { force?: boolean } = {}) => {
    if (!id || autosaveInFlight.current) return;
    autosaveInFlight.current = true;
    try {
      const segments = transcript.map((seg, idx) => {
        if ('seq' in seg) {
          return {
            seq: seg.seq,
            text: seg.text,
            audio_start_ms: seg.audio_start_ms,
            audio_end_ms: seg.audio_end_ms,
            speaker: seg.speaker ?? null,
          };
        }
        const data = seg as TranscriptSegmentData;
        return {
          seq: typeof data.seq === 'number' ? data.seq : idx + 1,
          text: data.text,
          audio_start_ms: data.audio_start_ms,
          audio_end_ms: data.audio_end_ms,
          speaker: null,
        };
      });
      const currentNotes = noteContentRef.current;
      if (!opts.force && currentNotes === noteBaseline.current && segments.length === 0) {
        return;
      }
      const res = await autosaveMeetingRecord(id, {
        notes: currentNotes,
        transcript_segments: segments,
      });
      if (res.code === 0) {
        noteBaseline.current = currentNotes;
        setNoteSaveState('saved');
        setNoteSavedAt(new Date().toLocaleTimeString());
        if (res.data) {
          setMeeting((prev) => (prev ? { ...prev, notes: res.data!.notes ?? prev.notes } : prev));
        }
      }
    } catch {
      setNoteSaveState('failed');
    } finally {
      autosaveInFlight.current = false;
    }
  };

  const scheduleAutosave = (delay = 1200) => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null;
      void flushAutosave();
    }, delay);
  };

  // 笔记编辑器首次挂载时填入已保存内容；
  // 之后由用户编辑驱动（contentEditable 不被 React 覆写，保留光标与格式）
  useEffect(() => {
    if (noteEditorRef.current && noteContent) {
      noteEditorRef.current.innerText = noteContent;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchMeeting();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      // 卸载兜底：用 keepalive fetch 保存笔记。
      // 普通 fetch 在页面跳转/刷新时会被浏览器 abort（nginx 表现为 499），
      // keepalive 让请求在页面卸载后仍能送达；对比 state 用 ref 取最新值。
      const finalNotes = noteContentRef.current;
      if (finalNotes !== noteBaseline.current) {
        const token = getToken();
        if (token) {
          try {
            void fetch('/api/v1/meetings/' + id + '/autosave', {
              method: 'POST',
              keepalive: true,
              headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token,
              },
              body: JSON.stringify({
                notes: finalNotes,
                transcript_segments: [],
              }),
            });
          } catch {
            // keepalive 失败时退回到常规 force flush
            void flushAutosave({ force: true });
          }
        } else {
          void flushAutosave({ force: true });
        }
      }
      if (isRecording) {
        notifyPause();
      }
      // 组件卸载时停止音频采集，避免后台占用麦克风
      stopAudioCapture();
    };
  }, [id, isRecording]);

  // 当 WebSocket 连接建立时启动音频采集
  useEffect(() => {
    if (wsConnected && isRecording) {
      startAudioCapture();
    }
    return () => {
      // 组件卸载时停止音频采集
    };
  }, [wsConnected, isRecording]);

  // 会议结束后轮询纪要生成状态（处理中→完成/失败）
  useEffect(() => {
    if (meeting?.status !== 'processing' && meeting?.status !== 'completed') return;
    if (meeting?.minutes_status === 'done' || meeting?.minutes_status === 'failed') return;
    const interval = setInterval(async () => {
      if (!id) return;
      const res = await getMeetingRecord(id);
      if (res.code === 0 && res.data) {
        setMeeting(res.data);
        // 会后转录段会被重写（时间戳/说话人以音频为准），必须同步刷新转录列表
        if (res.data.status === 'processing' || res.data.status === 'completed') {
          setTranscript(res.data.segments || []);
        }
        if (res.data.minutes_status === 'done' || res.data.minutes_status === 'failed') {
          clearInterval(interval);
          if (!minutesNotified.current) {
            minutesNotified.current = true;
            if (res.data.minutes_status === 'done') {
              message.success('纪要生成完成');
            } else {
              message.error('纪要生成失败');
            }
          }
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [id, meeting?.status, meeting?.minutes_status]);



  // 将服务端返回的片段并入现有转录，避免恢复/暂停后清空已有内容
  const mergeServerSegments = (prev: TranscriptItem[], serverSegments: TranscriptItem[]): TranscriptItem[] => {
    if (!serverSegments || serverSegments.length === 0) {
      return prev;
    }

    const stableKey = (item: TranscriptItem): string => {
      const start = String((item as any).audio_start_ms ?? '');
      const end = String((item as any).audio_end_ms ?? '');
      const text = String((item as any).text ?? '');
      if (start !== '' && text) return start + '::' + end + '::' + text;
      const seq = (item as any).seq;
      if (seq !== undefined && seq !== null) return 'seq:' + seq + '::' + text;
      return 'text:' + text;
    };

    const seen = new Set<string>();
    const result: TranscriptItem[] = [];
    for (const item of prev) {
      const key = stableKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
    for (const item of serverSegments) {
      const key = stableKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
    return result;
  };

  // 当 WebSocket 断开时重置片段序号追踪：
  // 重连后后端 segment_count 从 0 重新计数，旧 lastTranscriptSeq 会让新片段永远不被追加
  useEffect(() => {
    if (!wsConnected) {
      lastTranscriptSeq.current = 0;
    }
  }, [wsConnected]);

  // 当 WebSocket 收到新的转录片段时更新
  useEffect(() => {
    if (wsSegments.length > 0 && wsSegments.length > lastTranscriptSeq.current) {
      setTranscript(prev => {
        const newSegments = wsSegments.slice(lastTranscriptSeq.current);
        lastTranscriptSeq.current = wsSegments.length;
        return [...prev, ...newSegments];
      });
      scheduleAutosave(800);
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
  // contentEditable 时提取纯文本保存（保持 notes 字段语义不变，
  // 后端/纪要生成均按纯文本处理，不受影响）
  const handleNoteChange = (e: React.FormEvent<HTMLDivElement>) => {
    const editor = e.currentTarget;
    const newContent = editor.innerText ?? '';
    setNoteContent(newContent);
    noteContentRef.current = newContent;
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
    scheduleAutosave(1500);
  };

  // 笔记工具栏：对 contentEditable 执行真实格式化命令
  const handleNoteFormat = (
    command: 'bold' | 'italic' | 'underline' | 'formatBlock',
    value?: string,
  ) => {
    const editor = noteEditorRef.current;
    if (!editor) return;
    editor.focus();
    try {
      document.execCommand(command, false, value);
      // 格式化后同步内容（execCommand 改变 DOM，触发 onInput 事件）
      const newContent = editor.innerText ?? '';
      setNoteContent(newContent);
      noteContentRef.current = newContent;
      setCharCount(newContent.length);
      if (newContent !== noteBaseline.current) {
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
      }
    } catch {
      // execCommand 失败时静默（旧浏览器降级为纯文本）
    }
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

      // 会议录音侧降噪链（仅会议记录使用，不影响全局 ASR）：
      // 1) 高通滤波：切掉 120Hz 以下低频冲击（敲桌面/键盘震动等瞬态噪声的低频分量），
      //    人声基频通常高于该值，说话内容不受影响；
      // 2) 动态压缩：压制尖锐瞬态尖峰（按键敲击声），人声是持续信号，压缩后损失很小。
      const highpass = audioContext.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 120;
      highpass.Q.value = 0.7;
      noiseHighpassRef.current = highpass;

      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -40;
      compressor.knee.value = 15;
      compressor.ratio.value = 8;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.15;
      noiseCompressorRef.current = compressor;

      // 使用 ScriptProcessorNode 获取音频数据
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      audioProcessorRef.current = processor;

      source.connect(highpass);
      highpass.connect(compressor);
      compressor.connect(processor);
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

  // 发送一次 pause 给后端，确保离开时状态落盘为 paused
  const notifyPause = () => {
    try {
      sendMessage({ type: 'pause' });
    } catch {
      // ignore
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
    if (noiseHighpassRef.current) {
      noiseHighpassRef.current.disconnect();
      noiseHighpassRef.current = null;
    }
    if (noiseCompressorRef.current) {
      noiseCompressorRef.current.disconnect();
      noiseCompressorRef.current = null;
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
    if (meeting) {
      if (meeting.status === 'completed') {
        message.warning('会议已结束，不能再次开始');
        return;
      }
      if (meeting.status === 'recording' || meeting.status === 'paused') {
        message.info('会议进行中');
        return;
      }
      if (meeting.status === 'processing') {
        message.info('会议处理中，请稍后再试');
        return;
      }
    }
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
        // 先通知后端暂停（后端会 flush 语音缓冲中未切句的部分，确保不漏句），
        // 再停止本端采集，避免最后一块已采集音频在暂停消息前被丢弃
        sendMessage({ type: 'pause' });
        stopAudioCapture();
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
      // 先通知后端结束（后端会 flush 语音缓冲，确保最后一句不漏），
      // 再停止本端采集，避免结束瞬间最后一块音频丢失
      sendMessage({ type: 'end' });
      stopAudioCapture();
      const res = await endMeeting(id);
      if (res.code === 0) {
        message.success('会议已结束，正在处理中...');
        minutesNotified.current = false;
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

  // 手动生成 / 重新生成纪要（失败重试入口）
  const handleGenerateMinutes = async () => {
    if (!id || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await generateMinutes(id);
      if (res.code === 0) {
        message.success('已开始生成纪要，请稍候...');
        minutesNotified.current = false;
        fetchMeeting();
      } else {
        message.error(res.msg || '生成纪要失败');
      }
    } catch {
      message.error('网络错误，请稍后重试');
    } finally {
      setActionLoading(false);
    }
  };


  // 统一的纪要/重点/待办面板：生成中 Spin → 失败提示+重试 → 内容 → 兜底
  const renderMinutesPanel = (
    label: string,
    content: React.ReactNode | null,
  ) => {
    if (meeting?.minutes_status === 'pending' && meeting?.status === 'processing') {
      // 会后处理分阶段：区分讲话人 → 转写 → 生成纪要，后端经 processing_stage 驱动
      const stageText =
        meeting?.processing_stage === '正在区分讲话人'
          ? '正在区分讲话人…'
          : meeting?.processing_stage === '正在转写'
            ? '正在转写（按讲话人）…'
            : meeting?.processing_stage === '正在生成纪要'
              ? '正在生成纪要…'
              : label + '生成中，请稍候…';
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin />
          <Paragraph type='secondary' style={{ marginTop: 12 }}>
            {stageText}
          </Paragraph>
        </div>
      );
    }
    if (meeting?.minutes_status === 'failed') {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Paragraph type='danger'>{label + '生成失败'}</Paragraph>
          <Button type='primary' loading={actionLoading} onClick={handleGenerateMinutes}>
            重新生成
          </Button>
        </div>
      );
    }
    if (content) {
      return content;
    }
    // 纪要已生成完成（done）但当前栏没有匹配内容：
    // 说明确实没提取到（如无待办），此时必须明说「未提取到」，而不是
    // 「会议结束后将自动生成」——后者会误导用户以为还没开始生成。
    if (meeting?.minutes_status === 'done') {
      return (
        <Empty description={'会议中未提取到' + label} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      );
    }
    if (meeting?.status === 'paused') {
      return (
        <Empty description={'会议已暂停，结束后将自动生成' + label} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      );
    }
    return (
      <Empty description={'会议结束后将自动生成' + label} image={Empty.PRESENTED_IMAGE_SIMPLE} />
    );
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
          {/* 手动生成纪要（完成后未生成 / 生成失败重试 / 重新生成） */}
          {(meeting.status === 'completed' || meeting.status === 'processing') && (
            <Button
              icon={<LoadingOutlined spin={actionLoading || meeting.status === 'processing'} />}
              loading={actionLoading || meeting.status === 'processing'}
              disabled={meeting.status === 'processing'}
              onClick={handleGenerateMinutes}
            >
              {meeting.status === 'processing'
                ? '生成中'
                : meeting.minutes_status === 'done'
                  ? '重新生成'
                  : '生成纪要'}
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
              {wsWarningMessage && (
                <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>
                  {wsWarningMessage}
                </Tag>
              )}
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
                  // 真实电平驱动：audioLevel 是 onaudioprocess 计算的 RMS（正常说话约 0.01~0.3）。
                  // VU 表阈值按对数分布（0.01 → 0.65），匹配人声动态范围，
                  // 让静音时左 1-2 根微亮、说话时柱子随音量逐级点亮。
                  const rmsLevel = audioLevel;
                  const barThreshold = 0.01 * Math.pow(1.6, i); // 0.01,0.016,0.026,...,0.55
                  const active = rmsLevel >= barThreshold;
                  // 柱高随索引递增形成 VU 表造型；点亮时按电平微调，未点亮保持低矮
                  const baseHeight = 14 + i * 8;
                  const height = isRecording && active
                    ? Math.min(100, baseHeight + rmsLevel * 60)
                    : 12;
                  return (
                    <div
                      key={i}
                      className={`${styles.meterBar} ${isRecording && active ? 'active' : ''}`}
                      style={{ height: `${height}%`, opacity: isRecording ? (active ? 1 : 0.5) : 0.5 }}
                    />
                  );
                })}
              </div>
            </div>
            
            {/* 录音控制按钮 - 始终显示，绝对居中 */}
            <div className={styles.recordButtonWrapper}>
              <button
                className={`${styles.recordButton} ${isRecording ? styles.recordButtonActive : isPaused ? styles.recordButtonPaused : ''} ${isNonStartable ? styles.recordButtonDisabled : ''}`}
                onClick={isRecording ? handlePause : isPaused ? handleResume : handleStart}
                title={isRecording ? '暂停' : isPaused ? '恢复' : isCompleted ? '会议已结束' : isProcessing ? '处理中' : '开始'}
                disabled={actionLoading || isNonStartable}
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
            <Tabs
              size="small"
              items={[
                { key: 'notes', label: '笔记' },
                { key: 'summary', label: '总结' },
                { key: 'highlights', label: '重点摘要' },
                { key: 'todos', label: '待办事项' },
                { key: 'speakers', label: '讲话人管理' },
                { key: 'recording', label: '录音' },
              ]}
              activeKey={activeTab}
              onChange={(key) => setActiveTab(key)}
              style={{ margin: 0, width: '100%', pointerEvents: 'auto' }}
            />
          </div>
          {activeTab === 'notes' && (
            <>
              <div className={styles.toolbar}>
                <Button size='small' type='text' onClick={() => handleNoteFormat('bold')}><Text strong>B</Text></Button>
                <Button size='small' type='text' onClick={() => handleNoteFormat('italic')}><Text italic>I</Text></Button>
                <Button size='small' type='text' onClick={() => handleNoteFormat('underline')}><Text underline>U</Text></Button>
                <Button size='small' type='text' onClick={() => handleNoteFormat('formatBlock', '<h1>')}>H1</Button>
                <Button size='small' type='text' onClick={() => handleNoteFormat('formatBlock', '<h2>')}>H2</Button>
              </div>
              <div
                ref={noteEditorRef}
                className={styles.editor}
                contentEditable
                suppressContentEditableWarning
                onInput={handleNoteChange}
                data-placeholder='开始记录你的笔记...'
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
              {renderMinutesPanel(
                '总结',
                meeting?.minutes?.summary ? (
                  <Paragraph style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
                    {meeting.minutes.summary}
                  </Paragraph>
                ) : null,
              )}
            </div>
          )}
          {activeTab === 'highlights' && (
            <div className={styles.editor} style={{ padding: 16, overflowY: 'auto' }}>
              {renderMinutesPanel(
                '重点摘要',
                meeting?.minutes?.key_points && meeting.minutes.key_points.length > 0 ? (
                  <ul style={{ paddingLeft: 20, lineHeight: '2' }}>
                    {meeting.minutes.key_points.map((point, i) => (
                      <li key={i} style={{ marginBottom: 8 }}>
                        <Text>{point}</Text>
                      </li>
                    ))}
                  </ul>
                ) : null,
              )}
            </div>
          )}
          {activeTab === 'todos' && (
            <div className={styles.editor} style={{ padding: 16, overflowY: 'auto' }}>
              {renderMinutesPanel(
                '待办事项',
                meeting?.minutes?.todos && meeting.minutes.todos.length > 0 ? (
                  <ul style={{ paddingLeft: 20, lineHeight: '2' }}>
                    {meeting.minutes.todos.map((todo, i) => (
                      <li key={i} style={{ marginBottom: 8 }}>
                        <Text>{todo.content}</Text>
                      </li>
                    ))}
                  </ul>
                ) : null,
              )}
            </div>
          )}
          {activeTab === 'speakers' && (
            <div className={styles.editor} style={{ padding: 16, overflowY: 'auto' }}>
              {(() => {
                // 聚合唯一说话人
                const names = Array.from(
                  new Set(transcript.map((s) => (('speaker' in s ? s.speaker : null) || '')).filter(Boolean) as string[]),
                );
                if (names.length === 0) {
                  return <Empty description="暂未识别出说话人（会议结束后自动区分）" style={{ padding: '40px 0' }} />;
                }
                const save = async () => {
                  if (!id) return;
                  setSpeakerSaving(true);
                  try {
                    const mapping: Record<string, string> = {};
                    for (const n of names) {
                      const v = (speakerEdits[n] ?? '').trim();
                      if (v && v !== n) mapping[n] = v;
                    }
                    if (Object.keys(mapping).length > 0) {
                      await updateSpeakerNames(id, mapping);
                      message.success('说话人名称已更新');
                      setSpeakerEdits({});
                      await fetchMeeting();
                    } else {
                      message.info('没有需要更新的名称');
                    }
                  } catch (e) {
                    message.error('保存失败：' + (e instanceof Error ? e.message : '未知错误'));
                  } finally {
                    setSpeakerSaving(false);
                  }
                };
                return (
                  <div>
                    <Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 12 }}>
                      把系统识别的「说话人N」改成真实姓名；改完点「保存名称」，再点「重新生成纪要」，纪要会用新名字。
                    </Paragraph>
                    {names.map((n) => (
                      <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Tag color="blue" style={{ minWidth: 70, textAlign: 'center' }}>{n}</Tag>
                        <Input
                          size="small"
                          value={speakerEdits[n] ?? n}
                          placeholder="新名字"
                          onChange={(e) => setSpeakerEdits((prev) => ({ ...prev, [n]: e.target.value }))}
                          style={{ flex: 1 }}
                        />
                      </div>
                    ))}
                    <Space style={{ marginTop: 12 }}>
                      <Button size="small" type="primary" loading={speakerSaving} onClick={save}>
                        保存名称
                      </Button>
                      <Button size="small" onClick={async () => {
                        if (!id) return;
                        try {
                          await generateMinutes(id);
                          message.success('已重新生成纪要');
                          await fetchMeeting();
                        } catch {
                          message.error('重新生成失败');
                        }
                      }}>重新生成纪要</Button>
                    </Space>
                  </div>
                );
              })()}
            </div>
          )}
          {activeTab === 'recording' && (
            <div className={styles.editor} style={{ padding: 16, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: 520, background: 'var(--canvas)', border: '1px solid var(--border-secondary)', borderRadius: 12, padding: 16, boxShadow: 'var(--shadow-sm)' }}>
                {meeting?.audio_file_path ? (
                  <audio
                    controls
                    style={{ width: '100%' }}
                    src={'/api/v1/meetings/' + id + '/audio?token=' + encodeURIComponent(getToken() ?? '')}
                  />
                ) : (
                  <Text type='secondary' style={{ fontSize: 13 }}>暂无录音文件</Text>
                )}
              </div>
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