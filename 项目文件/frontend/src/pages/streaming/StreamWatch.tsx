import { useParams } from 'react-router-dom';
import { Typography, Tag, Space } from 'antd';
import { VideoCameraOutlined } from '@ant-design/icons';

const { Title } = Typography;

export default function StreamWatch() {
  const { key: streamKey } = useParams<{ key: string }>();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#000', color: '#fff', padding: 24 }}>
      <Space style={{ marginBottom: 24 }}>
        <VideoCameraOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ color: '#fff', margin: 0 }}>直播播放</Title>
        {streamKey && <Tag color="blue">密钥: {streamKey.substring(0, 8)}...</Tag>}
      </Space>

      <div style={{ width: '100%', maxWidth: 960, aspectRatio: '16/9', background: '#111', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <VideoCameraOutlined style={{ fontSize: 64, color: '#333' }} />
      </div>

      {streamKey && (
        <Space direction="vertical" style={{ marginTop: 24, textAlign: 'center' }}>
          <div style={{ color: '#999' }}>推流密钥: {streamKey}</div>
          <div style={{ color: '#666', fontSize: 12 }}>
            请确保直播服务器已配置 HLS/HTTP-FLV 输出，并将视频流推送至该密钥对应地址
          </div>
        </Space>
      )}
    </div>
  );
}
