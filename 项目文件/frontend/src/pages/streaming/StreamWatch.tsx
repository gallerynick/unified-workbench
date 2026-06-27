import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Tag, Space, Button, Spin, message } from 'antd';
import { VideoCameraOutlined, CopyOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function StreamWatch() {
  const { key: streamKey } = useParams<{ key: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const chunksRef = useRef<ArrayBuffer[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'playing' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!streamKey) return;
    setStatus('connecting');
    chunksRef.current = [];

    const proto = window.location.protocol === 'https?' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/stream/${streamKey}`);
    wsRef.current = ws;
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe' }));

    ws.onmessage = (e) => {
      if (typeof e.data === 'string') return;
      chunksRef.current.push(e.data as ArrayBuffer);
      if (chunksRef.current.length % 10 === 0 && videoRef.current) {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const v = videoRef.current;
        v.src = url;
        v.onloadedmetadata = () => {
          if (v.duration > 0.5) {
            v.currentTime = v.duration - 0.3;
            v.play().catch(() => {});
          }
        };
        v.play().catch(() => {});
        if (status !== 'playing') setStatus('playing');
      }
    };

    ws.onerror = () => { setStatus('error'); setErrorMsg('无法连接'); };
    ws.onclose = () => { if (status === 'playing') setStatus('idle'); };

    return () => { ws.close(); };
  }, [streamKey]);

  const copyUrl = () => { navigator.clipboard.writeText(window.location.href); message.success('地址已复制'); };

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
            <Space direction="vertical" align="center"><Spin /><div>等待推流端...</div></Space>
          </div>
        )}
        {status === 'error' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
            <Text style={{ color: '#ff4d4f' }}>{errorMsg}</Text>
          </div>
        )}
      </div>

      <Space style={{ marginTop: 16 }}>
        <Button icon={<CopyOutlined />} onClick={copyUrl}>复制观看地址</Button>
      </Space>
    </div>
  );
}
