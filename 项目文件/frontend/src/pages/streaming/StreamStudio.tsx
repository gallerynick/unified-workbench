import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Space, Input, Tag, message, Modal, Tooltip, Dropdown, Typography, Form, InputNumber, Select, Slider, Switch, Spin, Table, Badge } from 'antd';
import {
  VideoCameraOutlined, DesktopOutlined,
  PlayCircleOutlined, StopOutlined, PlusOutlined,
  DeleteOutlined, SettingOutlined,
  SoundOutlined, MutedOutlined, EyeOutlined, GlobalOutlined,
  FontSizeOutlined, CopyOutlined, ExclamationCircleOutlined,
  AudioOutlined,
  ArrowUpOutlined, ArrowDownOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { getRoom, updateRoom, getRoomStatus, takeoverRoom, runSpeedTest, runDownloadTest } from '../../api/stream';
import type { StreamRoom } from '../../types/stream';
import { useWebSocket } from '../../hooks/useWebSocket';
import { WhipClient } from '../../utils/WhipClient';
import styles from './StreamStudio.module.css';

const { Title, Text } = Typography;

const RESOLUTION_OPTIONS = [
  { label: '1920×1080 (1080p)', value: '1920x1080' },
  { label: '1280×720 (720p)', value: '1280x720' },
  { label: '854×480 (480p)', value: '854x480' },
  { label: '640×360 (360p)', value: '640x360' },
];

const FPS_OPTIONS = [
  { label: '60 fps', value: 60 },
  { label: '30 fps', value: 30 },
  { label: '25 fps', value: 25 },
  { label: '15 fps', value: 15 },
];

type SourceType = 'camera' | 'screen' | 'network' | 'image' | 'text' | 'audio';

interface SceneSource {
  id: string;
  type: SourceType;
  name: string;
  stream?: MediaStream | undefined;
  url?: string | undefined;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  muted: boolean;
}

interface Scene {
  id: string;
  name: string;
  sources: SceneSource[];
}

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  camera: '摄像头',
  screen: '屏幕共享',
  network: '网络流',
  image: '图片',
  text: '文字',
  audio: '麦克风',
};

