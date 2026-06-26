import { useState, useRef } from 'react';
import { Button, Space, Input, Tag, message, Modal, Tooltip, Dropdown } from 'antd';
import {
  VideoCameraOutlined, DesktopOutlined,
  PlayCircleOutlined, StopOutlined, PlusOutlined,
  DeleteOutlined, SettingOutlined, FullscreenOutlined,
  SoundOutlined, MutedOutlined, EyeOutlined, GlobalOutlined,
  FontSizeOutlined,
} from '@ant-design/icons';
import styles from './StreamStudio.module.css';

type SourceType = 'camera' | 'screen' | 'network' | 'image' | 'text';

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
};

export default function StreamStudio() {
  const [scenes, setScenes] = useState<Scene[]>([
    { id: 'scene_1', name: '场景 1', sources: [] },
  ]);
  const [activeSceneId, setActiveSceneId] = useState('scene_1');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [streamUrl, setStreamUrl] = useState('');
  const [networkUrl, setNetworkUrl] = useState('');
  const [textInput, setTextInput] = useState('');
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const activeScene = scenes.find((s) => s.id === activeSceneId) || scenes[0]!;

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
      }

      const newSource: SceneSource = {
        id: `source_${Date.now()}`,
        type,
        name,
        stream,
        url,
        x: 0,
        y: 0,
        width: type === 'text' ? 200 : 320,
        height: type === 'text' ? 50 : 240,
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
      if (type === 'camera' || type === 'screen') {
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

  const startStream = () => {
    if (!streamUrl.trim()) {
      message.warning('请输入推流地址');
      return;
    }
    setIsStreaming(true);
    message.success('开始推流');
  };

  const stopStream = () => {
    setIsStreaming(false);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
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
          <span style={{ fontWeight: 600, fontSize: 16 }}>直播工作室</span>
          {isStreaming && <Tag color="red">推流中</Tag>}
          {isRecording && <Tag color="orange">录制中</Tag>}
        </Space>
        <Space>
          <Button icon={<SettingOutlined />}>设置</Button>
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
                  {
                    key: 'camera',
                    label: '摄像头',
                    icon: <VideoCameraOutlined />,
                  },
                  {
                    key: 'screen',
                    label: '屏幕共享',
                    icon: <DesktopOutlined />,
                  },
                  {
                    key: 'network',
                    label: '网络流',
                    icon: <GlobalOutlined />,
                  },
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
                    onClick={() => setAudioEnabled(!audioEnabled)}
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
            <div className={styles.previewVideo}>
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
                      style={{
                        left: source.x,
                        top: source.y,
                        width: source.width,
                        height: source.height,
                      }}
                    >
                      {getVideoElement(source)}
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
                    : () => setShowStreamModal(true)
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
            {isStreaming && (
              <Tag color="red" style={{ marginLeft: 16 }}>
                推流地址: {streamUrl}
              </Tag>
            )}
          </div>
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
        open={showStreamModal}
        onCancel={() => setShowStreamModal(false)}
        onOk={() => {
          startStream();
          setShowStreamModal(false);
        }}
        okText="开始推流"
      >
        <div>
          <div style={{ marginBottom: 8 }}>推流地址（RTMP/RTMPS）：</div>
          <Input
            value={streamUrl}
            onChange={(e) => setStreamUrl(e.target.value)}
            placeholder="rtmp://your-server/live/stream-key"
          />
          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            支持 RTMP、RTMPS
            协议，可配合 SRS、Nginx-RTMP、mediamtx 等服务器使用
          </div>
        </div>
      </Modal>
    </div>
  );
}
