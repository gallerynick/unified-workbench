import { useState, useEffect } from 'react';
import { Button, Card, InputNumber, Progress, Result, Statistic, Typography, message } from 'antd';
import { SaveOutlined, LockOutlined } from '@ant-design/icons';
import { getStorageInfo, updateReservedSpace } from '../../api/file-shares';
import type { StorageInfo } from '../../api/file-shares';
import { isAdmin } from '../../utils/auth';
import styles from './StorageSettings.module.css';

const { Title, Text } = Typography;

export default function StorageSettings() {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [reserved, setReserved] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin()) return;
    let cancelled = false;
    getStorageInfo()
      .then((data) => {
        if (cancelled) return;
        setInfo(data);
        setReserved(data.reserved_space_gb);
      })
      .catch(() => {
        // 加载失败，保持默认值
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isAdmin()) {
    return (
      <Result
        status="403"
        title="权限不足"
        subTitle="只有管理员可以查看存储设置"
        icon={<LockOutlined />}
      />
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateReservedSpace(reserved);
      message.success('预留空间已更新');
    } catch {
      message.error('更新失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Card loading />;
  }

  const usedPercent =
    info && info.total_space_gb > 0
      ? Math.min(100, parseFloat(((info.used_space_gb / info.total_space_gb) * 100).toFixed(1)))
      : 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title level={4} className={styles.title ?? ''}>存储设置</Title>
      </div>
      <Card title="磁盘空间">
        <div className={styles.statsRow}>
          <Card className={styles.statCard ?? ''}>
            <Statistic title="总空间" value={info?.total_space_gb ?? 0} precision={2} suffix="GB" />
          </Card>
          <Card className={styles.statCard ?? ''}>
            <Statistic title="已使用" value={info?.used_space_gb ?? 0} precision={2} suffix="GB" />
          </Card>
          <Card className={styles.statCard ?? ''}>
            <Statistic title="剩余空间" value={info?.free_space_gb ?? 0} precision={2} suffix="GB" />
          </Card>
        </div>
        <div className={styles.progressBar}>
          <Progress percent={usedPercent} />
        </div>
        <div className={styles.reservedSection}>
          <Text>预留空间</Text>
          <InputNumber
            min={0}
            value={reserved}
            onChange={(value) => setReserved(value ?? 0)}
            addonAfter="GB"
            style={{ width: 160 }}
          />
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            保存
          </Button>
        </div>
      </Card>
    </div>
  );
}
