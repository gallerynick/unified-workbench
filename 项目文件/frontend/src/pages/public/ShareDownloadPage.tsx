import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Card, Input, Result, Spin, Typography } from 'antd';
import { FileOutlined, DownloadOutlined, LockOutlined } from '@ant-design/icons';
import {
  getPublicShareInfo,
  verifySharePassword,
  getShareDownloadUrl,
} from '../../api/file-shares';
import type { SharePublicInfo } from '../../api/file-shares';
import { HttpError } from '../../utils/request';
import styles from './ShareDownloadPage.module.css';

const { Text } = Typography;

type PageStatus = 'loading' | 'notFound' | 'error' | 'password' | 'verifying' | 'ready';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(1)} ${units[index]}`;
}

export default function ShareDownloadPage() {
  const { code } = useParams<{ code: string }>();
  const [status, setStatus] = useState<PageStatus>('loading');
  const [info, setInfo] = useState<SharePublicInfo | null>(null);
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!code) {
      setStatus('notFound');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    getPublicShareInfo(code)
      .then((data) => {
        if (cancelled) return;
        setInfo(data);
        setStatus(data.has_password ? 'password' : 'ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof HttpError && err.status === 404) {
          setStatus('notFound');
        } else {
          setStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const handleVerify = async () => {
    if (!code) return;
    if (!password.trim()) {
      return;
    }
    setStatus('verifying');
    try {
      const valid = await verifySharePassword(code, password.trim());
      if (valid) {
        setStatus('ready');
      } else {
        setStatus('password');
      }
    } catch {
      setStatus('password');
    }
  };

  const handleDownload = () => {
    if (!code) return;
    window.open(getShareDownloadUrl(code, password || undefined), '_blank', 'noopener,noreferrer');
  };

  if (status === 'loading') {
    return (
      <div className={styles.container}>
        <Spin size="large" />
      </div>
    );
  }

  if (status === 'notFound') {
    return (
      <div className={styles.container}>
        <Card className={styles.card ?? ''}>
          <Result status="404" title="404" subTitle="分享不存在或已过期" />
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.container}>
        <Card className={styles.card ?? ''}>
          <Result status="500" title="加载失败" subTitle="无法获取分享信息，请稍后重试" />
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Card className={styles.card ?? ''}>
        <div className={styles.fileIcon}>
          <FileOutlined />
        </div>
        <div className={styles.fileName}>{info?.original_name}</div>
        {info && (
          <div className={styles.meta}>
            <Text>文件大小：{formatFileSize(info.file_size)}</Text>
            <Text>过期时间：{new Date(info.expires_at).toLocaleString()}</Text>
            <Text>
              下载次数：{info.download_count}
              {info.max_downloads != null ? ` / ${info.max_downloads}` : ''}
            </Text>
          </div>
        )}
        {(status === 'password' || status === 'verifying') && (
          <div className={styles.passwordSection}>
            <div className={styles.passwordInput}>
              <Input.Password
                placeholder="请输入分享密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onPressEnter={handleVerify}
                disabled={status === 'verifying'}
                prefix={<LockOutlined />}
              />
            </div>
            <Button type="primary" loading={status === 'verifying'} onClick={handleVerify}>
              验证
            </Button>
          </div>
        )}
        {status === 'ready' && (
          <Button
            type="primary"
            size="large"
            icon={<DownloadOutlined />}
            className={styles.downloadButton ?? ''}
            onClick={handleDownload}
          >
            下载文件
          </Button>
        )}
      </Card>
    </div>
  );
}
