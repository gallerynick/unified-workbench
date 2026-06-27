import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Tag, Space, Button, Spin, message } from 'antd';
import { VideoCameraOutlined, CopyOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function StreamWatch() {
  const { key: streamKey } = useParams<{ key: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const queueRef = useRef<Uint8Array[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'playing' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const appendBuffer = (data: Uint8Array) => {
    const sb = sourceBufferRef.current;
    if (!sb) { queueRef.current.push(data); return; }
    if (sb.updating) { queueRef.current.push(data); return; }
    try { sb.appendBuffer(data); } catch (e) { setErrorMsg(`解码失败: ${e}`); }
  };

  const processQueue = () => {
    const sb = sourceBufferRef.current;
    if (!sb || sb.updating || queueRef.current.length === 0) return;
    const chunk = queueRef.current.shift()!;
    try { sb.appendBuffer(chunk); } catch (e) { setErrorMsg(`解码错误: ${e}`); }
  };

  useEffect(() => {
    if (!streamKey) return;
    setStatus('connecting');

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/stream/${streamKey}`);
    wsRef.current = ws;
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe' }));

    ws.onmessage = (e) => {
      if (typeof e.data === 'string') {
        const msg = JSON.parse(e.data);
        if (msg.type === 'ack' && msg.role === 'subscriber') {
          if (!videoRef.current) return;
          const ms = new MediaSource();
          mediaSourceRef.current = ms;
          videoRef.current.src = URL.createObjectURL(ms);
          ms.onsourceopen = () => {
            try {
              const sb = ms.addSourceBuffer('video/webm; codecs="vp8,opus"');
              try { sb.mode = 'sequence'; } catch {}
              sb.onupdateend = () => processQueue();
              sourceBufferRef.current = sb;
              for (const chunk of queueRef.current) appendBuffer(chunk);
              queueRef.current = [];
            } catch (e) { setErrorMsg(`Codec 错误: ${e}`); }
            setStatus('playing');
          };
        }
        return;
      }
      const buf = new Uint8Array(e.data);
      if (mediaSourceRef.current?.readyState === 'open') appendBuffer(buf);
      else queueRef.current.push(buf);
    };

    ws.onerror = () => { setStatus('error'); setErrorMsg('无法连接到直播服务器'); };
    ws.onclose = () => { if (status === 'playing') { setStatus('error'); setErrorMsg('直播已结束'); } };

    return () => {
      ws.close();
      if (mediaSourceRef.current?.readyState === 'open') mediaSourceRef.current.endOfStream();
    };
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
        {status === 'idle' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <VideoCameraOutlined style={{ fontSize: 64, color: '#333' }} />
            <Text style={{ color: '#666' }}>等待推流...</Text>
          </div>
        )}
      </div>

      <Space style={{ marginTop: 16 }}>
        <Button icon={<CopyOutlined />} onClick={copyUrl}>复制观看地址</Button>
      </Space>
      <Text type="secondary" style={{ color: '#666', fontSize: 12, marginTop: 8 }}>打开此页面的其他用户也能看到同一直播画面，无需安装任何软件</Text>
    </div>
  );
}
