import { useState, useEffect } from 'react';
import { Button, Card, Tag, message, Modal, Input, Space } from 'antd';
import { ReloadOutlined, CloudDownloadOutlined, SaveOutlined } from '@ant-design/icons';
import {
  checkUpdate,
  performUpdate,
  getRepo,
  setRepo,
  type UpdateInfo,
  type RepoInfo,
} from '../../api/system';
import type { UnifiedResponse } from '../../types/user';

export default function SystemSettings() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [repo, setRepoValue] = useState('');
  const [editingRepo, setEditingRepo] = useState('');
  const [savingRepo, setSavingRepo] = useState(false);

  useEffect(() => {
    const loadRepo = async () => {
      try {
        const res: UnifiedResponse<RepoInfo> = await getRepo();
        if (res.code === 0) {
          setRepoValue(res.data.repo);
          setEditingRepo(res.data.repo);
        }
      } catch {
        // 忽略加载失败
      }
    };
    loadRepo();
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
        </Space>
      </Card>

      <Card title="系统更新">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span>当前版本：v{updateInfo?.current || '0.1.0'}</span>
          <span>仓库：{repo || 'gallerynick/unified-workbench'}</span>
          {updateInfo?.available && (
            <Tag color="green">新版本 v{updateInfo.remote} 可用</Tag>
          )}
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
        </div>
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
