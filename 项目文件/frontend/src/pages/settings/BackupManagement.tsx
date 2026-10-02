import { useEffect, useState, useCallback } from 'react';
import { Table, Button, Typography, Modal, message, Space, Card, Switch, InputNumber, Input, Result, Tooltip } from 'antd';
import { CloudServerOutlined, DeleteOutlined, ReloadOutlined, CloudDownloadOutlined, LockOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { createBackup, listBackups, deleteBackup, restoreBackup } from '../../api/backups';
import { getConfig, updateConfig } from '../../api/system_config';
import { isAdmin } from '../../utils/auth';
import type { BackupInfo, BackupConfig } from '../../types/backup';
import styles from './BackupManagement.module.css';

const { Title } = Typography;

export default function BackupManagement() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoreModal, setRestoreModal] = useState<{ open: boolean; filename: string }>({ open: false, filename: '' });
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreSubmitting, setRestoreSubmitting] = useState(false);
  const [config, setConfig] = useState<BackupConfig>({
    backup_dir: '/data/backups',
    schedule: 'daily',
    max_backups: 7,
    enabled: false,
  });

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listBackups();
      if (res.code === 0) {
        setBackups(res.data.items);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取备份列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await getConfig('backup_config');
      if (res.code === 0) {
        setConfig(res.data.value as unknown as BackupConfig);
      }
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    fetchBackups();
    fetchConfig();
  }, [fetchBackups, fetchConfig]);

  if (!isAdmin()) {
    return <Result status="403" title="权限不足" subTitle="只有管理员可以管理备份" icon={<LockOutlined />} />;
  }

  const handleCreate = async () => {
    try {
      const res = await createBackup();
      if (res.code === 0) {
        message.success('备份创建成功');
        fetchBackups();
      } else {
        message.error(res.msg || '备份创建失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '备份创建失败';
      message.error(msg);
    }
  };

  const handleDelete = (filename: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除备份 ${filename} 吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteBackup(filename);
          if (res.code === 0) {
            message.success('备份已删除');
            fetchBackups();
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '删除失败';
          message.error(msg);
        }
      },
    });
  };

  const handleRestore = (filename: string) => {
    Modal.confirm({
      title: '确认恢复',
      content: (
        <div>
          <p>确定要从 <strong>{filename}</strong> 恢复数据库与文件吗？</p>
          <p style={{ color: '#ff4d4f' }}>
            ⚠ 此操作将完全覆盖当前数据，不可撤销！系统会自动备份当前数据作为回退点。
          </p>
        </div>
      ),
      okText: '继续',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        setRestorePassword('');
        setRestoreModal({ open: true, filename });
      },
    });
  };

  const handleRestorePassword = async () => {
    if (!restorePassword) {
      message.warning('请输入管理员密码');
      return;
    }
    setRestoreSubmitting(true);
    try {
      const res = await restoreBackup(restoreModal.filename, restorePassword);
      if (res.code === 0) {
        message.success('备份恢复成功');
        setRestoreModal({ open: false, filename: '' });
        setRestorePassword('');
        fetchBackups();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '恢复失败';
      message.error(msg);
    } finally {
      setRestoreSubmitting(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      const res = await updateConfig('backup_config', config as unknown as Record<string, unknown>);
      if (res.code === 0) {
        message.success('配置已保存');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存失败';
      message.error(msg);
    }
  };

  const columns: ColumnsType<BackupInfo> = [
    { title: '文件名', dataIndex: 'filename', key: 'filename' },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size: number) => `${(size / 1024 / 1024).toFixed(2)} MB`,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '表数 / 文件数',
      key: 'counts',
      width: 110,
      render: (_: unknown, record: BackupInfo) =>
        record.table_count !== undefined || record.file_count !== undefined
          ? `${record.table_count ?? '-'} / ${record.file_count ?? '-'}`
          : '-',
    },
    {
      title: '校验和',
      dataIndex: 'checksum',
      key: 'checksum',
      width: 160,
      ellipsis: true,
      render: (text: string | undefined) =>
        text ? (
          <Tooltip title={text}>
            <span>{text.slice(0, 12)}...</span>
          </Tooltip>
        ) : (
          '-'
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, record: BackupInfo) => (
        <Space size="small">
          <Tooltip title="恢复">
            <Button
              type="link"
              size="small"
              icon={<CloudDownloadOutlined />}
              onClick={() => handleRestore(record.filename)}
           >
              恢复
            </Button>
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.filename)}
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
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>数据备份</Title>
      </div>

      <Card title="备份配置" className={styles.configCard ?? ''}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div className={styles.configRow ?? ''}>
            <span>启用自动备份</span>
            <Switch
              checked={config.enabled}
              onChange={(checked) => setConfig({ ...config, enabled: checked })}
            />
          </div>
          <div className={styles.configRow ?? ''}>
            <span>备份目录</span>
            <Input
              value={config.backup_dir}
              onChange={(e) => setConfig({ ...config, backup_dir: e.target.value })}
              style={{ width: 300 }}
            />
          </div>
          <div className={styles.configRow ?? ''}>
            <span>保留数量</span>
            <InputNumber
              value={config.max_backups}
              onChange={(value) => setConfig({ ...config, max_backups: value ?? 7 })}
              min={1}
              max={30}
            />
          </div>
          <Button type="primary" onClick={handleSaveConfig}>
            保存配置
          </Button>
        </Space>
      </Card>

      <div className={styles.header ?? ''}>
        <Button type="primary" icon={<CloudServerOutlined />} onClick={handleCreate}>
          立即备份
        </Button>
        <Button icon={<ReloadOutlined />} onClick={fetchBackups}>
          刷新
        </Button>
      </div>

      <Table<BackupInfo>
        className={styles.table ?? ''}
        columns={columns}
        dataSource={backups}
        rowKey="filename"
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t) => `共 ${t} 条`,
        }}
      />

      {/* 恢复二次验证弹窗 */}
      <Modal
        title={
          <Space>
            <LockOutlined />
            恢复验证
          </Space>
        }
        open={restoreModal.open}
        onOk={handleRestorePassword}
        onCancel={() => {
          setRestoreModal({ open: false, filename: '' });
          setRestorePassword('');
        }}
        okText="确认恢复"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        confirmLoading={restoreSubmitting}
        maskClosable={false}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <p>
            正在恢复：<strong>{restoreModal.filename}</strong>
          </p>
          <p style={{ color: '#ff4d4f' }}>
            此操作将完全覆盖当前数据。系统会自动备份当前数据作为回退点，
            恢复失败时自动回退。
          </p>
          <Input.Password
            placeholder="请输入管理员密码"
            value={restorePassword}
            onChange={(e) => setRestorePassword(e.target.value)}
            onPressEnter={handleRestorePassword}
            autoComplete="current-password"
          />
        </Space>
      </Modal>
    </div>
  );
}
