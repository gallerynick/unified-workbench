import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Tag,
  Space,
  message,
  Spin,
  Typography,
  Empty,
  Tabs,
  Input,
  InputNumber,
  Modal,
  Select,
} from 'antd';
import {
  getMeetingRecord,
  startMeeting,
  pauseMeeting,
  resumeMeeting,
  endMeeting,
  autosaveMeetingRecord,
  deleteMeetingRecord,
  generateMinutes,
  updateSpeakerNames,
  rediarizeSpeakers,
  setSegmentSpeaker,
  exportMeeting,
  getSpeakerModelStatus,
  downloadSpeakerModel,
} from '../../api/meeting-records';
import type { SpeakerModelStatus } from '../../api/meeting-records';
import type {
  MeetingRecord,
  MeetingTranscriptSegment,
  TranscriptSegmentData,
} from '../../types/meeting-record';
import { getVisibilityConfig } from '../../utils/visibility';
import { getToken } from '../../utils/auth';
import { useMeetingWebSocket } from '../../hooks/useMeetingWebSocket';
import { pauseIdleTimer, resumeIdleTimer } from '../../hooks/useIdleTimer';
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
  // 重新区分说话人：自动聚类不可靠，允许用户指定真实人数强制 N 簇
  const [speakerCount, setSpeakerCount] = useState<number | null>(null);
  const [rediarizing, setRediarizing] = useState(false);
  const [noteContent, setNoteContent] = useState<string>('');
  // 与 noteContent 同步的 ref：自动保存/卸载兜底必须读 ref，
  // 不能读闭包里的 state（setTimeout 回调会捕获输入前的旧值，导致笔记丢失）
  const noteContentRef = useRef('');
  const [charCount, setCharCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [activeTab, setActiveTab] = useState<string>('notes');
  // 导出会议弹窗：选择 录音 / 文档
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // 声纹模型状态：缺失/下载失败时在会议页明确提示（此前只有日志里一句报错）
  const [speakerModel, setSpeakerModel] = useState<SpeakerModelStatus | null>(null);
  const [speakerModelBusy, setSpeakerModelBusy] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const [noteSaveState, setNoteSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>(
    'idle',
  );
  const [noteSavedAt, setNoteSavedAt] = useState('');
  const noteBaseline = useRef('');
  // 笔记富文本编辑器元素（contentEditable）
  const noteEditorRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
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

  // 录音进行中暂停自动锁定：一旦锁屏，LockGuard 会把路由切到 /lock，本页卸载
  // 会断开实时转录 WebSocket，解锁后还得重新进入会议。
  // 只认 recording——paused（用户主动暂停录音）期间人可能已离开工位，仍应正常锁定。
  useEffect(() => {
    if (!isRecording) return;
    pauseIdleTimer('meeting-recording');
    return () => {
      resumeIdleTimer('meeting-recording');
    };
  }, [isRecording]);

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

  // 等待在途 autosave 完成，再发起一次；force 时绝不因 inFlight 跳过
  const waitForAutosaveIdle = async () => {
    while (autosaveInFlight.current) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };

  const flushAutosave = async (opts: { force?: boolean } = {}) => {
    if (!id) return;
    // 转录已由后端实时落库（先入库再显示），autosave 只负责笔记，
    // 不再提交 transcript_segments（避免重复插入/覆盖刚入库的段）。
    if (opts.force) {
      await waitForAutosaveIdle();
    }
    if (autosaveInFlight.current) return;
    autosaveInFlight.current = true;
    try {
      const currentNotes = noteContentRef.current;
      if (!opts.force && currentNotes === noteBaseline.current) {
        return;
      }
      const res = await autosaveMeetingRecord(id, {
        notes: currentNotes,
        transcript_segments: [],
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

  const handleDownloadSpeakerModel = async () => {
    setSpeakerModelBusy(true);
    try {
      const res = await downloadSpeakerModel();
      if (res.code === 0 && res.data) {
        setSpeakerModel(res.data);
        message.info('已开始下载声纹模型，完成后重新生成纪要即可区分说话人');
      } else {
        setSpeakerModelBusy(false);
      }
    } catch {
      setSpeakerModelBusy(false);
      message.error('声纹模型下载请求失败');
    }
  };

  // 笔记编辑器首次挂载时填入已保存内容；
  // 之后由用户编辑驱动（contentEditable 不被 React 覆写，保留光标与格式）
  useEffect(() => {
    if (noteEditorRef.current && noteContent) {
      noteEditorRef.current.innerText = noteContent;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 声纹模型自检：缺失就提示并可一键下载，下载中轮询进度
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const res = await getSpeakerModelStatus();
        if (cancelled || res.code !== 0 || !res.data) return;
        setSpeakerModel(res.data);
        if (res.data.downloading || res.data.message === '正在校验声纹模型') {
          setSpeakerModelBusy(true);
          timer = setTimeout(load, 3000);
        } else {
          setSpeakerModelBusy(false);
        }
      } catch {
        // 状态查询失败不影响会议主流程
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
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
        // M2：卸载时同步发 pause——React 卸载时 effect cleanup 按定义逆序执行，
        // useMeetingWebSocket 的 cleanup 会立即 ws.close()；原 300ms 定时器
        // 方案的 pause 必然在 close 之后才发，被 sendMessage 的 readyState
        // 检查静默丢弃 → 后端只走 disconnect 兜底、音频缺尾。
        // 已 send 的帧浏览器会尽力在 close 前送出。
        try {
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          }
        } catch {
          // ignore
        }
        notifyPause();
        stopAudioCapture();
      } else {
        // 组件卸载时停止音频采集，避免后台占用麦克风
        stopAudioCapture();
      }
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
          // 防御：纪要已完成/失败时，即使后端 status 存在同步延迟，
          // 前端也立即把会议视为完成，按钮从「生成中」恢复，不再转圈
          setMeeting((prev) => (prev ? { ...prev, status: 'completed' } : prev));
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
  const mergeServerSegments = (
    prev: TranscriptItem[],
    serverSegments: TranscriptItem[],
  ): TranscriptItem[] => {
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

  // 当 WebSocket 收到新的转录片段时更新（M6）：
  // 后端先落库再推送，WS 消息本身就带 id/seq/text/时间戳——直接并入本地
  // transcript 即可，不必每句一次全量 fetchMeeting（原实现 1 小时会议
  // 触发 ~500 次全量 GET，响应体随段数线性膨胀）。全量刷新只在
  // 进入页面 / 暂停 / 恢复 / 结束 / 纪要轮询时进行。
  useEffect(() => {
    if (wsSegments.length > lastTranscriptSeq.current) {
      const fresh = wsSegments.slice(lastTranscriptSeq.current);
      lastTranscriptSeq.current = wsSegments.length;
      if (fresh.length > 0) {
        setTranscript((prev) => mergeServerSegments(prev, fresh as TranscriptItem[]));
      }
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
        setElapsedTime((prev) => prev + 1);
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
    // M7：统一走 flushAutosave（/autosave）单一保存路径——
    // 原实现与 scheduleAutosave 双路径并发在途，网络乱序时旧内容
    // 覆盖新内容；flushAutosave 已有 inFlight 锁 + baseline 比对。
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
        scheduleAutosave(1500); // M7：同 handleNoteChange，单一保存路径
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
        },
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

        // 计算音量级别（RMS）
        let sum = 0;
        for (let i = 0; i < channelData.length; i++) {
          const sample = channelData[i] ?? 0;
          sum += sample * sample;
        }
        const rms = Math.sqrt(sum / channelData.length);
        setAudioLevel(rms);

        // 会议场景不设静音阈值：低电平声音（气声/轻声/远场）也要原样传入，
        // 避免被噪声门误切造成漏识别；音频保持连续原始数据。
        // 转换为 16bit PCM
        const pcmData = new Int16Array(channelData.length);
        for (let i = 0; i < channelData.length; i++) {
          const sample = channelData[i] ?? 0;
          pcmData[i] = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
        }

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
            },
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

  // 冲刷最后一块音频：ScriptProcessor 回调每 4096 帧（约 256ms）触发一次，
  // 用户点结束/暂停可能恰在两次回调之间——若立刻断开 processor，
  // 缓冲中的最后一块（可能含最后一句）永远不会发出，导致音频文件缺尾、丢句。
  // 做法：先停止麦克风源，再等一个回调周期让最后一块 onaudioprocess 发送，
  // 之后才安全断开 processor + 关闭 context。
  const flushLastAudioChunk = async () => {
    try {
      // 1) 先停麦克风轨道（不再产生新数据，但已缓冲数据仍可回调）
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      // 2) 等一个完整回调周期（256ms），确保最后一块 audio_chunk 已发出；
      //  此时 onaudioprocess 仍在运行（processor 未断开）
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch {
      // 忽略：冲刷失败不影响后续结束流程
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
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
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
      // M5：统一「先 WS 后 REST」——先停 WS 接收（is_paused 立即生效，
      // 窗口期不再有音频写入），再落 DB 状态
      await flushLastAudioChunk();
      stopAudioCapture();
      sendMessage({ type: 'pause' });
      const res = await pauseMeeting(id);
      if (res.code === 0) {
        message.success('会议已暂停');
        // 关键：fetchMeeting 会用服务端数据替换 transcript，必须先把
        // 最新的实时片段强制落库，否则最后一句会被替换掉、回到列表再进即消失
        await flushAutosave({ force: true });
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
      // M5：先发 WS 'resume' 解除后端 is_paused——原顺序 REST 在前，
      // 窗口期内 WS 仍丢弃音频 → 恢复后前几百毫秒音频缺失。
      // WS 先行对 DB 无损：paused 态 WS 本就保持连接。
      sendMessage({ type: 'resume' });
      const res = await resumeMeeting(id);
      if (res.code === 0) {
        message.success('会议已恢复');
        fetchMeeting();
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
      // 结束顺序（关键）：
      // 1) 先冲刷最后一块音频（停麦克风源 + 等一个回调周期），让缓冲中
      //  可能含最后一句的 audio_chunk 先发出；WS 消息有序，它在 end 之前送达；
      // 2) 再断开 processor/context（此时最后一块已发出）；
      // 3) 最后通知后端 end（后端 flush 语音缓冲收尾）。
      // 原实现先 send end 再 stopAudioCapture，若点在两次 onaudioprocess
      // 回调之间，缓冲的最后一块音频永远不会发出 → 音频文件缺尾、最后一句丢失。
      await flushLastAudioChunk();
      stopAudioCapture();
      sendMessage({ type: 'end' });
      // M1：等后端 flush（join 在途转录线程）完成后再触发会后处理——
      // 后端 'end' 分支 join 完才回包；这里是前端缓冲，根治在后端 join
      await new Promise((resolve) => setTimeout(resolve, 500));
      const res = await endMeeting(id);
      if (res.code === 0) {
        message.success('会议已结束，正在处理中...');
        minutesNotified.current = false;
        // 结束前强制把最新实时片段落库（fetchMeeting 会替换 transcript）
        await flushAutosave({ force: true });
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
        // 后端可能返回「会议尚未结束/正在处理中」等业务提示；
        // 刷新状态让按钮反映真实情况（避免停留在转圈）
        message.error(res.msg || '生成纪要失败');
        fetchMeeting();
      }
    } catch {
      message.error('网络错误，请稍后重试');
      fetchMeeting();
    } finally {
      setActionLoading(false);
    }
  };

  // 导出会议：录音直接下载音频文件；文档拉取转录+纪要素材并保存为文本文件
  const handleExport = async (kind: 'audio' | 'document') => {
    if (!id) return;
    setExporting(true);
    try {
      if (kind === 'audio') {
        // 录音：直接打开音频下载端点（带 token）
        const token = getToken();
        const url =
          '/api/v1/meetings/' +
          id +
          '/audio' +
          (token ? '?token=' + encodeURIComponent(token) : '');
        window.open(url, '_blank');
      } else {
        // 文档：转录 + 纪要，拼成可读文本下载
        // M12：minutes 未生成时该请求 404 属预期——分别 catch，不再让
        // 整个导出失败；文档头部注明纪要状态，避免静默缺块误导用户
        const [transcriptRes, minutesRes] = await Promise.all([
          exportMeeting(id, 'transcript').catch(() => null),
          exportMeeting(id, 'minutes').catch(() => null),
        ]);
        const transcriptData =
          transcriptRes && transcriptRes.code === 0 ? (transcriptRes.data as any) : null;
        const minutesData = minutesRes && minutesRes.code === 0 ? (minutesRes.data as any) : null;

        const lines: string[] = [];
        lines.push('会议：' + (transcriptData?.title || minutesData?.title || ''));
        lines.push('');

        if (!minutesData) {
          // 明确说明缺块原因，而非凭空没有纪要部分
          const minutesHint =
            meeting?.minutes_status === 'done'
              ? '（纪要读取失败，本次导出不含纪要内容）'
              : meeting?.minutes_status === 'failed'
                ? '（纪要生成失败，本次导出不含纪要内容；可在会议页重试生成）'
                : '（纪要尚未生成，本次导出不含纪要内容）';
          lines.push('【会议纪要】' + minutesHint);
          lines.push('');
        }

        if (minutesData) {
          lines.push('【会议总结】');
          lines.push(minutesData.summary || '');
          lines.push('');
          if (Array.isArray(minutesData.key_points) && minutesData.key_points.length) {
            lines.push('【重点摘要】');
            minutesData.key_points.forEach((kp: string) => lines.push('- ' + kp));
            lines.push('');
          } else {
            // 生成完成但无重点：如实占位，避免文档缺块
            lines.push('【重点摘要】');
            lines.push('（无重点摘要）');
            lines.push('');
          }
          if (Array.isArray(minutesData.todos) && minutesData.todos.length) {
            lines.push('【待办事项】');
            minutesData.todos.forEach((td: { content?: string }) =>
              lines.push('- ' + (td.content || '')),
            );
            lines.push('');
          } else {
            // 生成完成但无待办：如实占位，避免文档缺块
            lines.push('【待办事项】');
            lines.push('（无待办事项）');
            lines.push('');
          }
        }

        if (
          transcriptData &&
          Array.isArray(transcriptData.segments) &&
          transcriptData.segments.length
        ) {
          lines.push('【会议转录】');
          // 按时间顺序输出（导出数据可能未按时间排序）
          const sortedSegs = [...transcriptData.segments].sort(
            (a: { audio_start_ms?: number }, b: { audio_start_ms?: number }) =>
              (a.audio_start_ms || 0) - (b.audio_start_ms || 0),
          );
          sortedSegs.forEach(
            (s: { text?: string; speaker?: string | null; audio_start_ms?: number }) => {
              const speaker = s.speaker || '说话人';
              const secs = Math.floor((s.audio_start_ms || 0) / 1000);
              const mm = String(Math.floor(secs / 60)).padStart(2, '0');
              const ss = String(secs % 60).padStart(2, '0');
              lines.push('[' + mm + ':' + ss + '] ' + speaker + '：' + (s.text || ''));
            },
          );
        }

        const content = lines.join('\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = (meeting?.title || '会议') + '-导出.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      }
      message.success('导出成功');
    } catch {
      message.error('导出失败，请稍后重试');
    } finally {
      setExporting(false);
      setExportModalOpen(false);
    }
  };

  // 删除会议：二次确认后调删除接口，成功后返回列表
  const handleDeleteMeeting = () => {
    if (!id) return;
    Modal.confirm({
      title: '删除会议',
      content: '确定要删除该会议吗？删除后转录、纪要、录音将一并删除，且不可恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setDeleting(true);
        try {
          const res = await deleteMeetingRecord(id);
          if (res.code === 0) {
            message.success('会议已删除');
            navigate('/meetings');
          } else {
            message.error(res.msg || '删除失败');
          }
        } catch {
          message.error('网络错误，请稍后重试');
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  // 统一的纪要/重点/待办面板：生成中 Spin → 失败提示+重试 → 内容 → 兜底
  const renderMinutesPanel = (label: string, content: React.ReactNode | null) => {
    if (meeting?.minutes_status === 'pending' && meeting?.status === 'processing') {
      // 会后处理分阶段：区分讲话人 → 转写 → 生成纪要，后端经 processing_stage 驱动
      const stageText =
        meeting?.processing_stage === '正在校验声纹模型'
          ? '正在校验声纹模型…'
          : meeting?.processing_stage === '正在区分讲话人'
            ? '正在区分讲话人…'
            : meeting?.processing_stage === '正在转写'
              ? '正在转写（按讲话人）…'
              : meeting?.processing_stage === '正在生成纪要'
                ? '正在生成纪要…'
                : label + '生成中，请稍候…';
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin />
          <Paragraph type="secondary" style={{ marginTop: 12 }}>
            {stageText}
          </Paragraph>
        </div>
      );
    }
    if (meeting?.minutes_status === 'failed') {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Paragraph type="danger">{label + '生成失败'}</Paragraph>
          <Button type="primary" loading={actionLoading} onClick={handleGenerateMinutes}>
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
      return <Empty description={'会议中未提取到' + label} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }
    if (meeting?.status === 'paused') {
      return (
        <Empty
          description={'会议已暂停，结束后将自动生成' + label}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }
    return (
      <Empty description={'会议结束后将自动生成' + label} image={Empty.PRESENTED_IMAGE_SIMPLE} />
    );
  };

  // 渲染层去重：同一句在实时（speaker=null→"发言人"）与会后（speaker="说话人N"）
  // 可能各存一条（ASR 同音字差异导致后端合并没判重），这里在展示时合并：
  // 归一化文本（去标点/空格）+ 时间接近(<=2s) 视为同一句，
  // 优先保留 speaker 非空的条目（说话人N），避免"发言人/说话人"冲突与重复。
  const normalizeText = (t: string) =>
    t.replace(/[\s。．.！!？?，,、；;：:""''（）()【】\[\]—…~～]/g, '').trim();
  const getSpeakerOf = (seg: TranscriptItem): string =>
    'speaker' in seg && seg.speaker ? String(seg.speaker) : '';
  // 同一句判定（M8 收紧）：时间接近(<=2s) 且（归一化文本相同，或
  // 长度比 <=1.15 且首 6 字符中 ≥4 个相同）。原 ±40% 长度比会把
  // 相邻的短句（如「好的」「我们开始吧」）误判为同一句而丢句；
  // 前缀比对容忍 ASR 同音字差异（同音字通常不影响开头）。
  const isSameUtterance = (aText: string, aStart: number, bText: string, bStart: number) => {
    if (Math.abs(aStart - bStart) > 2000) return false;
    if (aText === bText) return true;
    if (aText.length < 4 || bText.length < 4) return false;
    const ratio = Math.max(aText.length, bText.length) / Math.min(aText.length, bText.length);
    if (ratio > 1.15) return false;
    let same = 0;
    const n = Math.min(6, aText.length, bText.length);
    for (let i = 0; i < n; i++) if (aText[i] === bText[i]) same++;
    return same >= Math.min(4, n);
  };
  // M8：useMemo + 排序后只与前一条比较——原实现每条对全结果线性
  // findIndex（O(n²)）且每次渲染重算；时间有序后重复只可能相邻。
  const displayTranscript = useMemo(() => {
    const sorted = [...transcript].sort(
      (a, b) =>
        Number('audio_start_ms' in a ? (a.audio_start_ms ?? 0) : 0) -
        Number('audio_start_ms' in b ? (b.audio_start_ms ?? 0) : 0),
    );
    const out: TranscriptItem[] = [];
    for (const seg of sorted) {
      const text = normalizeText('text' in seg ? String(seg.text ?? '') : '');
      if (!text) {
        out.push(seg);
        continue;
      }
      const start = 'audio_start_ms' in seg ? Number(seg.audio_start_ms ?? 0) : 0;
      const prev = out[out.length - 1];
      if (
        prev &&
        isSameUtterance(
          text,
          start,
          normalizeText('text' in prev ? String(prev.text ?? '') : ''),
          'audio_start_ms' in prev ? Number(prev.audio_start_ms ?? 0) : 0,
        )
      ) {
        // 重复：保留 speaker 非空的一条（优先说话人N），丢弃无 speaker 的副本
        if (getSpeakerOf(seg) && !getSpeakerOf(prev)) {
          out[out.length - 1] = seg;
        }
        continue;
      }
      out.push(seg);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  if (!meeting) {
    return (
      <div
        style={{
          padding: 24,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400,
        }}
      >
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
          <Tag color={visibilityCfg.color}>{visibilityCfg.text}</Tag>
        </Space>
        <Space>
          {/* 结束会议按钮 */}
          {(isRecording || isPaused) && (
            <Button danger onClick={handleEnd}>
              结束会议
            </Button>
          )}

          {/* 导出会议（录音或文档） */}
          {meeting.status === 'completed' && (
            <Button icon={<DownloadOutlined />} onClick={() => setExportModalOpen(true)}>
              导出会议
            </Button>
          )}
          {/* 手动生成纪要（完成后未生成 / 生成失败重试 / 重新生成） */}
          {(meeting.status === 'completed' || meeting.status === 'processing') && (
            <Button
              // 只用 antd 的 loading prop（自带受控 spinner）；
              // 之前叠加的 LoadingOutlined icon 即使 spin=false 也会渲染旋转
              // 图标，造成「显示重新生成但仍转圈」的假象
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
          {/* 删除会议（二次确认） */}
          {meeting.status === 'completed' && (
            <Button danger loading={deleting} onClick={handleDeleteMeeting}>
              删除会议
            </Button>
          )}
        </Space>
      </div>

      {/* 导出会议选择弹窗 */}
      <Modal
        title="导出会议"
        open={exportModalOpen}
        onCancel={() => setExportModalOpen(false)}
        footer={null}
        width={400}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
          <Button
            loading={exporting}
            onClick={() => handleExport('audio')}
            disabled={!meeting?.audio_file_path}
          >
            导出录音
          </Button>
          <Button loading={exporting} onClick={() => handleExport('document')}>
            导出文档（转录 + 纪要）
          </Button>
        </div>
        {!meeting?.audio_file_path && (
          <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
            当前会议没有录音文件，仅可导出文档。
          </Text>
        )}
      </Modal>

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
                <Tag color="orange" style={{ margin: 0 }}>
                  已暂停
                </Tag>
              )}
            </div>
          </div>
          <div className={styles.transcriptList}>
            {displayTranscript.length === 0 ? (
              <Empty description="暂无转录内容" style={{ padding: '40px 0' }} />
            ) : (
              displayTranscript.map((seg, idx) => {
                const itemKey = 'id' in seg ? seg.id : `ws-${idx}`;
                const speaker = 'speaker' in seg ? seg.speaker : null;
                return (
                  <div key={itemKey} className={styles.transcriptItem}>
                    <div className={styles.transcriptMeta}>
                      <span className={styles.timestamp}>
                        [{formatTimestamp(seg.audio_start_ms)}]
                      </span>
                      {/* 模型分不出说话人时，用户可直接点这句指定——这是最终出口，
  不依赖任何声纹模型。仅会议结束后、且有 id 的已落库句子可改。 */}
                      {meeting?.status === 'completed' &&
                      'seq' in seg &&
                      typeof (seg as { seq?: number }).seq === 'number' ? (
                        <Select
                          variant="borderless"
                          value={speaker || undefined}
                          placeholder="指定说话人"
                          style={{ minWidth: 96, fontSize: 13 }}
                          popupMatchSelectWidth={false}
                          options={[
                            ...Array.from(
                              new Set([
                                ...(transcript
                                  .map((s) => ('speaker' in s ? s.speaker : null))
                                  .filter(Boolean) as string[]),
                                '说话人1',
                                '说话人2',
                                '说话人3',
                                '说话人4',
                                '说话人5',
                                '说话人6',
                              ]),
                            ).map((n) => ({ label: n, value: n })),
                          ]}
                          onChange={async (val) => {
                            if (!id) return;
                            const seqNo = (seg as { seq?: number }).seq as number;
                            try {
                              await setSegmentSpeaker(id, seqNo, val ?? null);
                              await fetchMeeting();
                            } catch {
                              message.error('修改说话人失败');
                            }
                          }}
                        />
                      ) : (
                        <Text strong>{speaker || '说话人'}</Text>
                      )}
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
                  const height =
                    isRecording && active ? Math.min(100, baseHeight + rmsLevel * 60) : 12;
                  return (
                    <div
                      key={i}
                      className={`${styles.meterBar} ${isRecording && active ? 'active' : ''}`}
                      style={{
                        height: `${height}%`,
                        opacity: isRecording ? (active ? 1 : 0.5) : 0.5,
                      }}
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
                title={
                  isRecording
                    ? '暂停'
                    : isPaused
                      ? '恢复'
                      : isCompleted
                        ? '会议已结束'
                        : isProcessing
                          ? '处理中'
                          : '开始'
                }
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
          {speakerModel && !speakerModel.available && (
            <Alert
              type="warning"
              showIcon
              style={{ margin: '8px 12px 0' }}
              message="说话人分离不可用：本次会议不会区分说话人"
              description={
                speakerModel.downloading || speakerModelBusy
                  ? speakerModel.message || '正在下载声纹模型…'
                  : speakerModel.reason || '声纹模型缺失，下载后重新生成纪要即可区分说话人'
              }
              action={
                <Button loading={speakerModelBusy} onClick={handleDownloadSpeakerModel}>
                  下载模型
                </Button>
              }
            />
          )}
          {activeTab === 'notes' && (
            <>
              <div className={styles.toolbar}>
                <Button type="text" onClick={() => handleNoteFormat('bold')}>
                  <Text strong>B</Text>
                </Button>
                <Button type="text" onClick={() => handleNoteFormat('italic')}>
                  <Text italic>I</Text>
                </Button>
                <Button type="text" onClick={() => handleNoteFormat('underline')}>
                  <Text underline>U</Text>
                </Button>
                <Button type="text" onClick={() => handleNoteFormat('formatBlock', '<h1>')}>
                  H1
                </Button>
                <Button type="text" onClick={() => handleNoteFormat('formatBlock', '<h2>')}>
                  H2
                </Button>
              </div>
              <div
                ref={noteEditorRef}
                className={styles.editor}
                contentEditable
                suppressContentEditableWarning
                onInput={handleNoteChange}
                data-placeholder="开始记录你的笔记..."
                style={{ outline: 'none', resize: 'none' }}
              />
              <div className={styles.editorFooter}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {noteSaveState === 'saving' && (
                    <span>
                      <LoadingOutlined style={{ marginRight: 4 }} />
                      保存中
                    </span>
                  )}
                  {noteSaveState === 'saved' && (
                    <span>
                      <CheckCircleOutlined
                        style={{ marginRight: 4, color: 'var(--color-success)' }}
                      />
                      已保存 {noteSavedAt}
                    </span>
                  )}
                  {noteSaveState === 'failed' && '自动保存失败，继续编辑后重试'}
                  {noteSaveState === 'idle' && (noteContent ? '自动保存' : '未开始记录')}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
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
                  new Set(
                    transcript
                      .map((s) => ('speaker' in s ? s.speaker : null) || '')
                      .filter(Boolean) as string[],
                  ),
                );
                // 指定人数重新区分面板：自动聚类不可靠，真实人数只有用户知道
                const rediarizePanel = (
                  <div
                    style={{
                      background: 'var(--canvas)',
                      border: '1px solid var(--border-secondary)',
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 14,
                    }}
                  >
                    <Text strong style={{ fontSize: 13 }}>
                      指定实际人数重新区分说话人
                    </Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <InputNumber
                        min={1}
                        max={20}
                        placeholder="实际人数"
                        value={speakerCount}
                        onChange={(v) => setSpeakerCount(typeof v === 'number' ? v : null)}
                        style={{ width: 110 }}
                      />
                      <Button
                        loading={rediarizing}
                        disabled={!speakerCount}
                        onClick={async () => {
                          if (!id || !speakerCount) return;
                          setRediarizing(true);
                          try {
                            const res = await rediarizeSpeakers(id, speakerCount);
                            message.success(res.msg || '已重新区分说话人');
                            setSpeakerEdits({});
                            await fetchMeeting();
                          } catch (e) {
                            message.error(
                              '重新区分失败：' + (e instanceof Error ? e.message : '未知错误'),
                            );
                          } finally {
                            setRediarizing(false);
                          }
                        }}
                      >
                        重新区分
                      </Button>
                    </div>
                    <Paragraph type="secondary" style={{ margin: '6px 0 0', fontSize: 11 }}>
                      只重跑说话人分离（几秒，不重做转写）；改完如需纪要同步，请点「重新生成纪要」。
                    </Paragraph>
                  </div>
                );
                if (names.length === 0) {
                  return (
                    <div>
                      {meeting?.diarization_status === 'failed' && (
                        <Alert
                          type="warning"
                          showIcon
                          style={{ marginBottom: 12 }}
                          message="本次未能区分说话人"
                          description="音频中人声检测覆盖不足（噪音大、离麦克风远或音量过低时常见）。转写内容不受影响；若确知有几位讲话人，可在下方指定人数重新区分。"
                        />
                      )}
                      {rediarizePanel}
                      <Empty description="暂无说话人标签" style={{ padding: '20px 0' }} />
                    </div>
                  );
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
                      const res = await updateSpeakerNames(id, mapping);
                      // M10：后端提示「纪要需重新生成才能同步新名字」
                      message.info(
                        res.msg || '说话人名称已更新；如需纪要同步使用新名字，请重新生成纪要',
                      );
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
                    {rediarizePanel}
                    {names.map((n) => (
                      <div
                        key={n}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
                      >
                        <Tag color="blue" style={{ minWidth: 70, textAlign: 'center' }}>
                          {n}
                        </Tag>
                        <Input
                          value={speakerEdits[n] ?? n}
                          placeholder="新名字"
                          onChange={(e) =>
                            setSpeakerEdits((prev) => ({ ...prev, [n]: e.target.value }))
                          }
                          style={{ flex: 1 }}
                        />
                      </div>
                    ))}
                    <Space style={{ marginTop: 12 }}>
                      <Button type="primary" loading={speakerSaving} onClick={save}>
                        保存名称
                      </Button>
                      <Button
                        onClick={async () => {
                          if (!id) return;
                          try {
                            await generateMinutes(id);
                            message.success('已重新生成纪要');
                            await fetchMeeting();
                          } catch {
                            message.error('重新生成失败');
                          }
                        }}
                      >
                        重新生成纪要
                      </Button>
                    </Space>
                  </div>
                );
              })()}
            </div>
          )}
          {activeTab === 'recording' && (
            <div
              className={styles.editor}
              style={{
                padding: 16,
                overflowY: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: 520,
                  background: 'var(--canvas)',
                  border: '1px solid var(--border-secondary)',
                  borderRadius: 12,
                  padding: 16,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {meeting?.audio_file_path ? (
                  <audio
                    controls
                    style={{ width: '100%' }}
                    src={
                      '/api/v1/meetings/' +
                      id +
                      '/audio?token=' +
                      encodeURIComponent(getToken() ?? '')
                    }
                  />
                ) : (
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    暂无录音文件
                  </Text>
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
          WebSocket: {wsConnected ? '已连接' : isRecording || isPaused ? '未连接' : '未启动'}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {transcript.length} 条
        </Text>
      </div>
    </div>
  );
}
