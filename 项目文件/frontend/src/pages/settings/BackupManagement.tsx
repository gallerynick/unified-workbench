import { useEffect, useState, useCallback } from 'react';
import { Table, Button, Typography, Modal, message, Space, Card, Switch, InputNumber, Input, Result } from 'antd';
import { CloudServerOutlined, DeleteOutlined, ReloadOutlined, CloudDownloadOutlined, LockOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { createBackup, listBackups, deleteBackup, restoreBackup } from '../../api/backups';
import { getConfig, updateConfig } from '../../api/system_config';
import { isAdmin } from '../../utils/auth';
import type { BackupInfo } from '../../types/backup';
import type { BackupConfig } from '../../types/backup';
import styles from './BackupManagement.module.css';

const { Title } = Typography;

export default function BackupManagement() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
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
      okType: 'danger',
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
      content: `确定要从 ${filename} 恢复数据库吗？此操作不可撤销！`,
      okText: '恢复',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await restoreBackup(filename);
          if (res.code === 0) {
            message.success('备份恢复成功');
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '恢复失败';
          message.error(msg);
        }
      },
    });
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
      render: (size: number) => `${(size / 1024 / 1024).toFixed(2)} MB`,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: BackupInfo) => (
        <Space>
          <Button
            type="link"
            icon={<CloudDownloadOutlined />}
            onClick={() => handleRestore(record.filename)}
          >
            恢复
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.filename)}
          >
            删除
          </Button>
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
        columns={columns}
        dataSource={backups}
        rowKey="filename"
        loading={loading}
      />
    </div>
  );
}
