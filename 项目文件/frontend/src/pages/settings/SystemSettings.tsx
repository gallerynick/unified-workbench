import { useState, useEffect } from 'react';
import { Button, Card, Tag, message, Modal, Input, Space, Typography } from 'antd';
import { ReloadOutlined, CloudDownloadOutlined, SaveOutlined } from '@ant-design/icons';
import { checkUpdate, performUpdate, getRepo, setRepo, getToken, setToken } from '../../api/system';
import type { UpdateInfo, RepoInfo } from '../../api/system';
import type { UnifiedResponse } from '../../types/user';
import styles from './SystemSettings.module.css';

const { Title } = Typography;

export default function SystemSettings() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [repo, setRepoValue] = useState('');
  const [editingRepo, setEditingRepo] = useState('');
  const [savingRepo, setSavingRepo] = useState(false);
  const [editingToken, setEditingToken] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const repoRes: UnifiedResponse<RepoInfo> = await getRepo();
        if (repoRes.code === 0) {
          setRepoValue(repoRes.data.repo);
          setEditingRepo(repoRes.data.repo);
        }
      } catch (e) { console.warn('Failed to load settings:', e); }
      try {
        const tokenRes = await getToken();
        if (tokenRes.code === 0 && tokenRes.data.has_token) {
          setHasToken(true);
          setEditingToken('••••••••••••••••');
        }
      } catch (e) { console.warn('Failed to load settings:', e); }
    };
    loadConfig();
  }, []);

  const handleSaveRepo = async () => {
    if (!editingRepo.trim()) {
      message.warning('请输入仓库地址');
      return;
    }
    setSavingRepo(true);
    try {
      const res: UnifiedResponse<RepoInfo> = await setRepo(editingRepo);
      if (res.code === 0) {
        setRepoValue(res.data.repo);
        message.success('仓库地址已更新');
      } else {
        message.error(res.msg || '保存失败');
      }
    } catch {
      message.error('保存失败');
    } finally {
      setSavingRepo(false);
    }
  };

  const handleSaveToken = async () => {
    if (!editingToken.trim() || editingToken === '••••••••••••••••') {
      message.warning('请输入新的 GitHub Token');
      return;
    }
    setSavingToken(true);
    try {
      const res = await setToken(editingToken);
      if (res.code === 0) {
        setHasToken(true);
        setEditingToken('••••••••••••••••');
        message.success('GitHub Token 已保存');
      } else {
        message.error(res.msg || '保存失败');
      }
    } catch {
      message.error('保存失败');
    } finally {
      setSavingToken(false);
    }
  };

  const handleClearToken = () => {
    setEditingToken('');
    setHasToken(false);
  };

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      const res: UnifiedResponse<UpdateInfo> = await checkUpdate();
      if (res.code === 0) {
        setUpdateInfo(res.data);
        if (res.data.available) {
          message.info(`发现新版本 v${res.data.remote}`);
        } else if (res.data.error) {
          message.warning(res.data.error);
        } else {
          message.success('当前已是最新版本');
        }
      }
    } catch {
      message.error('检查更新失败');
    } finally {
      setChecking(false);
    }
  };

  const handleUpdate = () => {
    Modal.confirm({
      title: '确认更新',
      content: `确定要更新到 v${updateInfo?.remote} 吗？更新过程中服务将重启。`,
      okText: '更新',
      cancelText: '取消',
      onOk: async () => {
        setUpdating(true);
        try {
          const res = await performUpdate();
          if (res.code === 0 && res.data.success) {
            message.success('更新成功，服务正在重启...');
            setTimeout(() => window.location.reload(), 5000);
          } else {
            message.error(res.data.error || '更新失败');
          }
        } catch {
          message.error('更新失败');
        } finally {
          setUpdating(false);
        }
      },
    });
  };

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>系统更新</Title>
      </div>
      <Card title="更新仓库配置">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <div style={{ marginBottom: 8 }}>GitHub 仓库地址（格式：owner/repo）：</div>
            <Space>
              <Input
                value={editingRepo}
                onChange={(e) => setEditingRepo(e.target.value)}
                placeholder="gallerynick/unified-workbench"
                style={{ width: 300 }}
              />
              <Button
                icon={<SaveOutlined />}
                onClick={handleSaveRepo}
                loading={savingRepo}
              >
                保存
              </Button>
            </Space>
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              默认地址：gallerynick/unified-workbench
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 8 }}>
              GitHub Token（私有仓库必须）：
              {hasToken && <Tag color="green" style={{ marginLeft: 8 }}>已配置</Tag>}
            </div>
            <Space>
              <Input.Password
                value={editingToken}
                onChange={(e) => setEditingToken(e.target.value)}
                onFocus={() => { if (editingToken === '••••••••••••••••') setEditingToken(''); }}
                placeholder="ghp_xxxxxxxxxxxx"
                style={{ width: 300 }}
                allowClear
              />
              <Button
                icon={<SaveOutlined />}
                onClick={handleSaveToken}
                loading={savingToken}
              >
                保存
              </Button>
              {hasToken && (
                <Button danger onClick={handleClearToken}>
                  清除
                </Button>
              )}
            </Space>
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              用于访问私有仓库，需要 repo 权限。生成地址：GitHub → Settings → Developer settings → Personal access tokens
            </div>
          </div>
        </Space>
      </Card>

      <Card title="系统更新">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text type="secondary">本地版本：</Text>
            <Text strong>v{updateInfo?.current || '未知'}</Text>
          </div>
          <div>
            <Text type="secondary">仓库最新：</Text>
            <Text strong>{updateInfo?.remote ? `v${updateInfo.remote}` : (updateInfo ? '无法获取' : '检查中...')}</Text>
            {updateInfo?.available && <Tag color="green" style={{ marginLeft: 8 }}>新版本可用</Tag>}
          </div>
          <div>
            <Text type="secondary">仓库地址：</Text>
            <Text>{repo || 'gallerynick/unified-workbench'}</Text>
          </div>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleCheckUpdate}
              loading={checking}
            >
              检查更新
            </Button>
            {updateInfo?.available && (
            <Button
              type="primary"
              icon={<CloudDownloadOutlined />}
              onClick={handleUpdate}
              loading={updating}
            >
              立即更新
            </Button>
          )}
          </Space>
        </Space>
        {updateInfo?.release_notes && (
          <div style={{ marginTop: 16, whiteSpace: 'pre-wrap' }}>
            <strong>更新说明：</strong>
            <p>{updateInfo.release_notes}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
