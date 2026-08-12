import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Typography, Modal, Space, message, Tooltip, Input, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, DeleteOutlined, SettingOutlined, ShareAltOutlined, CopyOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { listFileShares, deleteFileShare } from '../../api/file-shares';
import { QRCodeSVG } from 'qrcode.react';
import type { FileShareRecord } from '../../types/file-share';
import ShareUploadModal from './ShareUploadModal';
import ShareSettingsModal from './ShareSettingsModal';
import styles from './FileSharePage.module.css';

const { Title, Paragraph, Text } = Typography;

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
  const [qrRecord, setQrRecord] = useState<FileShareRecord | null>(null);
  const [permissionVisible, setPermissionVisible] = useState(false);

  const getShareUrls = (code: string) => {
    const path = `/share/${code}`;
    const protocol = window.location.protocol;
    const local = `${protocol}//localhost${path}`;
    const network = `${protocol}//${window.location.hostname}${path}`;
    return { local, network };
  };

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

  // 每 30 秒刷新一次数据，驱动"已过期但未清理"记录的自动清理倒计时
  useEffect(() => {
    const hasExpiring = records.some((r) => r.is_expired && !r.deleted_at);
    if (!hasExpiring) return;

    const timer = setInterval(() => {
      fetchRecords();
    }, 30000);

    return () => clearInterval(timer);
  }, [records, fetchRecords]);

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
      render: (name: string) => name,
    },
    {
      title: '大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 110,
      render: (size: number) => formatBytes(size),
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
      title: '状态',
      key: 'status',
      width: 180,
      render: (_, record) => {
        // 已清理（物理文件已被 Celery 清理，仅保留记录）
        if (record.deleted_at) {
          return <Tag>已清理</Tag>;
        }
        // 已过期但未清理：展示自动清理倒计时（过期后 10 分钟宽限期）
        if (record.is_expired) {
          const expiresAt = new Date(record.expires_at).getTime();
          const cleanupAt = expiresAt + 10 * 60 * 1000;
          const now = Date.now();
          const remaining = Math.max(0, cleanupAt - now);

          if (remaining <= 0) {
            return <Tag color="red">已过期</Tag>;
          }

          const minutes = Math.floor(remaining / 60000);
          return (
            <span>
              <Tag color="red">已过期</Tag>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {minutes} 分后清理
              </span>
            </span>
          );
        }
        // 正常
        return <Tag color="green">正常</Tag>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title="共享">
            <Button
              type="link"
              size="small"
              icon={<ShareAltOutlined />}
              aria-label="分享"
              onClick={() => setQrRecord(record)}
            />
          </Tooltip>
          <Tooltip title="设置">
            <Button
              type="link"
              size="small"
              icon={<SettingOutlined />}
              aria-label="设置"
              onClick={() => setSettingsRecord(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label="删除"
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title level={4} className={styles.title ?? ''}>
          文件共享
        </Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setUploadVisible(true)}>
            上传分享
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

      <Table<FileShareRecord>
        className={styles.table ?? ''}
        rowKey="id"
        columns={columns}
        dataSource={records}
        loading={loading}
        rowClassName={(record) => (record.is_expired ? (styles.expiredRow ?? '') : '')}
        pagination={{
          current: page,
          pageSize,
          total,
          showQuickJumper: true,
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

      <Modal
        title="分享"
        open={!!qrRecord}
        onCancel={() => setQrRecord(null)}
        footer={null}
        width={420}
        destroyOnClose
      >
        {qrRecord && (
          <div style={{ textAlign: 'left' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <QRCodeSVG
                value={getShareUrls(qrRecord.share_code).network}
                size={200}
                level="M"
                includeMargin
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>分享码</Text>
              <Input
                value={qrRecord.share_code}
                readOnly
                suffix={
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    aria-label="复制"
                    onClick={() => {
                      navigator.clipboard.writeText(qrRecord.share_code);
                      message.success('已复制');
                    }}
                  />
                }
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <Text strong>内网下载地址</Text>
              <Input
                value={getShareUrls(qrRecord.share_code).network}
                readOnly
                suffix={
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    aria-label="复制"
                    onClick={() => {
                      navigator.clipboard.writeText(getShareUrls(qrRecord.share_code).network);
                      message.success('已复制');
                    }}
                  />
                }
                style={{ marginTop: 4 }}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="权限说明"
        open={permissionVisible}
        width={560}
        footer={null}
        onCancel={() => setPermissionVisible(false)}
        destroyOnClose
      >
        <div>
          <Title level={5}>创建分享</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>所有成员都可以上传文件创建分享。</Paragraph>

          <Title level={5}>管理</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>分享创建者可以修改分享设置（密码、有效期、下载次数）和删除分享。</Paragraph>

          <Title level={5}>访问</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>拥有分享链接的任何人（包括未登录用户）都可以通过密码验证后下载。</Paragraph>

          <Title level={5}>自动清理</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>过期的分享文件会在宽限期（10分钟）后自动清理。</Paragraph>

          <Title level={5}>管理员</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>系统管理员可以管理所有分享记录和存储设置。</Paragraph>
        </div>
      </Modal>
    </div>
  );
}

export default FileSharePage;
