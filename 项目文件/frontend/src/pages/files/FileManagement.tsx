import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Input,
  Tag,
  Typography,
  Modal,
  DatePicker,
  message,
  Space,
  Tooltip,
} from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  SearchOutlined,
  FileOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  FilePptOutlined,
  FileZipOutlined,
  LinkOutlined,
  WarningOutlined,
  EditOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { listFiles, deleteFile, listFolders, updateFile } from '../../api/files';
import { getToken } from '../../utils/auth';
import type { FileRecord, Folder } from '../../types/file';
import { getVisibilityConfig } from '../../utils/visibility';
import FileUploadModal from './FileUploadModal';
import FolderTree from './FolderTree';
import styles from './FileManagement.module.css';

const { Title } = Typography;

// 检查文件是否受文件夹统一管理
function isFileManagedByFolder(file: FileRecord, folders: Folder[]): boolean {
  if (!file.folder_id) return false;
  const folder = folders.find((f) => f.id === file.folder_id);
  return folder?.unified_management ?? false;
}

// 获取文件所在文件夹名称
function getFileFolderName(file: FileRecord, folders: Folder[]): string | null {
  if (!file.folder_id) return null;
  const folder = folders.find((f) => f.id === file.folder_id);
  return folder?.name ?? null;
}

// 根据 MIME 类型获取图标
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <FileImageOutlined className={styles.fileIcon ?? ''} />;
  if (mimeType === 'application/pdf') return <FilePdfOutlined className={styles.fileIcon ?? ''} />;
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet'))
    return <FileExcelOutlined className={styles.fileIcon ?? ''} />;
  if (mimeType.includes('word') || mimeType.includes('document'))
    return <FileWordOutlined className={styles.fileIcon ?? ''} />;
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation'))
    return <FilePptOutlined className={styles.fileIcon ?? ''} />;
  if (mimeType.includes('zip') || mimeType.includes('rar'))
    return <FileZipOutlined className={styles.fileIcon ?? ''} />;
  return <FileOutlined className={styles.fileIcon ?? ''} />;
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 格式化日期
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 检查文件是否已过期
function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

