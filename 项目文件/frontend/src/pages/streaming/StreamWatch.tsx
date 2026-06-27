import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Tag, Space, Input, Button, Spin, message } from 'antd';
import { VideoCameraOutlined } from '@ant-design/icons';
import Hls from 'hls.js';

const { Title, Text } = Typography;

export default function StreamWatch() {
  const { key: streamKey } = useParams<{ key: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [streamUrl, setStreamUrl] = useState(
    streamKey ? `${window.location.protocol}//${window.location.hostname}/live/${streamKey}.m3u8` : ''
  );
  const [status, setStatus] = useState<'idle' | 'connecting' | 'playing' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // 清理 HLS 实例
  const cleanupHls = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  };

  const handlePlay = () => {
    if (!streamUrl.trim() || !videoRef.current) return;
    cleanupHls();
    setStatus('connecting');
    setErrorMsg('');

    const video = videoRef.current;

    // HLS (.m3u8) 使用 hls.js 播放
    if (streamUrl.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play()
            .then(() => setStatus('playing'))
            .catch(() => { setStatus('error'); setErrorMsg('播放失败，请检查流地址'); });
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            setStatus('error');
            setErrorMsg(`HLS 错误: ${data.type} - ${data.details}`);
            cleanupHls();
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari 原生支持 HLS
        video.src = streamUrl;
        video.play()
          .then(() => setStatus('playing'))
          .catch((err) => { setStatus('error'); setErrorMsg(`播放失败: ${err.message}`); });
      } else {
        setStatus('error');
        setErrorMsg('当前浏览器不支持 HLS 播放，请更换 Chrome/Safari 或使用 .flv 格式');
      }
      return;
    }

    // FLV/其他格式使用原生 video
    video.src = streamUrl;
    video.play()
      .then(() => setStatus('playing'))
      .catch((err) => { setStatus('error'); setErrorMsg(`播放失败: ${err.message}`); });
  };

  const handleStop = () => {
    cleanupHls();
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.removeAttribute('src');
    videoRef.current.load();
    setStatus('idle');
  };

  const copyWatchUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    message.success('观看地址已复制');
  };

  useEffect(() => {
    return () => cleanupHls();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: '#000', color: '#fff', padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <VideoCameraOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ color: '#fff', margin: 0 }}>直播播放</Title>
        {streamKey && <Tag color="blue">密钥: {streamKey.slice(0, 8)}...</Tag>}
        {status === 'playing' && <Tag color="green">播放中</Tag>}
      </Space>

      <div style={{ position: 'relative', width: '100%', maxWidth: 960, aspectRatio: '16/9', background: '#111', borderRadius: 8, overflow: 'hidden' }}>
        <video ref={videoRef} controls autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        {status === 'connecting' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
            <Space direction="vertical" align="center"><Spin /><div>正在连接...</div></Space>
          </div>
        )}
        {status === 'idle' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <VideoCameraOutlined style={{ fontSize: 64, color: '#333' }} />
            <Text style={{ color: '#666' }}>输入流地址开始播放</Text>
          </div>
        )}
        {status === 'error' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(0,0,0,0.7)' }}>
            <Text style={{ color: '#ff4d4f', fontSize: 14 }}>{errorMsg}</Text>
            <Text style={{ color: '#999', fontSize: 12 }}>请确认流媒体服务器已运行且流地址正确</Text>
          </div>
        )}
      </div>

      <Space style={{ marginTop: 16, width: '100%', maxWidth: 960 }}>
        <Input value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="流地址" style={{ flex: 1 }} onPressEnter={handlePlay} />
        <Button type="primary" onClick={handlePlay}>播放</Button>
        <Button onClick={handleStop}>停止</Button>
        <Button onClick={copyWatchUrl}>复制地址</Button>
      </Space>
      <Text type="secondary" style={{ color: '#666', fontSize: 12, marginTop: 8 }}>
        支持 HLS (.m3u8) 和 FLV (.flv) 格式，需配合流媒体服务器（如 mediamtx、SRS）使用
      </Text>
    </div>
  );
}
