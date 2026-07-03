import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Tag, Space, Button, Spin, message } from 'antd';
import { VideoCameraOutlined, CopyOutlined } from '@ant-design/icons';
import { WhepClient } from '../../utils/WhepClient';

const { Title, Text } = Typography;
const MEDIAMTX_PORT = 8889;
const RETRY_DELAY = 3000;

export default function StreamWatch() {
  const { roomId } = useParams<{ roomId: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const clientRef = useRef<WhepClient | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<'connecting' | 'playing' | 'error'>('connecting');

  const startConnection = useCallback((whepUrl: string, video: HTMLVideoElement) => {
    const client = new WhepClient();
    clientRef.current = client;
    client.onStateChange = (s) => {
      if (s === 'playing') setStatus('playing');
      else if (s === 'error') setStatus('error');
      else if (s === 'reconnecting') setStatus('connecting');
      else setStatus('connecting');
    };
    client.onError = (err) => {
      const msg = err.message || String(err);
      if (msg.includes('404')) {
        // 推流端未上线，3s 后重试
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => startConnection(whepUrl, video), RETRY_DELAY);
        return;
      }
      console.error('[WATCH]', err);
      setStatus('error');
    };
    client.start(whepUrl, video).catch((e) => { console.warn('Failed to start WHEP:', e); });
  }, []);

  useEffect(() => {
    if (!roomId) return;
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    clientRef.current?.stop();
    setStatus('connecting');
    const url = `http://${window.location.hostname}:${MEDIAMTX_PORT}/${roomId}/whep`;
    console.log('[WATCH] connecting:', url);
    startConnection(url, videoRef.current!);
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      clientRef.current?.stop();
    };
  }, [roomId, startConnection]);

  const handleRetry = () => {
    if (!roomId) return;
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    clientRef.current?.stop();
    setStatus('connecting');
    const url = `http://${window.location.hostname}:${MEDIAMTX_PORT}/${roomId}/whep`;
    startConnection(url, videoRef.current!);
  };

  const copyUrl = () => { navigator.clipboard.writeText(window.location.href); message.success('地址已复制'); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: '#000', color: '#fff', padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <VideoCameraOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ color: '#fff', margin: 0 }}>直播播放</Title>
        {roomId && <Tag color="blue">房间: {roomId.slice(0, 8)}...</Tag>}
        {status === 'playing' && <Tag color="green">播放中</Tag>}
        {status === 'connecting' && <Tag color="orange">连接中...</Tag>}
      </Space>
      <div style={{ position: 'relative', width: '100%', maxWidth: 960, aspectRatio: '16/9', background: '#111', borderRadius: 8, overflow: 'hidden' }}>
        <video ref={videoRef} muted autoPlay playsInline controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        {status === 'connecting' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
            <Space direction="vertical" align="center"><Spin /><div>等待推流端...</div></Space>
          </div>
        )}
        {status === 'error' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
            <Space direction="vertical" align="center">
              <Text style={{ color: '#ff4d4f' }}>连接失败</Text>
              <Button size="small" onClick={handleRetry}>重试</Button>
            </Space>
          </div>
        )}
      </div>
      <Space style={{ marginTop: 16 }}>
        <Button icon={<CopyOutlined />} onClick={copyUrl}>复制观看地址</Button>
      </Space>
    </div>
  );
}
