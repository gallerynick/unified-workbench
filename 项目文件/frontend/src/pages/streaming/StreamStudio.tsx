import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Space, Input, Tag, message, Modal, Tooltip, Dropdown, Typography, Form, InputNumber, Select, Slider, Switch, Spin } from 'antd';
import {
  VideoCameraOutlined, DesktopOutlined,
  PlayCircleOutlined, StopOutlined, PlusOutlined,
  DeleteOutlined, SettingOutlined, FullscreenOutlined,
  SoundOutlined, MutedOutlined, EyeOutlined, GlobalOutlined,
  FontSizeOutlined, CopyOutlined, ReloadOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { getStreamConfig, updateStreamConfig, getStreamKey, resetStreamKey } from '../../api/stream';
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
  const [isRecording, setIsRecording] = useState(false);
  const [networkUrl, setNetworkUrl] = useState('');
  const [textInput, setTextInput] = useState('');
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [resizeSourceId, setResizeSourceId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, sourceX: 0, sourceY: 0, sourceW: 0, sourceH: 0 });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [settingsForm] = Form.useForm();
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [streamKey, setStreamKey] = useState('');
  const [pushUrl, setPushUrl] = useState('');
  const [watchUrl, setWatchUrl] = useState('');

  const activeScene = scenes.find((s) => s.id === activeSceneId) || scenes[0]!;

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const [configRes, keyRes] = await Promise.all([
        getStreamConfig(),
        getStreamKey(),
      ]);
      if (configRes.code === 0 && configRes.data) {
        settingsForm.setFieldsValue(configRes.data);
      }
      if (keyRes.code === 0 && keyRes.data) {
        setStreamKey(keyRes.data.stream_key);
        setPushUrl(keyRes.data.push_url);
        setWatchUrl(keyRes.data.watch_url || '');
      }
    } catch {
      message.error('加载推流配置失败');
    } finally {
      setSettingsLoading(false);
    }
  }, [settingsForm]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveSettings = async () => {
    try {
      const values = await settingsForm.validateFields();
      setSettingsSaving(true);
      const res = await updateStreamConfig(values);
      if (res.code === 0) {
        message.success(res.msg || '推流配置已更新');
        if (res.data) {
          settingsForm.setFieldsValue(res.data);
        }
      }
    } catch {
      message.error('保存失败');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleResetKey = () => {
    Modal.confirm({
      title: '重置推流密钥',
      icon: <ExclamationCircleOutlined />,
      content: '重置后旧的推流密钥将立即失效，正在进行的推流将被中断。确定要继续吗？',
      okText: '确认重置',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await resetStreamKey();
          if (res.code === 0 && res.data) {
            setStreamKey(res.data.stream_key);
            setPushUrl(res.data.push_url);
            setWatchUrl(res.data.watch_url || '');
            message.success(res.msg || '推流密钥已重置');
          }
        } catch {
          message.error('重置失败');
        }
      },
    });
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
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          name = '摄像头';
          break;
        case 'screen':
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
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
    if (!pushUrl) {
      message.warning('请先在设置中配置推流地址');
      return;
    }
    // 推流时获取最新密钥和地址
    try {
      const keyRes = await getStreamKey();
      if (keyRes.code === 0 && keyRes.data) {
        setStreamKey(keyRes.data.stream_key);
        setPushUrl(keyRes.data.push_url);
        setWatchUrl(keyRes.data.watch_url || '');
      }
    } catch {
      message.error('获取推流密钥失败');
      return;
    }
    // 创建合成画布
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d')!;
    document.body.appendChild(canvas);
    canvas.style.display = 'none';
    const canvasStream = canvas.captureStream(30);
    
    // 混音音频轨道（合并所有源的音频轨）
    const audioTracks: MediaStreamTrack[] = [];
    activeScene.sources.forEach((s) => {
      s.stream?.getAudioTracks().forEach((t) => audioTracks.push(t));
    });
    if (audioTracks.length > 0) {
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      audioTracks.forEach((t) => {
        const src = audioCtx.createMediaStreamSource(new MediaStream([t]));
        src.connect(dest);
      });
      dest.stream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
    }

    // 合成循环：把所有可见源绘制到 canvas
    let animId = 0;
    const composite = () => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      activeScene.sources.filter((s) => s.visible).forEach((s) => {
        if (s.type === 'text' && s.url) {
          ctx.fillStyle = '#fff';
          ctx.font = '24px sans-serif';
          ctx.fillText(s.url, s.x * canvas.width / 960, s.y * canvas.height / 540 + 30);
        }
      });
      animId = requestAnimationFrame(composite);
    };
    composite();

    const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/stream/${streamKey}`);
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'publish' }));
      streamRef.current = canvasStream;
      try {
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm';
        const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 2500000 });
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            e.data.arrayBuffer().then((buf) => ws.send(buf));
          }
        };
        recorder.start(100);
        (recorder as any).__canvas = canvas;
        (recorder as any).__animId = animId;
        setIsStreaming(true);
        message.success('开始推流');
      } catch (err) {
        message.error(`启动推流失败: ${err instanceof Error ? err.message : '未知错误'}`);
      }
    };
    ws.onerror = () => { message.error('推流连接失败'); };
    ws.onclose = () => {
      cancelAnimationFrame(animId);
      canvas.remove();
      if (mediaRecorderRef.current) { mediaRecorderRef.current.stop(); mediaRecorderRef.current = null; }
      setIsStreaming(false); streamRef.current = null;
    };
  };

  const stopStream = () => {
    if (mediaRecorderRef.current) {
      cancelAnimationFrame((mediaRecorderRef.current as any).__animId || 0);
      (mediaRecorderRef.current as any).__canvas?.remove();
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    streamRef.current = null;
    setIsStreaming(false);
    message.info('已停止推流');
  };

  const startRecording = () => {
    setIsRecording(true);
    message.success('开始录制');
  };

  const stopRecording = () => {
    setIsRecording(false);
    message.info('已停止录制');
  };

  const getVideoElement = (source: SceneSource) => {
    if (source.type === 'audio' && source.stream) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#1677ff', borderRadius: 4 }}>
          <audio ref={(el) => { if (el && source.stream) el.srcObject = source.stream; }} autoPlay muted playsInline />
          <SoundOutlined style={{ fontSize: 18, color: '#fff' }} />
        </div>
      );
    }
    if (source.stream) {
      return (
        <video
          ref={(el) => {
            if (el && source.stream) el.srcObject = source.stream;
          }}
          autoPlay
          muted
          playsInline
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
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      );
    }
    if (source.type === 'text' && source.url) {
      return (
        <div
          style={{
            padding: 16,
            fontSize: 24,
            color: '#fff',
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
          color: '#999',
        }}
      >
        {source.name}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Space>
          <Title level={4} className={styles.title ?? ''}>直播工作室</Title>
          {isStreaming && <Tag color="red">推流中</Tag>}
          {isRecording && <Tag color="orange">录制中</Tag>}
        </Space>
        <Space>
          <Button icon={<SettingOutlined />} onClick={() => { loadSettings(); setShowSettingsModal(true); }}>设置</Button>
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
                    <Tag>{scene.sources.length} 源</Tag>
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
              style={{ marginTop: 8 }}
            >
              添加场景
            </Button>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>源</div>
            <div className={styles.sourceList}>
              {activeScene.sources.map((source) => (
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
                  { type: 'group', label: '音频源', children: [
                    { key: 'audio', label: '麦克风', icon: <SoundOutlined /> },
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
                style={{ marginTop: 8 }}
              >
                添加源
              </Button>
            </Dropdown>
          </div>
        </div>

        <div className={styles.previewArea}>
          <div className={styles.previewContainer}>
            <div className={styles.previewHeader}>
              <span>预览</span>
              <Space>
                <Tooltip title={audioEnabled ? '静音' : '开启声音'}>
                  <Button
                    type="text"
                    size="small"
                    icon={audioEnabled ? <SoundOutlined /> : <MutedOutlined />}
                    onClick={() => {
                      const next = !audioEnabled;
                      setAudioEnabled(next);
                      activeScene.sources.forEach((s) => {
                        s.stream?.getAudioTracks().forEach((t) => { t.enabled = next; });
                      });
                    }}
                  />
                </Tooltip>
                <Tooltip title="全屏">
                  <Button
                    type="text"
                    size="small"
                    icon={<FullscreenOutlined />}
                    onClick={() => setPreviewFullscreen(!previewFullscreen)}
                  />
                </Tooltip>
              </Space>
            </div>
            <div className={styles.previewVideo}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                if (dragSourceId) {
                  const dx = e.clientX - rect.left - dragStart.x;
                  const dy = e.clientY - rect.top - dragStart.y;
                  setScenes((prev) => prev.map((s) => s.id === activeSceneId ? { ...s, sources: s.sources.map((src) => src.id === dragSourceId ? { ...src, x: Math.max(0, dragStart.sourceX + dx), y: Math.max(0, dragStart.sourceY + dy) } : src) } : s));
                  return;
                }
                if (resizeSourceId) {
                  const dx = e.clientX - rect.left - dragStart.x;
                  const dy = e.clientY - rect.top - dragStart.y;
                  setScenes((prev) => prev.map((s) => s.id === activeSceneId ? { ...s, sources: s.sources.map((src) => src.id === resizeSourceId ? { ...src, width: Math.max(50, dragStart.sourceW + dx), height: Math.max(30, dragStart.sourceH + dy) } : src) } : s));
                }
              }}
              onMouseUp={() => { setDragSourceId(null); setResizeSourceId(null); }}
              onMouseLeave={() => { setDragSourceId(null); setResizeSourceId(null); }}
            >
              {activeScene.sources.length === 0 ? (
                <div className={styles.emptyPreview}>
                  <VideoCameraOutlined
                    style={{ fontSize: 48, color: '#999' }}
                  />
                  <div>点击"添加源"开始</div>
                </div>
              ) : (
                activeScene.sources
                  .filter((s) => s.visible)
                  .map((source) => (
                    <div
                      key={source.id}
                      className={styles.sourceOverlay}
                      style={{ left: source.x, top: source.y, width: source.width, height: source.height }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                        if (!rect) return;
                        setDragSourceId(source.id);
                        setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top, sourceX: source.x, sourceY: source.y, sourceW: source.width, sourceH: source.height });
                      }}
                    >
                      {getVideoElement(source)}
                      <div style={{ position: 'absolute', right: 0, bottom: 0, width: 16, height: 16, background: '#1677ff', cursor: 'nwse-resize', borderTopLeftRadius: 4 }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
                          if (!rect) return;
                          setResizeSourceId(source.id);
                          setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top, sourceX: source.x, sourceY: source.y, sourceW: source.width, sourceH: source.height });
                        }}
                      />
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
              <Button
                type={isRecording ? 'primary' : 'default'}
                danger={isRecording}
                icon={
                  isRecording ? <StopOutlined /> : <PlayCircleOutlined />
                }
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? '停止录制' : '开始录制'}
              </Button>
            </Space>
          </div>
          {isStreaming && (
          <div style={{ display: 'flex', gap: 16, padding: '8px 12px', borderTop: '1px solid var(--stream-border, #e8e8e8)', fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: '#999', whiteSpace: 'nowrap' }}>推流:</Text>
              <code style={{ color: '#1677ff', fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pushUrl || '设置中配置'}</code>
              <Tooltip title="复制"><Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(pushUrl, '推流地址')} /></Tooltip>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: '#999', whiteSpace: 'nowrap' }}>观看:</Text>
              <code style={{ color: '#52c41a', fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{watchUrl || '设置中配置'}</code>
              <Tooltip title="复制"><Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(watchUrl, '观看地址')} /></Tooltip>
            </div>
          </div>
          )}
        </div>
      </div>

      <Modal
        title="添加源"
        open={showSourceModal}
        onCancel={() => setShowSourceModal(false)}
        footer={null}
      >
        <Space
          direction="vertical"
          style={{ width: '100%' }}
          size="middle"
        >
          <div>
            <div style={{ marginBottom: 8 }}>
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
            <div style={{ marginBottom: 8 }}>文字内容：</div>
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
      >
        {settingsLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : (
          <div style={{ maxHeight: 500, overflow: 'auto' }}>
            <Form form={settingsForm} layout="vertical">
              <div style={{ fontWeight: 600, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--stream-border, #e8e8e8)' }}>服务器设置</div>
              <Form.Item name="server_url" label="推流服务器地址" rules={[{ required: true, message: '请输入推流服务器地址' }]}>
                <Input placeholder="rtmp://localhost:1935/live" />
              </Form.Item>
              <Form.Item name="server_port" label="服务器端口" rules={[{ required: true, message: '请输入服务器端口' }]}>
                <InputNumber min={1} max={65535} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="enable_auth" label="启用推流认证" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>

              <div style={{ fontWeight: 600, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--stream-border, #e8e8e8)', marginTop: 16 }}>编码参数</div>
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
                <Slider min={500} max={10000} step={100} marks={{ 500: '500', 2500: '2500', 5000: '5000', 10000: '10000' }} />
              </Form.Item>
            </Form>

            <div style={{ fontWeight: 600, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--stream-border, #e8e8e8)', marginTop: 16 }}>推流密钥</div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              推流密钥用于身份验证，请勿泄露给他人。如怀疑泄露，请立即重置。
            </Text>
            <Space style={{ width: '100%' }}>
              <Input.Password value={streamKey} readOnly style={{ width: 240 }} />
              <Tooltip title="复制密钥">
                <Button icon={<CopyOutlined />} onClick={() => copyToClipboard(streamKey, '推流密钥')} />
              </Tooltip>
              <Button danger icon={<ReloadOutlined />} onClick={handleResetKey}>重置</Button>
            </Space>
          </div>
        )}
      </Modal>
    </div>
  );
}
