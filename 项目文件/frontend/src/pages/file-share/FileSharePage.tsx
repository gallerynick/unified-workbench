import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Typography, Modal, Space, message, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
import { listFileShares, deleteFileShare } from '../../api/file-shares';
import type { FileShareRecord } from '../../types/file-share';
import ShareUploadModal from './ShareUploadModal';
import ShareSettingsModal from './ShareSettingsModal';
import styles from './FileSharePage.module.css';

const { Title, Text } = Typography;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN');
}

export function FileSharePage() {
  const [records, setRecords] = useState<FileShareRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [settingsRecord, setSettingsRecord] = useState<FileShareRecord | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listFileShares(page, pageSize);
      if (res.code === 0) {
        setRecords(res.data.items);
        setTotal(res.data.total);
      } else {
        message.error(res.msg || '获取分享列表失败');
      }
    } catch {
      message.error('获取分享列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleDelete = (record: FileShareRecord) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除「${record.original_name}」的分享吗？删除后分享链接将立即失效。`,
      okText: '删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const res = await deleteFileShare(record.id);
          if (res.code === 0) {
            message.success('分享已删除');
            fetchRecords();
          } else {
            message.error(res.msg || '删除失败');
          }
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const columns: ColumnsType<FileShareRecord> = [
    {
      title: '文件名',
      dataIndex: 'original_name',
      key: 'original_name',
      ellipsis: true,
    },
    {
      title: '大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 110,
      render: (size: number) => formatBytes(size),
    },
    {
      title: '分享码',
      dataIndex: 'share_code',
      key: 'share_code',
      width: 150,
      render: (code: string) => <Text copyable={{ text: code }}>{code}</Text>,
    },
    {
      title: '下载次数',
      dataIndex: 'download_count',
      key: 'download_count',
      width: 100,
    },
    {
      title: '过期时间',
      dataIndex: 'expires_at',
      key: 'expires_at',
      width: 170,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '操作',
      key: 'actions',
      width: 110,
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title="设置">
            <Button
              type="link"
              size="small"
              icon={<SettingOutlined />}
              onClick={() => setSettingsRecord(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <Title level={4} className={styles.title ?? ''}>
          文件共享
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setUploadVisible(true)}>
          上传分享
        </Button>
      </div>

      <Table<FileShareRecord>
        rowKey="id"
        columns={columns}
        dataSource={records}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <ShareUploadModal
        visible={uploadVisible}
        onClose={() => setUploadVisible(false)}
        onSuccess={() => {
          setUploadVisible(false);
          fetchRecords();
        }}
      />

      <ShareSettingsModal
        record={settingsRecord}
        onClose={() => setSettingsRecord(null)}
        onSuccess={() => {
          setSettingsRecord(null);
          fetchRecords();
        }}
      />
    </div>
  );
}

export default FileSharePage;
