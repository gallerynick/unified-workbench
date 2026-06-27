import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Tag, Space, Input, Button, Spin } from 'antd';
import { VideoCameraOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function StreamWatch() {
  const { key: streamKey } = useParams<{ key: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamUrl, setStreamUrl] = useState(
    streamKey ? `${window.location.protocol}//${window.location.hostname}/live/${streamKey}.m3u8` : ''
  );
  const [status, setStatus] = useState<'idle' | 'connecting' | 'playing' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handlePlay = () => {
    if (!streamUrl.trim() || !videoRef.current) return;
    setStatus('connecting');
    setErrorMsg('');
    const video = videoRef.current;
    video.src = streamUrl;
    video.play()
      .then(() => setStatus('playing'))
      .catch((err) => { setStatus('error'); setErrorMsg(`无法播放: ${err.message}`); });
  };

  const handleStop = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.removeAttribute('src');
    videoRef.current.load();
    setStatus('idle');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: '#000', color: '#fff', padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <VideoCameraOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ color: '#fff', margin: 0 }}>直播播放</Title>
        {streamKey && <Tag color="blue">密钥: {streamKey.slice(0, 8)}...</Tag>}
        {status === 'playing' && <Tag color="green">播放中</Tag>}
      </Space>

      <div style={{ position: 'relative', width: '100%', maxWidth: 960, aspectRatio: '16/9', background: '#111', borderRadius: 8, overflow: 'hidden' }}>
        <video ref={videoRef} controls autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          onError={() => { setStatus('error'); setErrorMsg('视频加载失败'); }} />
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
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
            <Text style={{ color: '#ff4d4f' }}>{errorMsg}</Text>
          </div>
        )}
      </div>

      <Space style={{ marginTop: 16, width: '100%', maxWidth: 960 }}>
        <Input value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="http://server/live/stream.m3u8" style={{ flex: 1 }} onPressEnter={handlePlay} />
        <Button type="primary" onClick={handlePlay}>播放</Button>
        <Button onClick={handleStop}>停止</Button>
      </Space>
      <Text type="secondary" style={{ color: '#666', fontSize: 12, marginTop: 8 }}>
        支持 HLS (.m3u8) 和 HTTP-FLV (.flv) 格式，请确保流媒体服务器已配置对应输出
      </Text>
    </div>
  );
}