export default function FileManagement() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [editExpireModalVisible, setEditExpireModalVisible] = useState(false);
  const [editingFile, setEditingFile] = useState<FileRecord | null>(null);
  const [editExpireValue, setEditExpireValue] = useState<Dayjs | null>(null);
  const [editExpireSaving, setEditExpireSaving] = useState(false);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const params: { folder_id?: string; page?: number; page_size?: number } = {
        page,
        page_size: pageSize,
      };
      if (selectedFolderId) {
        params.folder_id = selectedFolderId;
      }
      const res = await listFiles(params);
      if (res.code === 0) {
        setFiles(res.data.items);
        setTotal(res.data.total);
      } else {
        message.error(res.msg || '获取文件列表失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取文件列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedFolderId, page, pageSize]);

  const fetchFolders = useCallback(async () => {
    try {
      const res = await listFolders();
      if (res.code === 0) {
        setFolders(res.data);
      }
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleFolderSelect = (folderId: string | null) => {
    setSelectedFolderId(folderId);
    setPage(1);
  };

  const handleDelete = (file: FileRecord) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除文件「${file.name}」吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteFile(file.id);
          if (res.code === 0) {
            message.success('文件已删除');
            fetchFiles();
          } else {
            message.error(res.msg || '删除失败');
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '删除失败';
          message.error(msg);
        }
      },
    });
  };

  const handleDownload = async (file: FileRecord) => {
    try {
      const token = getToken();
      const res = await fetch(`/api/v1/files/${file.id}/download`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (!res.ok) throw new Error('下载失败');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error('文件下载失败');
    }
  };

  const handleUploadSuccess = () => {
    setUploadModalVisible(false);
    fetchFiles();
    fetchFolders();
  };

  const handleOpenEditExpire = (file: FileRecord) => {
    setEditingFile(file);
    setEditExpireValue(null);
    setEditExpireModalVisible(true);
  };

  const handleSaveExpire = async () => {
    if (!editingFile) return;
    setEditExpireSaving(true);
    try {
      const res = await updateFile(editingFile.id, {
        expires_at: editExpireValue ? editExpireValue.toISOString() : null,
      });
      if (res.code === 0) {
        message.success('过期时间已更新');
        setEditExpireModalVisible(false);
        setEditingFile(null);
        fetchFiles();
      } else {
        message.error(res.msg || '更新失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '更新失败';
      message.error(msg);
    } finally {
      setEditExpireSaving(false);
    }
  };

  // 搜索过滤
  const filteredFiles = search
    ? files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : files;

  const columns: ColumnsType<FileRecord> = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: FileRecord) => (
        <div className={styles.fileNameCell ?? ''}>
          {getFileIcon(record.mime_type)}
          <span>{name}</span>
        </div>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '类型',
      dataIndex: 'mime_type',
      key: 'mime_type',
      width: 120,
      render: (mimeType: string) => {
        const ext = mimeType.split('/').pop()?.toUpperCase() ?? mimeType;
        return <Tag>{ext}</Tag>;
      },
    },
    {
      title: '可见性',
      dataIndex: 'visibility',
      key: 'visibility',
      width: 120,
      render: (_: unknown, record: FileRecord) => {
        const cfg = getVisibilityConfig(record.visibility);
        const isManaged = isFileManagedByFolder(record, folders);
        const folderName = getFileFolderName(record, folders);
        return (
          <Space direction="vertical" size={2}>
            <Tag color={cfg.color}>{cfg.text}</Tag>
            {record.visibility === 'restricted' && record.restricted_users && record.restricted_users.length > 0 && (
              <span style={{ fontSize: 11, color: '#999' }}>
                {record.restricted_users.length} 个用户
              </span>
            )}
            {isManaged && folderName && (
              <Tooltip title={`此文件受文件夹「${folderName}」统一管理，设置将继承自文件夹`}>
                <Tag icon={<LinkOutlined />} color="processing" style={{ fontSize: 11, lineHeight: '18px' }}>
                  继承自文件夹
                </Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => formatDate(date),
    },
    {
      title: '过期时间',
      dataIndex: 'expires_at',
      key: 'expires_at',
      width: 200,
      render: (expiresAt: string | null, record: FileRecord) => {
        if (isFileManagedByFolder(record, folders)) {
          return <Tag color="blue">继承自文件夹</Tag>;
        }
        if (!expiresAt) {
          return <Tag>未设置</Tag>;
        }
        const expired = isExpired(expiresAt);
        return (
          <Space size={4}>
            {expired && (
              <Tag icon={<WarningOutlined />} color="warning">已过期</Tag>
            )}
            <span style={{ color: expired ? '#ff4d4f' : undefined, fontSize: 13 }}>
              {formatDate(expiresAt)}
            </span>
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: FileRecord) => (
        <Space size="small">
          <Tooltip title="下载">
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
            >
              下载
            </Button>
          </Tooltip>
          <Tooltip title={isFileManagedByFolder(record, folders) ? '文件受文件夹统一管理，无法单独编辑' : '编辑过期时间'}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEditExpire(record)}
              disabled={isFileManagedByFolder(record, folders)}
            >
              过期
            </Button>
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            >
              删除
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.sidebar ?? ''}>
        <FolderTree
          selectedFolderId={selectedFolderId}
          onSelect={handleFolderSelect}
        />
      </div>

      <div className={styles.main ?? ''}>
        <div className={styles.header ?? ''}>
          <Title level={4} className={styles.title ?? ''}>
            文件管理
          </Title>
          <Space>
            <Input
              placeholder="搜索文件名"
              prefix={<SearchOutlined />}
              allowClear
              className={styles.searchInput ?? ''}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setUploadModalVisible(true)}
            >
              上传文件
            </Button>
          </Space>
        </div>

        <Table<FileRecord>
          className={styles.table ?? ''}
          columns={columns}
          dataSource={filteredFiles}
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
      </div>

      <FileUploadModal
        visible={uploadModalVisible}
        folders={folders}
        currentFolderId={selectedFolderId}
        onClose={() => setUploadModalVisible(false)}
        onSuccess={handleUploadSuccess}
      />

      <Modal
        title={`编辑过期时间 - ${editingFile?.name ?? ''}`}
        open={editExpireModalVisible}
        onOk={handleSaveExpire}
        onCancel={() => {
          setEditExpireModalVisible(false);
          setEditingFile(null);
        }}
        okText="保存"
        cancelText="取消"
        confirmLoading={editExpireSaving}
        destroyOnClose
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {editingFile?.expires_at && !isExpired(editingFile.expires_at) && (
            <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)' }}>
              当前过期时间：{formatDate(editingFile.expires_at)}
            </span>
          )}
          {editingFile?.expires_at && isExpired(editingFile.expires_at) && (
            <Tag icon={<WarningOutlined />} color="warning" style={{ alignSelf: 'flex-start' }}>
              文件已过期
            </Tag>
          )}
          <DatePicker
            showTime
            format="YYYY-MM-DD HH:mm"
            placeholder="选择新的过期时间（留空表示清除）"
            value={editExpireValue}
            onChange={setEditExpireValue}
            disabledDate={(current) => current && current.isBefore(Date.now(), 'day')}
            style={{ width: '100%' }}
            allowClear
          />
        </div>
      </Modal>
    </div>
  );
}
