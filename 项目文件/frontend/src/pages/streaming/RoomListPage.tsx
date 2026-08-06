import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Tag,
  Badge,
  Switch,
  Typography,
  Space,
  Popconfirm,
  Modal,
  Descriptions,
  message,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EnterOutlined,
  SettingOutlined,
  PoweroffOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { listRooms, deleteRoom, updateRoom } from '../../api/stream';
import type { StreamRoom } from '../../types/stream';
import { getUserId, isAdmin } from '../../utils/auth';
import CreateRoomModal from '../../components/streaming/CreateRoomModal';
import styles from './RoomListPage.module.css';

const { Title, Paragraph } = Typography;

const MODE_LABELS: Record<string, { text: string; color: string }> = {
  builtin: { text: '内置推流', color: 'blue' },
  external: { text: '外部推流', color: 'cyan' },
};

const ROOM_TYPE_LABELS: Record<string, { text: string; color: string }> = {
  temporary: { text: '临时', color: 'orange' },
  permanent: { text: '常驻', color: 'green' },
};

export default function RoomListPage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<StreamRoom[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [manageRoom, setManageRoom] = useState<StreamRoom | null>(null);
  const [permissionVisible, setPermissionVisible] = useState(false);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        page_size: String(pageSize),
      };
      if (search) params.search = search;
      if (modeFilter) params.mode = modeFilter;
      if (typeFilter) params.room_type = typeFilter;
      if (activeFilter) params.is_active = activeFilter;

      const res = await listRooms(params);
      if (res.code === 0) {
        setRooms(res.data.items);
        setTotal(res.data.total);
      } else {
        message.error(res.msg || '获取房间列表失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取房间列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, modeFilter, typeFilter, activeFilter]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleToggleOpen = async (roomId: string, isOpen: boolean) => {
    try {
      const res = await updateRoom(roomId, { is_open: isOpen });
      if (res.code === 0) {
        fetchRooms();
      } else {
        message.error(res.msg || '更新失败');
      }
    } catch {
      message.error('更新失败');
    }
  };

  const handleDelete = (record: StreamRoom) => {
    return new Promise<void>((resolve, reject) => {
      deleteRoom(record.id)
        .then((res) => {
          if (res.code === 0) {
            message.success('房间已删除');
            fetchRooms();
            resolve();
          } else {
            message.error(res.msg || '删除失败');
            reject(new Error(res.msg || '删除失败'));
          }
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : '删除失败';
          message.error(msg);
          reject(err);
        });
    });
  };

  const handleForceClose = async (room: StreamRoom) => {
    try {
      const res = await updateRoom(room.id, { is_active: false });
      if (res.code === 0) {
        message.success('直播间已强制关闭');
        setManageRoom(null);
        fetchRooms();
      } else {
        message.error(res.msg || '关闭失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '关闭失败';
      message.error(msg);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleModeFilter = (value: string) => {
    setModeFilter(value);
    setPage(1);
  };

  const handleTypeFilter = (value: string) => {
    setTypeFilter(value);
    setPage(1);
  };

  const handleActiveFilter = (value: string) => {
    setActiveFilter(value);
    setPage(1);
  };

  const currentUserId = getUserId();

  const columns: ColumnsType<StreamRoom> = [
    {
      title: '房间名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: true,
      render: (name: string, record: StreamRoom) => (
        <Button
          type="link"
          className={styles.roomNameLink ?? ''}
          onClick={() => navigate(`/streaming/studio/${record.id}`)}
        >
          {name}
        </Button>
      ),
    },
    {
      title: '创建者',
      dataIndex: 'creator_nickname',
      key: 'creator_nickname',
      width: 120,
      ellipsis: true,
      render: (nickname: string | undefined) => nickname || '-',
    },
    {
      title: '推流模式',
      dataIndex: 'mode',
      key: 'mode',
      width: 110,
      render: (mode: string) => {
        const cfg = MODE_LABELS[mode];
        return cfg ? <Tag color={cfg.color}>{cfg.text}</Tag> : <Tag>{mode}</Tag>;
      },
    },
    {
      title: '房间类型',
      dataIndex: 'room_type',
      key: 'room_type',
      width: 100,
      render: (roomType: string) => {
        const cfg = ROOM_TYPE_LABELS[roomType];
        return cfg ? <Tag color={cfg.color}>{cfg.text}</Tag> : <Tag>{roomType}</Tag>;
      },
    },
    {
      title: '活跃',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (active: boolean) => (
        <Badge status={active ? 'success' : 'default'} text={active ? '活跃' : '离线'} />
      ),
    },
    {
      title: '开放访问',
      dataIndex: 'is_open',
      key: 'is_open',
      width: 100,
      render: (_open: boolean, record: StreamRoom) => (
        <Switch
          size="small"
          checked={record.is_open}
          onChange={(checked) => handleToggleOpen(record.id, checked)}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: unknown, record: StreamRoom) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EnterOutlined />}
            onClick={() => navigate(`/streaming/studio/${record.id}`)}
          >
            进入
          </Button>
          {isAdmin() && (
            <Button
              type="link"
              size="small"
              icon={<SettingOutlined />}
              onClick={() => setManageRoom(record)}
            >
              管理
            </Button>
          )}
          {(currentUserId === record.creator_id) && (
            <Popconfirm
              title="确认删除"
              description={`确定要删除房间「${record.name}」吗？`}
              onConfirm={() => handleDelete(record)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
              >
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>直播工作室</Title>
        <Space wrap>
          <Input
            placeholder="搜索房间名"
            prefix={<SearchOutlined style={{ color: 'var(--text-secondary)' }} />}
            allowClear
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            variant="filled"
            className={styles.searchInput ?? ''}
          />
          <Select
            placeholder="推流模式"
            allowClear
            className={styles.filterSelect ?? ''}
            onChange={handleModeFilter}
            options={[
              { value: 'builtin', label: '内置推流' },
              { value: 'external', label: '外部推流' },
            ]}
          />
          <Select
            placeholder="房间类型"
            allowClear
            className={styles.filterSelect ?? ''}
            onChange={handleTypeFilter}
            options={[
              { value: 'temporary', label: '临时' },
              { value: 'permanent', label: '常驻' },
            ]}
          />
          <Select
            placeholder="活跃状态"
            allowClear
            className={styles.filterSelect ?? ''}
            onChange={handleActiveFilter}
            options={[
              { value: 'true', label: '活跃' },
              { value: 'false', label: '离线' },
            ]}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            新建房间
          </Button>
          <Tooltip title="权限说明">
            <Button
              type="text"
              size="small"
              icon={<QuestionCircleOutlined />}
              onClick={() => setPermissionVisible(true)}
            />
          </Tooltip>
        </Space>
      </div>

      <Table<StreamRoom>
        className={styles.table ?? ''}
        columns={columns}
        dataSource={rooms}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title="房间管理"
        open={manageRoom !== null}
        onCancel={() => setManageRoom(null)}
        footer={null}
        destroyOnClose
        width={480}
        styles={{
          body: { padding: 'var(--modal-padding)' },
          content: {
            background: 'var(--modal-bg)',
            borderRadius: 'var(--modal-rounded)',
            boxShadow: 'var(--modal-shadow)',
          },
        }}
      >
        {manageRoom && (
          <div className={styles.manageBody ?? ''}>
            <Descriptions
              size="small"
              column={1}
              items={[
                { key: 'name', label: '房间名称', children: manageRoom.name },
                { key: 'creator', label: '创建者', children: manageRoom.creator_nickname || '-' },
                {
                  key: 'status',
                  label: '状态',
                  children: manageRoom.is_active ? '活跃' : '离线',
                },
              ]}
            />
            <div className={styles.manageActions ?? ''}>
              <Space>
                {manageRoom.is_active && (
                  <Button
                    icon={<PoweroffOutlined />}
                    onClick={() => handleForceClose(manageRoom)}
                  >
                    强制关闭
                  </Button>
                )}
                <Popconfirm
                  title="确认删除"
                  description={`确定要删除房间「${manageRoom.name}」吗？删除后不可恢复。`}
                  onConfirm={async () => {
                    await handleDelete(manageRoom);
                    setManageRoom(null);
                  }}
                  okText="删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger icon={<DeleteOutlined />}>
                    删除直播间
                  </Button>
                </Popconfirm>
              </Space>
            </div>
          </div>
        )}
      </Modal>

      <CreateRoomModal
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreated={() => {
          setCreateModalVisible(false);
          fetchRooms();
        }}
      />

      <Modal
        title="权限说明"
        open={permissionVisible}
        width={560}
        footer={null}
        onCancel={() => setPermissionVisible(false)}
        destroyOnClose
      >
        <div>
          <Title level={5}>
            查看与进入
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>所有成员都可以查看直播间列表并进入直播间观看。</Paragraph>
          <Title level={5}>
            创建权限
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>所有成员都可以创建直播间，创建者默认为该房间的管理员。</Paragraph>
          <Title level={5}>
            开放访问
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>开启开放访问后所有成员均可进入直播间；关闭后仅房间创建者和管理员可进入。</Paragraph>
          <Title level={5}>
            删除权限
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>房间创建者可以删除自己创建的直播间。</Paragraph>
          <Title level={5}>
            管理员
          </Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>系统管理员可以管理所有直播间，包括强制关闭和删除任何直播间。</Paragraph>
        </div>
      </Modal>
    </div>
  );
}
