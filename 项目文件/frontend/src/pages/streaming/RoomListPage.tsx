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
  message,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EnterOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { listRooms, deleteRoom, updateRoom } from '../../api/stream';
import type { StreamRoom } from '../../types/stream';
import { getUserId } from '../../utils/auth';
import CreateRoomModal from '../../components/streaming/CreateRoomModal';
import styles from './RoomListPage.module.css';

const { Title } = Typography;

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
      width: 160,
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
          <Input.Search
            placeholder="搜索房间名"
            allowClear
            className={styles.searchInput ?? ''}
            onSearch={handleSearchChange}
            onChange={(e) => {
              if (!e.target.value) handleSearchChange('');
            }}
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

      <CreateRoomModal
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreated={() => {
          setCreateModalVisible(false);
          fetchRooms();
        }}
      />
    </div>
  );
}
