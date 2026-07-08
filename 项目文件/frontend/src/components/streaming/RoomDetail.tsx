import { useState } from 'react';
import {
  Typography,
  Tag,
  Badge,
  Button,
  Space,
  Tooltip,
  Collapse,
  Input,
  Switch,
  Radio,
  message,
  Descriptions,
} from 'antd';
import {
  CopyOutlined,
  EnterOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { updateRoom } from '../../api/stream';
import type { StreamRoom, StreamRoomUpdate } from '../../types/stream';

const { Text, Title } = Typography;

interface RoomDetailProps {
  room: StreamRoom;
  isOwner: boolean;
  onUpdate: () => void;
}

export default function RoomDetail({ room, isOwner, onUpdate }: RoomDetailProps) {
  const navigate = useNavigate();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(room.name);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => message.success(`${label}已复制到剪贴板`),
      () => message.error('复制失败'),
    );
  };

  const handleUpdate = async (data: StreamRoomUpdate) => {
    try {
      const res = await updateRoom(room.id, data);
      if (res.code === 0) {
        message.success('已更新');
        onUpdate();
      } else {
        message.error(res.msg || '更新失败');
      }
    } catch {
      message.error('更新失败');
    }
  };

  const handleSaveName = () => {
    if (!nameInput.trim()) {
      message.warning('房间名称不能为空');
      setNameInput(room.name);
      setEditingName(false);
      return;
    }
    if (nameInput.trim() !== room.name) {
      handleUpdate({ name: nameInput.trim() });
    }
    setEditingName(false);
  };

  return (
    <div>
      {/* 房间名称 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-card-gap)' }}>
        {editingName && isOwner ? (
          <Input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onPressEnter={handleSaveName}
            onBlur={handleSaveName}
            style={{ width: 240 }}
            autoFocus
            maxLength={50}
          />
        ) : (
          <Title level={5} style={{ margin: 0 }}>{room.name}</Title>
        )}
        {isOwner && !editingName && (
          <Tooltip title="编辑名称">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setNameInput(room.name);
                setEditingName(true);
              }}
            />
          </Tooltip>
        )}
      </div>

      {/* 基本信息 */}
      <Descriptions
        column={1}
        size="small"
        style={{ marginBottom: 'var(--spacing-card-gap)' }}
        labelStyle={{
          color: 'var(--text-secondary)',
          width: 100,
        }}
      >
        <Descriptions.Item label="推流模式">
          <Tag color={room.mode === 'builtin' ? 'blue' : 'cyan'}>
            {room.mode === 'builtin' ? '内置推流' : '外部推流'}
          </Tag>
        </Descriptions.Item>

        <Descriptions.Item label="房间类型">
          <Tag color={room.room_type === 'temporary' ? 'orange' : 'green'}>
            {room.room_type === 'temporary' ? '临时' : '常驻'}
          </Tag>
        </Descriptions.Item>

        <Descriptions.Item label="活跃状态">
          <Badge
            status={room.is_active ? 'success' : 'default'}
            text={
              <Text>
                {room.is_active ? '推流中' : '等待推流'}
              </Text>
            }
          />
        </Descriptions.Item>

        {room.pusher_nickname && (
          <Descriptions.Item label="当前推流者">
            <Text>{room.pusher_nickname}</Text>
          </Descriptions.Item>
        )}

        <Descriptions.Item label="开放访问">
          <Switch
            size="small"
            checked={room.is_open}
            disabled={!isOwner}
            onChange={(checked) => handleUpdate({ is_open: checked })}
          />
        </Descriptions.Item>
      </Descriptions>

      {/* 推流地址 */}
      <div style={{ marginBottom: 'var(--spacing-card-gap)' }}>
        <Text strong style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>
          推流地址
        </Text>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
            <code
              style={{
                flex: 1,
                padding: '6px 10px',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--rounded-chip)',
                fontSize: 'var(--text-body-xs-size)',
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {room.push_url}
            </code>
            <Tooltip title="复制">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => copyToClipboard(room.push_url, '推流地址')}
              />
            </Tooltip>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
            <code
              style={{
                flex: 1,
                padding: '6px 10px',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--rounded-chip)',
                fontSize: 'var(--text-body-xs-size)',
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {room.rtmp_url}
            </code>
            <Tooltip title="复制">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => copyToClipboard(room.rtmp_url, 'RTMP 地址')}
              />
            </Tooltip>
          </div>
        </Space>
      </div>

      {/* 观看地址 */}
      <div style={{ marginBottom: 'var(--spacing-card-gap)' }}>
        <Text strong style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>
          观看地址
        </Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
          <code
            style={{
              flex: 1,
              padding: '6px 10px',
              background: 'var(--bg-tertiary)',
                borderRadius: 'var(--rounded-chip)',
                fontSize: 'var(--text-body-xs-size)',
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {room.watch_url}
          </code>
          <Tooltip title="复制">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(room.watch_url, '观看地址')}
            />
          </Tooltip>
        </div>
      </div>

      {/* 模式相关操作按钮 */}
      <div style={{ marginBottom: 'var(--spacing-card-gap)' }}>
        {room.mode === 'builtin' ? (
          <Button
            type="primary"
            icon={<EnterOutlined />}
            onClick={() => navigate(`/streaming/studio/${room.id}`)}
          >
            进入推流工作室
          </Button>
        ) : (
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--rounded-sm)',
              fontSize: 'var(--text-body-mono-size)',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              border: 'var(--border-width-thin) solid var(--border-tertiary)',
            }}
          >
            <Text strong style={{ display: 'block', marginBottom: 'var(--spacing-xxs)' }}>
              在 OBS 中填入此地址
            </Text>
            <code
              style={{
                display: 'block',
                padding: '6px 10px',
                background: 'var(--bg-primary)',
                borderRadius: 'var(--rounded-chip)',
                fontSize: 'var(--text-body-mono-size)',
                marginBottom: 'var(--spacing-xxs)',
                wordBreak: 'break-all',
              }}
            >
              {room.rtmp_url}
            </code>
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginTop: 6 }}>
              <Tooltip title="复制 RTMP 地址">
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => copyToClipboard(room.rtmp_url, 'RTMP 地址')}
                >
                  复制地址
                </Button>
              </Tooltip>
              <Tooltip title="复制推流地址">
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => copyToClipboard(room.push_url, '推流地址')}
                >
                  复制推流地址
                </Button>
              </Tooltip>
            </div>
          </div>
        )}
      </div>

      {/* 设置面板（仅房主可见，可折叠） */}
      {isOwner && (
        <Collapse
          size="small"
          items={[
            {
              key: 'settings',
              label: '房间设置',
              children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {editingName ? null : (
                    <div>
                      <Text style={{ display: 'block', marginBottom: 'var(--spacing-xxs)', color: 'var(--text-secondary)' }}>
                        房间名称
                      </Text>
                      <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                        <Input
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          style={{ flex: 1 }}
                          maxLength={50}
                        />
                        <Button
                          onClick={() => {
                            if (!nameInput.trim()) {
                              message.warning('房间名称不能为空');
                              return;
                            }
                            if (nameInput.trim() !== room.name) {
                              handleUpdate({ name: nameInput.trim() });
                            }
                          }}
                        >
                          保存
                        </Button>
                      </div>
                    </div>
                  )}

                  <div>
                    <Text style={{ display: 'block', marginBottom: 'var(--spacing-xxs)', color: 'var(--text-secondary)' }}>
                      推流模式
                    </Text>
                    <Radio.Group
                      value={room.mode}
                      onChange={(e) => handleUpdate({ mode: e.target.value })}
                    >
                      <Radio value="builtin">内置推流</Radio>
                      <Radio value="external">外部推流</Radio>
                    </Radio.Group>
                  </div>

                  <div>
                    <Text style={{ display: 'block', marginBottom: 'var(--spacing-xxs)', color: 'var(--text-secondary)' }}>
                      房间类型
                    </Text>
                    <Radio.Group
                      value={room.room_type}
                      onChange={(e) => handleUpdate({ room_type: e.target.value })}
                    >
                      <Radio value="temporary">临时</Radio>
                      <Radio value="permanent">常驻</Radio>
                    </Radio.Group>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ color: 'var(--text-secondary)' }}>开放访问</Text>
                    <Switch
                      checked={room.is_open}
                      onChange={(checked) => handleUpdate({ is_open: checked })}
                    />
                  </div>
                </Space>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