export default function StreamStudio() {
  const [scenes, setScenes] = useState<Scene[]>([
    { id: 'scene_1', name: '场景 1', sources: [] },
  ]);
  const [activeSceneId, setActiveSceneId] = useState('scene_1');
  const [isStreaming, setIsStreaming] = useState(false);
  const [networkUrl, setNetworkUrl] = useState('');
  const [textInput, setTextInput] = useState('');
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [resizeSourceId, setResizeSourceId] = useState<string | null>(null);
  const [resizeCorner, setResizeCorner] = useState<'nw' | 'ne' | 'sw' | 'se' | null>(null);
  const [hoveredSourceId, setHoveredSourceId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, sourceX: 0, sourceY: 0, sourceW: 0, sourceH: 0 });

  const whipRef = useRef<WhipClient | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderLoopRef = useRef<number | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const sourceElRefs = useRef<Map<string, HTMLVideoElement | HTMLAudioElement>>(new Map());
  const assignedStreams = useRef<Map<HTMLVideoElement | HTMLAudioElement, MediaStream>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRefs = useRef<(GainNode | null)[]>([null, null, null, null]);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioConfigRef = useRef<{
    sampleRate: number;
    channels: number;
    mode: 'standard' | 'voice' | 'direct';
    noiseSuppression: boolean;
    echoCancellation: boolean;
    autoGainControl: boolean;
    highpassFreq: number;
    compressorThreshold: number;
    compressorRatio: number;
    limiterThreshold: number;
    outputGain: number;
  }>({
    sampleRate: 48000,
    channels: 2,
    mode: 'standard',
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
    highpassFreq: 80,
    compressorThreshold: -24,
    compressorRatio: 12,
    limiterThreshold: -3,
    outputGain: 0.85,
  });
  const scenesRef = useRef(scenes);
  const activeSceneIdRef = useRef(activeSceneId);
  scenesRef.current = scenes;
  activeSceneIdRef.current = activeSceneId;
  const [settingsForm] = Form.useForm();
  const audioMode = Form.useWatch('audio_processing_mode', settingsForm);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [roomInfo, setRoomInfo] = useState<StreamRoom | null>(null);
  const [pushUrl, setPushUrl] = useState('');
  const [watchUrl, setWatchUrl] = useState('');
  const [streamResolution, setStreamResolution] = useState('1920x1080');
  const [streamFps, setStreamFps] = useState(30);
  const [streamBitrate, setStreamBitrate] = useState(8000);
  const [pipActive, setPipActive] = useState(false);
  const [uploadKbps, setUploadKbps] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);

  interface AudioTrackState { stream: MediaStream | null; muted: boolean; name: string }
  const [audioTracks, setAudioTracks] = useState<AudioTrackState[]>([
    { stream: null, muted: false, name: '音轨 1' },
    { stream: null, muted: false, name: '音轨 2' },
    { stream: null, muted: false, name: '音轨 3' },
    { stream: null, muted: false, name: '音轨 4' },
  ]);
  const [audioSourceSelections, setAudioSourceSelections] = useState(['', '', '', '']);
  const [masterMuted, setMasterMuted] = useState(false);
  const [showSpeedTestModal, setShowSpeedTestModal] = useState(false);
  const [speedTestResults, setSpeedTestResults] = useState<number[]>([]);
  const [speedTestRunning, setSpeedTestRunning] = useState(false);
  const [speedTestConcurrent, setSpeedTestConcurrent] = useState<{ label: string; results: number[] }[]>([]);
  const [downloadMedKbps, setDownloadMedKbps] = useState<number | null>(null);
  const [downloadResults, setDownloadResults] = useState<number[]>([]);
  const [estPushCount, setEstPushCount] = useState(1);
  const [estPullCount, setEstPullCount] = useState(10);
  const [estBitrate, setEstBitrate] = useState(2000);

  const activeScene = scenes.find((s) => s.id === activeSceneId) || scenes[0]!;

  const { roomId } = useParams<{ roomId: string }>();

  const loadSettings = useCallback(async () => {
    if (!roomId) {
      message.error('缺少房间 ID');
      return;
    }
    setSettingsLoading(true);
    try {
      const res = await getRoom(roomId);
      if (res.code === 0 && res.data) {
        const room = res.data;
        setRoomInfo(room);
        setPushUrl(room.push_url);
        setWatchUrl(room.watch_url || '');
        if (room.config) {
          const cfg = room.config;
          if (cfg.default_resolution) setStreamResolution(cfg.default_resolution);
          if (cfg.default_fps) setStreamFps(cfg.default_fps);
          if (cfg.default_bitrate) setStreamBitrate(cfg.default_bitrate);
          settingsForm.setFieldsValue({
            ...cfg,
            server_url: room.push_url,
            server_port: 8889,
            enable_auth: true,
          });
          audioConfigRef.current = {
            sampleRate: cfg.audio_sample_rate ?? 48000,
            channels: cfg.audio_channels ?? 2,
            mode: (cfg.audio_processing_mode as 'standard' | 'voice' | 'direct') ?? 'standard',
            noiseSuppression: cfg.audio_noise_suppression ?? true,
            echoCancellation: cfg.audio_echo_cancellation ?? true,
            autoGainControl: cfg.audio_auto_gain_control ?? true,
            highpassFreq: cfg.audio_highpass_freq ?? 80,
            compressorThreshold: cfg.audio_compressor_threshold ?? -24,
            compressorRatio: cfg.audio_compressor_ratio ?? 12,
            limiterThreshold: cfg.audio_limiter_threshold ?? -3,
            outputGain: cfg.audio_output_gain ?? 0.85,
          };
        }
      }
    } catch {
      message.error('加载房间配置失败');
    } finally {
      setSettingsLoading(false);
    }
  }, [roomId, settingsForm]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveSettings = async () => {
    if (!roomId) return;
    try {
      const values = await settingsForm.validateFields();
      setSettingsSaving(true);
      const configData: Record<string, unknown> = {};
      const fieldMap: Record<string, string> = {
        default_resolution: 'default_resolution',
        default_fps: 'default_fps',
        default_bitrate: 'default_bitrate',
        audio_sample_rate: 'audio_sample_rate',
        audio_channels: 'audio_channels',
        audio_processing_mode: 'audio_processing_mode',
        audio_noise_suppression: 'audio_noise_suppression',
        audio_echo_cancellation: 'audio_echo_cancellation',
        audio_auto_gain_control: 'audio_auto_gain_control',
        audio_highpass_freq: 'audio_highpass_freq',
        audio_compressor_threshold: 'audio_compressor_threshold',
        audio_compressor_ratio: 'audio_compressor_ratio',
        audio_limiter_threshold: 'audio_limiter_threshold',
        audio_output_gain: 'audio_output_gain',
      };
      for (const [formField, configField] of Object.entries(fieldMap)) {
        if (values[formField] !== undefined && values[formField] !== null && values[formField] !== '') {
          configData[configField] = values[formField];
        }
      }
      const res = await updateRoom(roomId, { config: configData as any });
      if (res.code === 0) {
        message.success(res.msg || '推流配置已更新');
        if (res.data?.config) {
          audioConfigRef.current = {
            sampleRate: (res.data.config as any).audio_sample_rate ?? 48000,
            channels: (res.data.config as any).audio_channels ?? 2,
            mode: (res.data.config as any).audio_processing_mode ?? 'standard',
            noiseSuppression: (res.data.config as any).audio_noise_suppression ?? true,
            echoCancellation: (res.data.config as any).audio_echo_cancellation ?? true,
            autoGainControl: (res.data.config as any).audio_auto_gain_control ?? true,
            highpassFreq: (res.data.config as any).audio_highpass_freq ?? 80,
            compressorThreshold: (res.data.config as any).audio_compressor_threshold ?? -24,
            compressorRatio: (res.data.config as any).audio_compressor_ratio ?? 12,
            limiterThreshold: (res.data.config as any).audio_limiter_threshold ?? -3,
            outputGain: (res.data.config as any).audio_output_gain ?? 0.85,
          };
        }
        if (values.default_resolution) setStreamResolution(values.default_resolution);
        if (values.default_fps) setStreamFps(Number(values.default_fps));
        if (values.default_bitrate) setStreamBitrate(Number(values.default_bitrate));
        if (isStreaming) {
          message.info('已更新推流配置，停止并重新推流后生效');
        }
      }
    } catch {
      message.error('保存失败');
    } finally {
      setSettingsSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => message.success(`${label}已复制到剪贴板`),
      () => message.error('复制失败'),
    );
  };

  const addSource = async (type: SourceType) => {
    let stream: MediaStream | undefined;
    let name = '';
    let url = '';

    try {
      switch (type) {
        case 'camera':
          stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: false });
          name = '摄像头';
          break;
        case 'screen':
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
          name = '屏幕共享';
          break;
        case 'network':
          if (!networkUrl.trim()) {
            message.warning('请输入网络流地址');
            return;
          }
          url = networkUrl;
          name = `网络流: ${networkUrl.substring(0, 30)}...`;
          setNetworkUrl('');
          break;
        case 'text':
          if (!textInput.trim()) {
            message.warning('请输入文字内容');
            return;
          }
          name = `文字: ${textInput.substring(0, 20)}...`;
          url = textInput;
          setTextInput('');
          break;
        case 'image':
          name = '图片';
          break;
        case 'audio':
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          name = '麦克风';
          break;
      }

      const newSource: SceneSource = {
        id: `source_${Date.now()}`,
        type,
        name,
        stream,
        url,
        x: 0,
        y: 0,
        width: type === 'text' ? 200 : type === 'audio' ? 200 : 320,
        height: type === 'text' ? 50 : type === 'audio' ? 40 : 240,
        visible: true,
        muted: false,
      };

      setScenes((prev) =>
        prev.map((s) =>
          s.id === activeSceneId
            ? { ...s, sources: [...s.sources, newSource] }
            : s
        )
      );
      message.success(`已添加 ${SOURCE_TYPE_LABELS[type]}`);
    } catch (err) {
      if (type === 'camera' || type === 'screen' || type === 'audio') {
        message.error(`无法访问${SOURCE_TYPE_LABELS[type]}：${err instanceof Error ? err.message : '权限被拒绝'}`);
      }
    }
  };

  const removeSource = (sourceId: string) => {
    const source = activeScene.sources.find((s) => s.id === sourceId);
    if (source?.stream) {
      source.stream.getTracks().forEach((t) => t.stop());
    }
    assignedStreams.current.delete(sourceElRefs.current.get(sourceId)!);
    sourceElRefs.current.delete(sourceId);
    setScenes((prev) =>
      prev.map((s) =>
        s.id === activeSceneId
          ? { ...s, sources: s.sources.filter((src) => src.id !== sourceId) }
          : s
      )
    );
  };

  const toggleSourceVisibility = (sourceId: string) => {
    setScenes((prev) =>
      prev.map((s) =>
        s.id === activeSceneId
          ? {
              ...s,
              sources: s.sources.map((src) =>
                src.id === sourceId ? { ...src, visible: !src.visible } : src
              ),
            }
          : s
      )
    );
  };

  const moveSourceOrder = (sourceId: string, direction: number) => {
    setScenes((prev) =>
      prev.map((s) => {
        if (s.id !== activeSceneId) return s;
        const idx = s.sources.findIndex((src) => src.id === sourceId);
        if (idx < 0) return s;
        const newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= s.sources.length) return s;
        const newSources = [...s.sources];
        const tmp = newSources[idx]!;
        newSources[idx] = newSources[newIdx]!;
        newSources[newIdx] = tmp;
        return { ...s, sources: newSources };
      })
    );
  };

  const toggleAllSourcesVisibility = () => {
    const allVisible = activeScene.sources.every((s) => s.visible);
    setScenes((prev) =>
      prev.map((s) =>
        s.id === activeSceneId
          ? { ...s, sources: s.sources.map((src) => ({ ...src, visible: !allVisible })) }
          : s
      )
    );
  };

  const addScene = () => {
    const newScene: Scene = {
      id: `scene_${Date.now()}`,
      name: `场景 ${scenes.length + 1}`,
      sources: [],
    };
    setScenes((prev) => [...prev, newScene]);
    setActiveSceneId(newScene.id);
  };

  const removeScene = (sceneId: string) => {
    if (scenes.length <= 1) {
      message.warning('至少保留一个场景');
      return;
    }
    setScenes((prev) => prev.filter((s) => s.id !== sceneId));
    if (activeSceneId === sceneId) {
      setActiveSceneId(scenes.find((s) => s.id !== sceneId)?.id || '');
    }
  };

  const switchScene = (sceneId: string) => {
    setActiveSceneId(sceneId);
    message.info(`已切换到 ${scenes.find((s) => s.id === sceneId)?.name}`);
  };

  const startStream = async () => {
    if (!roomId || !roomInfo) {
      message.warning('房间信息未加载');
      return;
    }
    if (!pushUrl) {
      message.warning('推流地址未配置');
      return;
    }

    try {
      const statusRes = await getRoomStatus(roomId);
      if (statusRes.code === 0 && statusRes.data) {
        const { is_active, pusher_id, pusher_nickname } = statusRes.data;
        if (is_active && pusher_id) {
          const canTakeover = await new Promise<boolean>((resolve) => {
            Modal.confirm({
              title: '推流冲突',
              icon: <ExclamationCircleOutlined />,
              content: `房间正在由 ${pusher_nickname || '其他用户'} 推流中。是否接管推流？接管后原推流者将被停止。`,
              okText: '接管推流',
              cancelText: '取消',
              onOk: async () => { resolve(true); },
              onCancel: () => { resolve(false); },
            });
          });
          if (!canTakeover) return;
          const takeoverRes = await takeoverRoom(roomId);
          if (takeoverRes.code !== 0) {
            message.error('接管推流失败');
            return;
          }
          message.success('已接管推流');
        }
      }
    } catch {
      message.error('检查房间状态失败');
      return;
    }

    // Canvas 合成：将所有可见视频/文字/网络源绘制到画布上
    const [rw, rh] = streamResolution.split('x').map(Number);
    const canvasW = rw || 1920;
    const canvasH = rh || 1080;
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d')!;
    canvasRef.current = canvas;

    // 离屏 Canvas：先在离屏上绘制完整画面，再一次性拷贝到显示 Canvas，杜绝清屏竞态
    const offscreen = document.createElement('canvas');
    offscreen.width = canvasW;
    offscreen.height = canvasH;
    const offCtx = offscreen.getContext('2d')!;

    const container = previewRef.current;
    const rect = container?.getBoundingClientRect() ?? { width: canvasW, height: canvasH };
    const scale = canvasW / (rect.width || canvasW);

    const draw = () => {
      try {
        const scene = scenesRef.current.find((s) => s.id === activeSceneIdRef.current);
        const sources = scene?.sources.filter((s) => s.visible && s.type !== 'audio') ?? [];
        offCtx.fillStyle = 'var(--surface-black)';
        offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
        for (const src of sources) {
          const el = sourceElRefs.current.get(src.id);
          const dx = src.x * scale;
          const dy = src.y * scale;
          const dw = src.width * scale;
          const dh = src.height * scale;
          if (el instanceof HTMLVideoElement && el.readyState >= 2 && el.videoWidth > 0) {
            const vr = el.videoWidth / el.videoHeight;
            const sr = dw / dh;
            let fx = dx, fy = dy, fw = dw, fh = dh;
            if (vr > sr) { fh = dw / vr; fy = dy + (dh - fh) / 2; }
            else { fw = dh * vr; fx = dx + (dw - fw) / 2; }
            offCtx.drawImage(el, fx, fy, fw, fh);
          } else if (el instanceof HTMLVideoElement && el.readyState >= 2) {
            offCtx.drawImage(el, dx, dy, dw, dh);
          } else if (src.type === 'text' && src.url) {
            offCtx.fillStyle = 'var(--body-on-dark)';
            offCtx.font = `${Math.max(12, dh / 2)}px sans-serif`;
            offCtx.fillText(src.url, dx + 8 * scale, dy + dh / 2, dw - 16 * scale);
          }
        }
        // 原子拷贝：全画面一次性写入，requestFrame 不会抓到半成品
        ctx.drawImage(offscreen, 0, 0);
      } catch (e) { console.warn('[PUSH] draw error:', e); }
    };

    // Audio mixer: pre-mix 4 tracks into one via Web Audio API
    if (!audioCtxRef.current) {
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      // Silent oscillator keeps the audio track "live" so WHIP SDP includes it
      const osc = ctx.createOscillator();
      const zeroGain = ctx.createGain();
      zeroGain.gain.value = 0;
      osc.connect(zeroGain).connect(dest);
      osc.start();
      audioCtxRef.current = ctx;
      audioDestRef.current = dest;
      ctx.resume();
    }
    const dest = audioDestRef.current!;

    const compositeStream = new MediaStream();
    const videoTrack = canvas.captureStream(streamFps).getVideoTracks()[0];
    if (videoTrack) compositeStream.addTrack(videoTrack);

    audioTracks.forEach((track, i) => {
      if (track.stream && !gainNodeRefs.current[i]) {
        const source = audioCtxRef.current!.createMediaStreamSource(track.stream);
        const gain = audioCtxRef.current!.createGain();
        gain.gain.value = track.muted ? 0 : 1;
        source.connect(gain);
        gain.connect(dest);
        gainNodeRefs.current[i] = gain;
      }
    });
    // Add mixed audio output to compositeStream
    const destTrack = dest.stream.getAudioTracks()[0];
    if (destTrack) compositeStream.addTrack(destTrack);

    console.log('[PUSH] tracks:', compositeStream.getTracks().map(t => t.kind));

    const fpsInterval = 1000 / streamFps;
    const drawLoop = () => {
      renderLoopRef.current = window.setTimeout(() => {
        draw();
        drawLoop();
      }, fpsInterval);
    };
    drawLoop();
    console.log(`[PUSH] canvas=${canvasW}x${canvasH} fps=${streamFps} bitrate=${streamBitrate}kbps`);

    const client = new WhipClient();
    client.onStateChange = (s) => {
      if (s === 'streaming') setIsStreaming(true);
      if (s === 'error') setIsStreaming(false);
    };
    client.onError = (err) => {
      message.error(`推流失败: ${err.message}`);
    };
    client.onStats = (s) => {
      setUploadKbps(s.bitrateKbps);
      setUploadTotal(s.totalBytes);
    };
    whipRef.current = client;

    try {
      await client.start(pushUrl, compositeStream, { videoBitrate: streamBitrate, videoFps: streamFps, audioBitrate: 192 });
      setIsStreaming(true);
      if (roomId) {
        updateRoom(roomId, { is_active: true }).catch(() => {});
        getRoom(roomId).then(res => { if (res.code === 0 && res.data) setRoomInfo(res.data); }).catch(() => {});
      }
      draw(); // 启动 Canvas 合成渲染循环

      // 准备画中画 video（不自动打开，由用户点击按钮触发）
      const pip = document.createElement('video');
      pip.muted = true; pip.playsInline = true;
      pip.srcObject = compositeStream;
      pip.addEventListener('enterpictureinpicture', () => setPipActive(true));
      pip.addEventListener('leavepictureinpicture', () => {
        setPipActive(false);
        message.warning('画中画已关闭，后台推流将中断。请重新点击「开启后台推流」');
      });
      pipVideoRef.current = pip;
      pip.play();

      message.success('开始推流');
    } catch (err) {
      message.error(`启动推流失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const stopStream = () => {
    gainNodeRefs.current.forEach(g => { if (g) g.disconnect(); });
    gainNodeRefs.current = [null, null, null, null];
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    audioDestRef.current = null;
    if (renderLoopRef.current) { clearTimeout(renderLoopRef.current); renderLoopRef.current = null; }
    if (pipVideoRef.current) {
      pipVideoRef.current.pause(); pipVideoRef.current.srcObject = null; pipVideoRef.current = null;
    }
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch((e) => { console.warn('Failed to exit PiP:', e); });
    }
    whipRef.current?.stop();
    whipRef.current = null;
    canvasRef.current = null;
    setIsStreaming(false);
    setPipActive(false);
    updateRoom(roomId!, { is_active: false }).catch(() => {});
    getRoom(roomId!).then(res => { if (res.code === 0 && res.data) setRoomInfo(res.data); }).catch(() => {});
    message.info('已停止推流');
  };

  const handleSpeedTest = async () => {
    setShowSpeedTestModal(true);
    setSpeedTestRunning(true);
    setSpeedTestResults([]);
    setSpeedTestConcurrent([]);
    setDownloadMedKbps(null);
    setDownloadResults([]);

    const testSizes = [256 * 1024, 512 * 1024, 1024 * 1024, 2 * 1024 * 1024];
    const rounds = 3;
    const allResults: number[] = [];

    const oneRound = async () => {
      for (const size of testSizes) {
        for (let r = 0; r < rounds; r++) {
          const kbps = await runSpeedTest(size);
          allResults.push(kbps);
          setSpeedTestResults([...allResults]);
        }
      }
    };

    try {
      await oneRound();

      const concurrentConfigs = [
        { label: '2 路并发', count: 2, size: 512 * 1024, tests: 5 },
        { label: '4 路并发', count: 4, size: 512 * 1024, tests: 5 },
      ];

      for (const cfg of concurrentConfigs) {
        const concurrentResults: number[] = [];
        for (let t = 0; t < cfg.tests; t++) {
          const startTime = performance.now();
          const promises = Array.from({ length: cfg.count }, () => runSpeedTest(cfg.size));
          await Promise.all(promises);
          const elapsed = (performance.now() - startTime) / cfg.count;
          const kbps = Math.round((cfg.size * 8) / elapsed);
          concurrentResults.push(kbps);
          allResults.push(kbps);
          setSpeedTestResults([...allResults]);
        }
        setSpeedTestConcurrent((prev) => [...prev, { label: cfg.label, results: [...concurrentResults] }]);
      }

      const dlSizes = [512 * 1024, 1024 * 1024, 2 * 1024 * 1024];
      const dlResults: number[] = [];
      for (const size of dlSizes) {
        for (let r = 0; r < 3; r++) {
          const kbps = await runDownloadTest(size);
          dlResults.push(kbps);
        }
      }
      const dlSorted = [...dlResults].sort((a, b) => a - b);
      setDownloadMedKbps(dlSorted[Math.floor(dlSorted.length / 2)]!);
      setDownloadResults(dlResults);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '测速失败');
    } finally {
      setSpeedTestRunning(false);
    }
  };

  const getVideoElement = (source: SceneSource) => {
    if (source.type === 'audio' && source.stream) {
      return null;
    }
    if (source.stream) {
      return (
          <video
            ref={(el) => {
              if (el && source.stream && assignedStreams.current.get(el) !== source.stream) {
                el.srcObject = source.stream;
                assignedStreams.current.set(el, source.stream);
                sourceElRefs.current.set(source.id, el);
              }
            }}
            autoPlay
            muted
            playsInline
            disablePictureInPicture
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
      );
    }
    if (source.type === 'network' && source.url) {
      return (
        <video
          src={source.url}
          autoPlay
          muted
          playsInline
          disablePictureInPicture
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      );
    }
    if (source.type === 'text' && source.url) {
      return (
        <div
          style={{
            padding: "var(--spacing-card-gap)",
            fontSize: 'var(--text-heading-2-size)',
            color: 'var(--body-on-dark)',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {source.url}
        </div>
      );
    }
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        {source.name}
      </div>
    );
  };

  const handleAudioSourceChange = async (i: number, sourceType: string) => {
    if (!sourceType) {
      removeAudioFromTrack(i);
      return;
    }
    setAudioSourceSelections(prev => prev.map((s, idx) => idx === i ? sourceType : s));
    try {
      const ctx = audioCtxRef.current || new AudioContext();
      if (!audioCtxRef.current) { audioCtxRef.current = ctx; audioDestRef.current = ctx.createMediaStreamDestination(); }
      await ctx.resume();
      let s: MediaStream;
      let name = '';
      const cfg = audioConfigRef.current;
      if (sourceType === 'microphone') {
        s = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            echoCancellation: cfg.echoCancellation,
            noiseSuppression: cfg.noiseSuppression,
            autoGainControl: cfg.autoGainControl,
            sampleRate: cfg.sampleRate,
            channelCount: cfg.channels,
          },
        });
        name = '麦克风';
      } else if (sourceType === 'desktop') {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: {
            echoCancellation: { ideal: false },
            noiseSuppression: { ideal: false },
            autoGainControl: { ideal: false },
          },
        });
        const audioTrack = displayStream.getAudioTracks()[0];
        if (!audioTrack) {
          displayStream.getTracks().forEach(t => t.stop());
          throw new Error('所选屏幕无音频');
        }
        displayStream.getVideoTracks().forEach(t => t.stop());
        s = new MediaStream([audioTrack]);
        name = '桌面音频';
      } else {
        setAudioSourceSelections(prev => prev.map((s2, idx) => idx === i ? '' : s2));
        return;
      }
      setAudioTracks(prev => prev.map((t, idx) => idx === i ? { ...t, stream: s, name } : t));

      // 根据音频处理模式动态构建音频链路
      const mediaSource = ctx.createMediaStreamSource(s);
      const gain = ctx.createGain();
      gain.gain.value = cfg.outputGain;

      if (cfg.mode === 'direct') {
        // 直通模式：不做任何处理，直接连接
        mediaSource.connect(gain);
        gain.connect(audioDestRef.current!);
      } else if (cfg.mode === 'standard') {
        // 标准模式：只做输出增益控制，不做压缩/限制/滤波
        mediaSource.connect(gain);
        gain.connect(audioDestRef.current!);
      } else if (cfg.mode === 'voice') {
        // 语音模式：完整处理链路（高通→压缩→限制→增益）
        const highpass = ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = cfg.highpassFreq;
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = cfg.compressorThreshold;
        compressor.knee.value = 30;
        compressor.ratio.value = cfg.compressorRatio;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = cfg.limiterThreshold;
        limiter.knee.value = 0;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.001;
        limiter.release.value = 0.1;
        mediaSource.connect(highpass);
        highpass.connect(compressor);
        compressor.connect(limiter);
        limiter.connect(gain);
        gain.connect(audioDestRef.current!);
      } else {
        mediaSource.connect(gain);
        gain.connect(audioDestRef.current!);
      }
      gainNodeRefs.current[i] = gain;
      message.success(`${name}已添加`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '';
      if (sourceType === 'desktop') {
        if (errMsg.includes('所选屏幕无音频')) {
          message.error('所选屏幕无音频。请重新选择“整个屏幕”或“Chrome 标签页”，并勾选“共享音频”选项。');
        } else {
          message.error('无法捕获桌面音频。请确保选择的屏幕或标签页有音频输出。');
        }
      } else {
        if (errMsg.includes('Permission denied') || errMsg.includes('NotAllowedError')) {
          message.error('麦克风权限被拒绝。请检查浏览器设置并允许麦克风访问。');
        } else {
          message.error(`无法访问麦克风: ${errMsg || '未知错误'}`);
        }
      }
    }
  };
  const removeAudioFromTrack = (i: number) => {
    const gain = gainNodeRefs.current[i];
    if (gain) { gain.disconnect(); gainNodeRefs.current[i] = null; }
    setAudioTracks(prev => {
      const t = prev[i];
      if (t && t.stream) t.stream.getTracks().forEach(tr => tr.stop());
      return prev.map((t2, idx) => idx === i ? { stream: null, muted: false, name: '音轨 ' + (idx + 1) } : t2);
    });
    setAudioSourceSelections(prev => prev.map((s, idx) => idx === i ? '' : s));
  };
  const toggleTrackMute = (i: number) => {
    const gain = gainNodeRefs.current[i];
    if (!gain) return;
    setAudioTracks(prev => prev.map((t, idx) => {
      if (idx === i) { gain.gain.value = t.muted ? 1 : 0; return { ...t, muted: !t.muted }; }
      return t;
    }));
  };
  const toggleMasterMute = () => {
    const next = !masterMuted;
    setMasterMuted(next);
    gainNodeRefs.current.forEach(g => { if (g) g.gain.value = next ? 0 : 1; });
  };

  // WebSocket room_kicked handler
  const { kickedInfo } = useWebSocket();
  const kickedHandledRef = useRef<string | null>(null);
  const stopStreamRef = useRef(stopStream);
  stopStreamRef.current = stopStream;
  useEffect(() => {
    if (kickedInfo && roomId && kickedInfo.roomId === roomId && kickedHandledRef.current !== kickedInfo.roomId + kickedInfo.nickname) {
      kickedHandledRef.current = kickedInfo.roomId + kickedInfo.nickname;
      message.warning(`推流已被 ${kickedInfo.nickname} 接管`);
      if (isStreaming) {
        stopStreamRef.current();
      }
    }
  }, [kickedInfo, roomId, isStreaming]);

  const isExternalMode = roomInfo?.mode === 'external';

  return (
    <div className={styles.container}>
      {isExternalMode ? (
        /* Todo 12: External mode — 只显示 RTMP 地址和观看地址 */
        <div style={{ textAlign: 'center', padding: '60px 24px', maxWidth: 640, margin: '0 auto' }}>
          <Title level={4} style={{ marginBottom: "var(--spacing-xl)" }}>
            {roomInfo?.name || '直播间'}
            <Badge status={roomInfo?.is_active ? 'processing' : 'default'} style={{ marginLeft: "var(--spacing-sm)" }} text={roomInfo?.is_active ? '推流中' : '空闲'} />
          </Title>
          <div style={{ background: 'var(--bg-primary)', border: 'var(--border-width-thin) solid var(--border-secondary)', borderRadius: 'var(--rounded-sm)', padding: "var(--spacing-lg)", marginBottom: "var(--spacing-card-gap)", textAlign: 'left' }}>
            <div style={{ marginBottom: "var(--spacing-card-gap)" }}>
              <Text strong style={{ display: 'block', marginBottom: "var(--spacing-xxs)" }}>RTMP 推流地址</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: "var(--spacing-xs)", background: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: 'var(--rounded-xs)' }}>
                <code style={{ flex: 1, fontSize: 'var(--text-caption-size)', wordBreak: 'break-all' }}>{roomInfo?.rtmp_url}</code>
                <Button type="text" icon={<CopyOutlined />} onClick={() => copyToClipboard(roomInfo?.rtmp_url || '', 'RTMP 地址')} />
              </div>
            </div>
            <Text type="secondary" style={{ display: 'block', marginBottom: "var(--spacing-lg)" }}>
              在 OBS 中填入以下地址进行推流
            </Text>
            <div>
              <Text strong style={{ display: 'block', marginBottom: "var(--spacing-xxs)" }}>观看地址</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: "var(--spacing-xs)", background: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: 'var(--rounded-xs)' }}>
                <code style={{ flex: 1, fontSize: 'var(--text-caption-size)', wordBreak: 'break-all' }}>{roomInfo?.watch_url}</code>
                <Button type="text" icon={<CopyOutlined />} onClick={() => copyToClipboard(roomInfo?.watch_url || '', '观看地址')} />
              </div>
            </div>
          </div>
          <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
            此直播间为「外部推流」模式，请使用 OBS 等工具推流
          </Text>
        </div>
      ) : (
      <>
      <div className={styles.header}>
        <Space>
          <Title level={4} className={styles.title ?? ''}>{roomInfo?.name ? `${roomInfo.name} - 直播工作室` : '直播工作室'}</Title>
          {isStreaming && <Tag color="red">推流中</Tag>}
          {isStreaming && uploadKbps > 0 && (
            <Text style={{ fontSize: 'var(--text-body-xs-size)', color: 'var(--color-success)' }}>
              {uploadKbps} kbps · {uploadTotal > 1048576 ? `${(uploadTotal / 1048576).toFixed(1)}MB` : `${(uploadTotal / 1024).toFixed(0)}KB`}
            </Text>
          )}
        </Space>
        <Space>
          <Button icon={<SettingOutlined />} onClick={async () => { await loadSettings(); setShowSettingsModal(true); }}>设置</Button>
        </Space>
      </div>

      <div className={styles.main}>
        <div className={styles.sidebar}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>场景</div>
            <div className={styles.sceneList}>
              {scenes.map((scene) => (
                <div
                  key={scene.id}
                  className={`${styles.sceneItem} ${scene.id === activeSceneId ? styles.sceneItemActive : ''}`}
                  onClick={() => switchScene(scene.id)}
                >
                  <span>{scene.name}</span>
                  <Space size={4}>
                    <Tag>{scene.sources.length} 画面源</Tag>
                    {scenes.length > 1 && (
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeScene(scene.id);
                        }}
                      />
                    )}
                  </Space>
                </div>
              ))}
            </div>
            <Button
              block
              icon={<PlusOutlined />}
              onClick={addScene}
              style={{ marginTop: "var(--spacing-xs)" }}
            >
              添加场景
            </Button>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>画面源</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: "var(--spacing-xxs)", marginBottom: "var(--spacing-xxs)" }}>
              <Tooltip title={activeScene.sources.every((s) => s.visible) ? '全部隐藏' : '全部显示'}>
                <Button type="text" size="small" icon={activeScene.sources.every((s) => s.visible) ? <EyeOutlined /> : <EyeOutlined style={{ opacity: 0.3 }} />} onClick={toggleAllSourcesVisibility} />
              </Tooltip>
              <span style={{ fontSize: 'var(--text-body-xs-size)', fontWeight: 500 }}>黑屏</span>
            </div>
            <div className={styles.sourceList}>
              {activeScene.sources.map((source, idx) => (
                <div key={source.id} className={styles.sourceItem}>
                  <Space>
                    {source.type === 'camera' && <VideoCameraOutlined />}
                    {source.type === 'screen' && <DesktopOutlined />}
                    {source.type === 'network' && <GlobalOutlined />}
                    {source.type === 'text' && <FontSizeOutlined />}
                    {source.type === 'audio' && <SoundOutlined />}
                    <span style={{ opacity: source.visible ? 1 : 0.5 }}>
                      {source.name}
                    </span>
                  </Space>
                  <Space size={4}>
                    <Button
                      type="text"
                      size="small"
                      icon={<ArrowUpOutlined />}
                      disabled={idx === 0}
                      onClick={() => moveSourceOrder(source.id, -1)}
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<ArrowDownOutlined />}
                      disabled={idx === activeScene.sources.length - 1}
                      onClick={() => moveSourceOrder(source.id, 1)}
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={
                        source.visible ? (
                          <EyeOutlined />
                        ) : (
                          <EyeOutlined style={{ opacity: 0.3 }} />
                        )
                      }
                      onClick={() => toggleSourceVisibility(source.id)}
                    />
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeSource(source.id)}
                    />
                  </Space>
                </div>
              ))}
            </div>
            <Dropdown
              menu={{
                items: [
                  { type: 'group', label: '视频源', children: [
                    { key: 'camera', label: '摄像头', icon: <VideoCameraOutlined /> },
                    { key: 'screen', label: '屏幕共享', icon: <DesktopOutlined /> },
                  ]},
                  { type: 'divider' },
                  { key: 'network', label: '网络流', icon: <GlobalOutlined /> },
                  { key: 'text', label: '文字', icon: <FontSizeOutlined /> },
                ],
                onClick: ({ key }) => {
                  if (key === 'network' || key === 'text') {
                    setShowSourceModal(true);
                  } else {
                    addSource(key as SourceType);
                  }
                },
              }}
            >
              <Button
                block
                icon={<PlusOutlined />}
                style={{ marginTop: "var(--spacing-xs)" }}
              >
                添加画面源
              </Button>
            </Dropdown>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>音频源</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: "var(--spacing-xxs)", marginBottom: "var(--spacing-xxs)" }}>
              <Tooltip title={masterMuted ? '取消静音' : '全部静音'}>
                <Button type="text" size="small" icon={masterMuted ? <MutedOutlined /> : <SoundOutlined />} onClick={toggleMasterMute} />
              </Tooltip>
              <span style={{ fontSize: 'var(--text-body-xs-size)', fontWeight: 500 }}>静音</span>
            </div>
            {audioTracks.map((track, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: "var(--spacing-xxs)", padding: '4px 0' }}>
                {track.stream ? (
                  <>
                    <Tooltip title={track.muted ? '取消静音' : '静音'}>
                      <Button type="text" size="small" icon={track.muted ? <MutedOutlined /> : <SoundOutlined />} onClick={() => toggleTrackMute(i)} />
                    </Tooltip>
                    <Text style={{ fontSize: 'var(--text-body-xs-size)', color: 'var(--color-success)', flex: 1 }}>{track.name}</Text>
                    <Tooltip title="移除"><Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => removeAudioFromTrack(i)} /></Tooltip>
                  </>
                ) : (
                  <Select
                    size="small"
                    style={{ flex: 1 }}
                    placeholder={`${track.name} — 选择音频源`}
                    value={audioSourceSelections[i] || undefined}
                    allowClear
                    options={[
                      { value: 'microphone', label: <><AudioOutlined /> 麦克风</> },
                      { value: 'desktop', label: <><DesktopOutlined /> 桌面音频</> },
                    ]}
                    onChange={(value) => handleAudioSourceChange(i, value || '')}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.previewArea}>
          <div className={styles.previewHeader}><span>画布</span></div>
          <div className={styles.previewContainer}>
            <div className={styles.previewVideo} ref={previewRef}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const maxW = rect.width;
                const maxH = rect.height;
                if (dragSourceId) {
                  const dx = e.clientX - rect.left - dragStart.x;
                  const dy = e.clientY - rect.top - dragStart.y;
                  setScenes((prev) => prev.map((s) => s.id === activeSceneId ? { ...s, sources: s.sources.map((src) => {
                    if (src.id !== dragSourceId) return src;
                    const nx = Math.max(0, Math.min(maxW - src.width, dragStart.sourceX + dx));
                    const ny = Math.max(0, Math.min(maxH - src.height, dragStart.sourceY + dy));
                    return { ...src, x: nx, y: ny };
                  }) } : s));
                  return;
                }
                if (resizeSourceId && resizeCorner) {
                  const dx = e.clientX - rect.left - dragStart.x;
                  const dy = e.clientY - rect.top - dragStart.y;
                  setScenes((prev) => prev.map((s) => s.id === activeSceneId ? { ...s, sources: s.sources.map((src) => {
                    if (src.id !== resizeSourceId) return src;
                    let nx = src.x, ny = src.y, nw = src.width, nh = src.height;
                    if (resizeCorner === 'se') {
                      nw = Math.max(50, Math.min(maxW - src.x, dragStart.sourceW + dx));
                      nh = Math.max(30, Math.min(maxH - src.y, dragStart.sourceH + dy));
                    } else if (resizeCorner === 'sw') {
                      nw = Math.max(50, Math.min(maxW, dragStart.sourceW - dx));
                      nh = Math.max(30, Math.min(maxH - src.y, dragStart.sourceH + dy));
                      nx = Math.max(0, Math.min(maxW - nw, dragStart.sourceX + dx));
                    } else if (resizeCorner === 'ne') {
                      nw = Math.max(50, Math.min(maxW - src.x, dragStart.sourceW + dx));
                      nh = Math.max(30, Math.min(maxH, dragStart.sourceH - dy));
                      ny = Math.max(0, Math.min(maxH - nh, dragStart.sourceY + dy));
                    } else if (resizeCorner === 'nw') {
                      nw = Math.max(50, Math.min(maxW, dragStart.sourceW - dx));
                      nh = Math.max(30, Math.min(maxH, dragStart.sourceH - dy));
                      nx = Math.max(0, Math.min(maxW - nw, dragStart.sourceX + dx));
                      ny = Math.max(0, Math.min(maxH - nh, dragStart.sourceY + dy));
                    }
                    return { ...src, x: nx, y: ny, width: nw, height: nh };
                  }) } : s));
                }
              }}
              onMouseUp={() => { setDragSourceId(null); setResizeSourceId(null); setResizeCorner(null); }}
              onMouseLeave={() => { setDragSourceId(null); setResizeSourceId(null); setResizeCorner(null); }}
            >
              {activeScene.sources.length === 0 ? (
                <div className={styles.emptyPreview}>
                  <VideoCameraOutlined
                    style={{ fontSize: 48, color: 'var(--text-secondary)' }}
                  />
                  <div>点击"添加画面源"开始</div>
                </div>
              ) : (
                activeScene.sources
                  .filter((s) => s.visible && s.type !== 'audio')
                  .map((source, sIdx) => (
                    <div
                      key={source.id}
                      className={styles.sourceOverlay}
                      style={{ left: source.x, top: source.y, width: source.width, height: source.height, zIndex: sIdx + 1, outline: hoveredSourceId === source.id ? '2px solid var(--color-info)' : 'none' }}
                      onMouseEnter={() => setHoveredSourceId(source.id)}
                      onMouseLeave={() => setHoveredSourceId(null)}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                        if (!rect) return;
                        setDragSourceId(source.id);
                        setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top, sourceX: source.x, sourceY: source.y, sourceW: source.width, sourceH: source.height });
                      }}
                    >
                      {getVideoElement(source)}
                      {hoveredSourceId === source.id && (
                        <>
                          {/* 四角调整控制点 */}
                          <div style={{ position: 'absolute', left: -5, top: -5, width: 10, height: 10, background: 'var(--color-info)', cursor: 'nwse-resize', borderRadius: 'var(--rounded-chip)', zIndex: 10 }}
                            onMouseDown={(e) => { e.stopPropagation(); const rect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect(); if (!rect) return; setResizeSourceId(source.id); setResizeCorner('nw'); setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top, sourceX: source.x, sourceY: source.y, sourceW: source.width, sourceH: source.height }); }}
                          />
                          <div style={{ position: 'absolute', right: -5, top: -5, width: 10, height: 10, background: 'var(--color-info)', cursor: 'nesw-resize', borderRadius: 'var(--rounded-chip)', zIndex: 10 }}
                            onMouseDown={(e) => { e.stopPropagation(); const rect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect(); if (!rect) return; setResizeSourceId(source.id); setResizeCorner('ne'); setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top, sourceX: source.x, sourceY: source.y, sourceW: source.width, sourceH: source.height }); }}
                          />
                          <div style={{ position: 'absolute', left: -5, bottom: -5, width: 10, height: 10, background: 'var(--color-info)', cursor: 'nesw-resize', borderRadius: 'var(--rounded-chip)', zIndex: 10 }}
                            onMouseDown={(e) => { e.stopPropagation(); const rect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect(); if (!rect) return; setResizeSourceId(source.id); setResizeCorner('sw'); setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top, sourceX: source.x, sourceY: source.y, sourceW: source.width, sourceH: source.height }); }}
                          />
                          <div style={{ position: 'absolute', right: -5, bottom: -5, width: 10, height: 10, background: 'var(--color-info)', cursor: 'nwse-resize', borderRadius: 'var(--rounded-chip)', zIndex: 10 }}
                            onMouseDown={(e) => { e.stopPropagation(); const rect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect(); if (!rect) return; setResizeSourceId(source.id); setResizeCorner('se'); setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top, sourceX: source.x, sourceY: source.y, sourceW: source.width, sourceH: source.height }); }}
                          />
                        </>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>

          <div className={styles.controls}>
            <Space>
              <Button
                type="primary"
                danger={isStreaming}
                icon={
                  isStreaming ? <StopOutlined /> : <PlayCircleOutlined />
                }
                onClick={
                  isStreaming
                    ? stopStream
                    : startStream
                }
              >
                {isStreaming ? '停止推流' : '开始推流'}
              </Button>
              {isStreaming && (
                <Button
                  type={pipActive ? 'primary' : 'default'}
                  icon={<PlayCircleOutlined />}
                  onClick={() => {
                    if (pipVideoRef.current && !document.pictureInPictureElement) {
                      pipVideoRef.current.requestPictureInPicture().catch(() => message.warning('画中画打开失败，请重试'));
                    }
                  }}
                  disabled={pipActive}
                >
                  {pipActive ? '画中画已开启' : '开启后台推流'}
                </Button>
              )}
              <Tooltip title="测试当前网络最大支持的上行码率">
                <Button
                  icon={<DashboardOutlined />}
                  onClick={() => setShowSpeedTestModal(true)}
                >
                  测速
                </Button>
              </Tooltip>
            </Space>
          </div>
          <div style={{ display: 'flex', gap: "var(--spacing-xs)", padding: '8px 12px', borderTop: '1px solid var(--border-secondary)', fontSize: 'var(--text-body-xs-size)', flexShrink: 0, visibility: isStreaming ? 'visible' : 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: "var(--spacing-xs)" }}>
                <Text style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>观看:</Text>
              <code style={{ color: 'var(--color-success)', fontSize: 'var(--text-body-xs-size)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{watchUrl || '设置中配置'}</code>
              <Tooltip title="复制"><Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(watchUrl, '观看地址')} /></Tooltip>
            </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: "var(--spacing-xs)" }}>
                <Text style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>拉流:</Text>
              <code style={{ color: 'var(--color-warning)', fontSize: 'var(--text-body-xs-size)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{roomInfo?.rtmp_url || '配置中'}</code>
              <Tooltip title="复制"><Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(roomInfo?.rtmp_url || '', '拉流地址')} /></Tooltip>
            </div>
          </div>
          </div>
        </div>

      <Modal
        title="添加画面源"
        open={showSourceModal}
        onCancel={() => setShowSourceModal(false)}
        footer={null}
        width={560}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Space
          direction="vertical"
          style={{ width: '100%' }}
          size="middle"
        >
          <div>
            <div style={{ marginBottom: "var(--spacing-xs)" }}>
              网络流地址（HLS/RTSP/HTTP）：
            </div>
            <Space>
              <Input
                value={networkUrl}
                onChange={(e) => setNetworkUrl(e.target.value)}
                placeholder="https://example.com/stream.m3u8"
                style={{ width: 300 }}
              />
              <Button
                type="primary"
                onClick={() => {
                  addSource('network');
                  setShowSourceModal(false);
                }}
              >
                添加
              </Button>
            </Space>
          </div>
          <div>
            <div style={{ marginBottom: "var(--spacing-xs)" }}>文字内容：</div>
            <Space>
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="输入要显示的文字"
                style={{ width: 300 }}
              />
              <Button
                type="primary"
                onClick={() => {
                  addSource('text');
                  setShowSourceModal(false);
                }}
              >
                添加
              </Button>
            </Space>
          </div>
        </Space>
      </Modal>

      <Modal
        title="推流设置"
        open={showSettingsModal}
        onCancel={() => setShowSettingsModal(false)}
        width={560}
        footer={
          <Space>
            <Button onClick={() => setShowSettingsModal(false)}>关闭</Button>
            <Button type="primary" onClick={handleSaveSettings} loading={settingsSaving}>保存配置</Button>
          </Space>
        }
        styles={{ body: { overflowY: 'auto', overflowX: 'hidden' } }}
      >
        {settingsLoading ? (
          <div style={{ textAlign: 'center', padding: "var(--spacing-xxl)" }}><Spin /></div>
        ) : (
          <div style={{ maxHeight: 500, overflowY: 'auto', overflowX: 'hidden' }}>
            <Form form={settingsForm} layout="vertical" initialValues={{
              audio_sample_rate: 48000,
              audio_channels: 2,
              audio_processing_mode: 'standard',
              audio_noise_suppression: true,
              audio_echo_cancellation: true,
              audio_auto_gain_control: true,
              audio_highpass_freq: 80,
              audio_compressor_threshold: -24,
              audio_compressor_ratio: 12,
              audio_limiter_threshold: -3,
              audio_output_gain: 0.85,
            }}>
              <div className={styles.sectionTitle}>服务器设置</div>
              <Form.Item name="server_url" label="推流服务器地址" rules={[{ required: true, message: '请输入推流服务器地址' }]}>
                <Input placeholder="http://localhost:8889" />
              </Form.Item>
              <Form.Item name="server_port" label="服务器端口" rules={[{ required: true, message: '请输入服务器端口' }]}>
                <InputNumber min={1} max={65535} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="enable_auth" label="启用推流认证" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>

              <div className={styles.sectionTitle} style={{ marginTop: "var(--spacing-card-gap)" }}>编码参数</div>
              <Form.Item name="default_resolution" label="默认分辨率" rules={[{ required: true, message: '请选择默认分辨率' }]}>
                <Select options={RESOLUTION_OPTIONS} />
              </Form.Item>
              <Form.Item name="default_fps" label="默认帧率" rules={[{ required: true, message: '请选择默认帧率' }]}>
                <Select options={FPS_OPTIONS} />
              </Form.Item>
              <Form.Item label="码率范围 (kbps)">
                <Space style={{ width: '100%' }} align="start">
                  <Form.Item name="min_bitrate" noStyle rules={[{ required: true }]}>
                    <InputNumber min={100} placeholder="最小" addonAfter="kbps" />
                  </Form.Item>
                  <Text style={{ lineHeight: '32px' }}>—</Text>
                  <Form.Item name="max_bitrate" noStyle rules={[{ required: true }]}>
                    <InputNumber placeholder="最大" addonAfter="kbps" />
                  </Form.Item>
                </Space>
              </Form.Item>
              <Form.Item name="default_bitrate" label="默认码率 (kbps)">
                <Slider min={500} max={20000} step={500} marks={{ 500: '500', 5000: '5M', 10000: '10M', 20000: '20M' }} />
              </Form.Item>

              <div className={styles.sectionTitle} style={{ marginTop: "var(--spacing-card-gap)" }}>音频配置</div>
              <Form.Item name="audio_sample_rate" label="采样率 (Hz)">
                <Select options={[
                  { label: '44100 Hz (CD音质)', value: 44100 },
                  { label: '48000 Hz (标准)', value: 48000 },
                  { label: '96000 Hz (高保真)', value: 96000 },
                ]} />
              </Form.Item>
              <Form.Item name="audio_channels" label="声道数">
                <Select options={[
                  { label: '单声道 (Mono)', value: 1 },
                  { label: '立体声 (Stereo)', value: 2 },
                ]} />
              </Form.Item>
              <Form.Item name="audio_processing_mode" label="音频处理模式">
                <Select options={[
                  { label: '标准模式 — 均衡处理，适合通用场景', value: 'standard' },
                  { label: '语音模式 — 针对人声优化', value: 'voice' },
                  { label: '直通模式 — 无处理，原始音频直接推流', value: 'direct' },
                ]} />
              </Form.Item>

              {audioMode !== 'direct' && (
                <>
                  <Form.Item name="audio_noise_suppression" label="降噪" valuePropName="checked">
                    <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                  </Form.Item>
                  <Form.Item name="audio_echo_cancellation" label="回声消除" valuePropName="checked">
                    <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                  </Form.Item>
                  <Form.Item name="audio_auto_gain_control" label="自动增益控制 (AGC)" valuePropName="checked">
                    <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                  </Form.Item>
                  <Form.Item name="audio_highpass_freq" label="高通滤波频率 (Hz)">
                    <Slider min={0} max={500} step={10} marks={{ 0: '关闭', 80: '80Hz', 150: '150Hz', 300: '300Hz' }} />
                  </Form.Item>
                </>
              )}

              {audioMode === 'voice' && (
                <>
                  <div style={{ fontWeight: 600, marginBottom: "var(--spacing-xs)", marginTop: "var(--spacing-xs)" }}>压缩器 / 限制器</div>
                  <Form.Item name="audio_compressor_threshold" label="压缩阈值 (dB)">
                    <Slider min={-60} max={0} step={1} marks={{ '-60': '-60', '-30': '-30', '-12': '-12', '0': '0' }} />
                  </Form.Item>
                  <Form.Item name="audio_compressor_ratio" label="压缩比">
                    <Slider min={1} max={20} step={0.5} marks={{ 1: '1:1', 4: '4:1', 10: '10:1', 20: '20:1' }} />
                  </Form.Item>
                  <Form.Item name="audio_limiter_threshold" label="限制器阈值 (dB)">
                    <Slider min={-20} max={0} step={1} marks={{ '-20': '-20', '-12': '-12', '-6': '-6', '0': '0' }} />
                  </Form.Item>
                </>
              )}

              <Form.Item name="audio_output_gain" label="输出增益 (dB)">
                <Slider min={-20} max={20} step={1} marks={{ '-20': '-20', '-10': '-10', '0': '0', '10': '+10', '20': '+20' }} />
              </Form.Item>
            </Form>

          </div>
        )}
      </Modal>

      <Modal
        title="网络测速"
        open={showSpeedTestModal}
        onCancel={() => { setShowSpeedTestModal(false); setSpeedTestResults([]); setSpeedTestConcurrent([]); setDownloadMedKbps(null); }}
        footer={null}
        width={560}
        destroyOnClose
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        {!speedTestRunning && speedTestResults.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: "var(--spacing-xs)" }}>
              上行 / 下行 / 并发带宽综合测试
            </Text>
            <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>4 档数据量 × 3 轮 + 2/4 路并发 + 下行，约 30~60 秒</Text>
            <div style={{ marginTop: "var(--spacing-md)" }}>
              <Button type="primary" icon={<DashboardOutlined />} onClick={handleSpeedTest} size="large">开始测速</Button>
            </div>
          </div>
        )}
        {speedTestRunning && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: "var(--spacing-card-gap)" }}>
              <Text type="secondary">已测 {speedTestResults.length} 次</Text>
            </div>
            {speedTestResults.length > 0 && (
              <div style={{ marginTop: "var(--spacing-sm)", display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: "var(--spacing-xs)" }}>
                {speedTestResults.map((r, i) => (
                  <Tag key={i}>{Math.round(r / 1024 * 10) / 10} Mbps</Tag>
                ))}
              </div>
            )}
          </div>
        )}
        {!speedTestRunning && speedTestResults.length > 0 && (() => {
          const allResults = speedTestResults.slice(0, 12);
          const sorted = [...allResults].sort((a, b) => a - b);
          const avg = Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length);
          const max = sorted[sorted.length - 1]!;
          const min = sorted[0]!;
          const med = sorted[Math.floor(sorted.length / 2)]!;
          const recommend = Math.round(med * 0.7);
          return (
             <div style={{ padding: '8px 0' }}>
              <Title level={5} style={{ marginBottom: "var(--spacing-sm)" }}>上下行带宽</Title>
              {allResults.length > 0 && (() => {
                const dlData = downloadResults;
                const maxVal = Math.max(...allResults, ...(dlData.length > 0 ? dlData : [1]), 1);
                const chartMax = Math.ceil(maxVal / 1024 / 5) * 5 * 1024;
                const w = 480; const h = 160; const padL = 36; const padR = 36; const padT = 24; const padB = 20;
                const plotW = w - padL - padR; const plotH = h - padT - padB;
                const upPts = allResults.map((r, i) =>
                  `${padL + (i / (allResults.length - 1)) * plotW},${padT + plotH - (r / chartMax) * plotH}`
                ).join(' ');
                const dlPts = dlData.length > 0 ? dlData.map((r, i) =>
                  `${padL + (i / (dlData.length - 1)) * plotW},${padT + plotH - (r / chartMax) * plotH}`
                ).join(' ') : '';
                const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => chartMax * t);
                const dlSorted2 = dlData.length > 0 ? [...dlData].sort((a, b) => a - b) : [];
                const dlMed2 = dlSorted2.length > 0 ? dlSorted2[Math.floor(dlSorted2.length / 2)]! : 0;
                const dlAvg2 = dlSorted2.length > 0 ? Math.round(dlSorted2.reduce((s, v) => s + v, 0) / dlSorted2.length) : 0;
                const dlMax2 = dlSorted2.length > 0 ? dlSorted2[dlSorted2.length - 1]! : 0;
                const dlMin2 = dlSorted2.length > 0 ? dlSorted2[0]! : 0;
                return (
                  <div style={{ marginBottom: "var(--spacing-card-gap)" }}>
                    <div style={{ display: 'flex', gap: "var(--spacing-sm)", marginBottom: "var(--spacing-xxs)", fontSize: 'var(--text-body-xs-size)' }}>
                      <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-info)', marginRight: "var(--spacing-xxs)", verticalAlign: 'middle' }} />上行</span>
                      {dlData.length > 0 && <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)', marginRight: "var(--spacing-xxs)", verticalAlign: 'middle' }} />下行</span>}
                    </div>
                    <svg width={w} height={h} style={{ display: 'block' }}>
                      {yTicks.map((v, i) => (
                        <g key={i}>
                          <line x1={padL} y1={padT + plotH - (v / chartMax) * plotH} x2={w - padR} y2={padT + plotH - (v / chartMax) * plotH} stroke="var(--border-secondary)" strokeWidth={1} />
                          <text x={padL - 4} y={padT + plotH - (v / chartMax) * plotH + 4} textAnchor="end" fontSize={10} fill="var(--text-secondary)">
                            {Math.round(v / 1024 * 10) / 10}
                          </text>
                        </g>
                      ))}
                      {dlPts && <polyline points={dlPts} fill="none" stroke="var(--color-success)" strokeWidth={2} strokeLinejoin="round" />}
                      <polyline points={upPts} fill="none" stroke="var(--color-info)" strokeWidth={2} strokeLinejoin="round" />
                      {allResults.map((r, i) => (
                        <g key={`up-${i}`}>
                          <circle cx={padL + (i / (allResults.length - 1)) * plotW} cy={padT + plotH - (r / chartMax) * plotH} r={4} fill="var(--color-info)" />
                          <text x={padL + (i / (allResults.length - 1)) * plotW} y={padT + plotH - (r / chartMax) * plotH - 8} textAnchor="middle" fontSize={9} fill="var(--color-info)">{Math.round(r / 1024 * 10) / 10}</text>
                        </g>
                      ))}
                      {dlData.map((r, i) => (
                        <g key={`dl-${i}`}>
                          <circle cx={padL + (i / (dlData.length - 1)) * plotW} cy={padT + plotH - (r / chartMax) * plotH} r={4} fill="var(--color-success)" />
                          <text x={padL + (i / (dlData.length - 1)) * plotW} y={padT + plotH - (r / chartMax) * plotH - 8} textAnchor="middle" fontSize={9} fill="var(--color-success)">{Math.round(r / 1024 * 10) / 10}</text>
                        </g>
                      ))}
                      {allResults.map((_, i) => (
                        <text key={`xlbl-${i}`} x={padL + (i / (allResults.length - 1)) * plotW} y={h - 2} textAnchor="middle" fontSize={9} fill="var(--text-secondary)">{i + 1}</text>
                      ))}
                    </svg>
                    <Table
                      style={{ marginTop: "var(--spacing-sm)", width: '100%' }}
                      dataSource={[
                        { key: 'avg', label: '平均', up: `${Math.round(avg / 1024 * 10) / 10} Mbps`, dl: dlData.length > 0 ? `${Math.round(dlAvg2 / 1024 * 10) / 10} Mbps` : '-' },
                        { key: 'med', label: '中位', up: `${Math.round(med / 1024 * 10) / 10} Mbps`, dl: dlData.length > 0 ? `${Math.round(dlMed2 / 1024 * 10) / 10} Mbps` : '-' },
                        { key: 'max', label: '最大', up: `${Math.round(max / 1024 * 10) / 10} Mbps`, dl: dlData.length > 0 ? `${Math.round(dlMax2 / 1024 * 10) / 10} Mbps` : '-' },
                        { key: 'min', label: '最小', up: `${Math.round(min / 1024 * 10) / 10} Mbps`, dl: dlData.length > 0 ? `${Math.round(dlMin2 / 1024 * 10) / 10} Mbps` : '-' },
                      ]}
                      columns={[
                        { title: '', dataIndex: 'label', key: 'label' },
                        { title: '上行', dataIndex: 'up', key: 'up' },
                        { title: '下行', dataIndex: 'dl', key: 'dl' },
                      ]}
                      pagination={false}
                      size="small"
                    />
                  </div>
                );
              })()}

              {speedTestConcurrent.length > 0 && (
                <div style={{ marginTop: "var(--spacing-md)" }}>
                  <Title level={5} style={{ marginBottom: "var(--spacing-sm)" }}>并发表现</Title>
                  <Table
                    dataSource={speedTestConcurrent.map((cfg) => {
                      const cSorted = [...cfg.results].sort((a, b) => a - b);
                      const cMed = cSorted[Math.floor(cSorted.length / 2)]!;
                      const degradation = Math.round((1 - cMed / med) * 100);
                      return {
                        key: cfg.label,
                        label: cfg.label,
                        perConn: `${Math.round(cMed / 1024 * 10) / 10} Mbps`,
                        degradation: `${degradation}%`,
                      };
                    })}
                    columns={[
                      { title: '场景', dataIndex: 'label', key: 'label' },
                      { title: '每路带宽', dataIndex: 'perConn', key: 'perConn' },
                      { title: '衰减', dataIndex: 'degradation', key: 'degradation' },
                    ]}
                    pagination={false}
                    size="small"
                  />
                </div>
              )}

              <div style={{ marginTop: "var(--spacing-card-gap)", padding: "var(--spacing-sm)", border: 'var(--border-width-thin) solid var(--border-secondary)', borderRadius: 'var(--rounded-xs)' }}>
                <Text>稳定可用码率：约 {Math.round(recommend / 1024 * 10) / 10} Mbps ({recommend} kbps)</Text>
                <Text type="secondary" style={{ display: 'block', marginTop: "var(--spacing-xxs)", fontSize: 'var(--text-body-xs-size)' }}>测试中位值 × 0.7，保留安全余量。实际峰值可能更高，此值为保守估计</Text>
              </div>

              {downloadMedKbps !== null && (() => {
                const uploadMed = med;
                const downMed = downloadMedKbps;
                const pushNeed = estPushCount * estBitrate;
                const pullNeed = estPullCount * estBitrate;
                const uploadOk = estPushCount === 0 || pushNeed <= uploadMed;
                const downloadOk = pullNeed <= downMed;
                return (
                  <div style={{ marginTop: "var(--spacing-sm)", padding: "var(--spacing-sm)", border: 'var(--border-width-thin) solid var(--border-secondary)', borderRadius: 'var(--rounded-xs)' }}>
                    <Title level={5} style={{ marginBottom: "var(--spacing-xs)" }}>容量估算</Title>
                    <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                      实测上行 {Math.round(uploadMed / 1024 * 10) / 10} Mbps，下行 {Math.round(downMed / 1024 * 10) / 10} Mbps
                    </Text>

                    <div style={{ display: 'flex', gap: "var(--spacing-sm)", marginTop: "var(--spacing-sm)", flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 100 }}>
                        <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)', display: 'block', marginBottom: "var(--spacing-xxs)" }}>推流人数</Text>
                        <InputNumber min={0} max={100} value={estPushCount} onChange={(v) => setEstPushCount(v ?? 0)} style={{ width: '100%' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 100 }}>
                        <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)', display: 'block', marginBottom: "var(--spacing-xxs)" }}>拉流人数</Text>
                        <InputNumber min={0} max={1000} value={estPullCount} onChange={(v) => setEstPullCount(v ?? 0)} style={{ width: '100%' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 100 }}>
                        <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)', display: 'block', marginBottom: "var(--spacing-xxs)" }}>单路码率(kbps)</Text>
                        <InputNumber min={100} max={50000} step={100} value={estBitrate} onChange={(v) => setEstBitrate(v ?? 1000)} style={{ width: '100%' }} />
                      </div>
                    </div>

                    <Table
                      style={{ marginTop: "var(--spacing-sm)" }}
                      dataSource={[
                        { key: 'push', label: '上行需求', value: `${Math.round(pushNeed / 1024 * 10) / 10} Mbps`, ok: uploadOk },
                        { key: 'pull', label: '下行需求', value: `${Math.round(pullNeed / 1024 * 10) / 10} Mbps`, ok: downloadOk },
                      ]}
                      columns={[
                        { title: '方向', dataIndex: 'label', key: 'label', width: 100 },
                        { title: '带宽', dataIndex: 'value', key: 'value', render: (v: string) => v },
                        { title: '状态', key: 'status', width: 80, render: (_: unknown, r) => (r as { ok: boolean }).ok ? <Tag color="success">可承载</Tag> : <Tag color="error">不足</Tag> },
                      ]}
                      pagination={false}
                      size="small"
                    />

                    <Text type="secondary" style={{ display: 'block', marginTop: "var(--spacing-xs)", fontSize: 'var(--text-body-xs-size)' }}>基于实测带宽的理论估算</Text>
                  </div>
                );
              })()}
            </div>
          );
        })()}
      </Modal>
      </>
      )}
    </div>
  );
}
