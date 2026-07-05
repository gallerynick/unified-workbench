import { useState, useEffect } from 'react';
import { Button, Card, Tag, message, Modal, Input, Space, Typography } from 'antd';
import { ReloadOutlined, CloudDownloadOutlined, SaveOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { checkUpdate, getRepo, setRepo, getToken, setToken } from '../../api/system';
import { clearTokens } from '../../utils/auth';
import type { UpdateInfo, RepoInfo } from '../../api/system';
import type { UnifiedResponse } from '../../types/user';
import styles from './SystemSettings.module.css';

const { Title, Text } = Typography;

let _resetPassword = '';

export default function SystemSettings() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [localVersion, setLocalVersion] = useState('...');
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
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
      try {
        const healthRes = await fetch('/api/v1/health');
        const health = await healthRes.json();
        if (health?.data?.version) setLocalVersion(health.data.version);
      } catch (e) { console.warn('Failed to load version:', e); }
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
          setRemoteVersion(res.data.remote);
          message.info(`发现新版本 v${res.data.remote}`);
        } else if (res.data.remote) {
          setRemoteVersion(res.data.remote);
          message.success('当前已是最新版本');
        } else {
          setRemoteVersion('无法获取');
        }
      }
    } catch {
      message.error('检查更新失败');
    } finally {
      setChecking(false);
    }
  };

  const handleUpdate = () => {
    Modal.info({
      title: `发现新版本 v${updateInfo?.remote}`,
      width: 600,
      content: (
        <div style={{ lineHeight: 2 }}>
          <Typography.Paragraph>
            当前版本 <Typography.Text strong>v{updateInfo?.current}</Typography.Text>，可升级至 <Typography.Text strong type="success">v{updateInfo?.remote}</Typography.Text>。
            请按以下步骤在服务器/本机上手动更新：
          </Typography.Paragraph>

          <Typography.Paragraph>
            <Typography.Text strong>1. 打开终端（命令行）</Typography.Text><br />
            Windows 用户按 <Typography.Text code>Win+R</Typography.Text>，输入 <Typography.Text code>cmd</Typography.Text> 回车。<br />
            macOS 用户打开 <Typography.Text code>终端</Typography.Text> 应用。
          </Typography.Paragraph>

          <Typography.Paragraph>
            <Typography.Text strong>2. 进入项目目录</Typography.Text><br />
            <Typography.Text code>cd 项目文件所在路径/项目文件</Typography.Text><br />
            （即包含 <Typography.Text code>start.sh</Typography.Text> 和 <Typography.Text code>start.bat</Typography.Text> 的目录）
          </Typography.Paragraph>

          <Typography.Paragraph>
            <Typography.Text strong>3. 拉取新版本代码</Typography.Text><br />
            在项目目录所在的上层目录（即能看到 <Typography.Text code>项目文件</Typography.Text> 文件夹的位置），执行：<br />
            <Typography.Text code copyable>git pull origin master</Typography.Text><br />
            <Typography.Text type="secondary">
              如果是首次使用或 git pull 失败，请先克隆仓库：<br />
            </Typography.Text>
            <Typography.Text code copyable>git clone https://github.com/{repo || 'gallerynick/unified-workbench'}.git</Typography.Text><br />
            <Typography.Text type="secondary">
              如果提示需要登录，请先配置 GitHub 账号或联系管理员。
            </Typography.Text>
          </Typography.Paragraph>

          <Typography.Paragraph>
            <Typography.Text strong>4. 重启服务</Typography.Text><br />
            <Typography.Text strong>macOS / Linux：</Typography.Text><br />
            <Typography.Text code copyable>bash start.sh</Typography.Text><br />
            <Typography.Text strong>Windows：</Typography.Text><br />
            <Typography.Text code copyable>start.bat</Typography.Text><br />
            等待出现「全部服务已启动」即完成。
          </Typography.Paragraph>

          <Typography.Paragraph type="secondary">
            更新完成后刷新此页面，本地版本号将自动更新。
            如有问题请查看终端输出的错误信息或联系管理员。
          </Typography.Paragraph>
        </div>
      ),
    });
  };

  const handleReset = () => {
    let pwd = '';
    Modal.confirm({
      title: '删除所有数据',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>此操作将删除数据库中所有数据（用户、项目、文档、文件记录等）。</p>
          <p>请输入管理员密码以确认：</p>
          <Input.Password
            placeholder="管理员密码"
            onChange={(e) => { pwd = e.target.value; }}
            style={{ marginTop: 8 }}
          />
        </div>
      ),
      okText: '继续',
      cancelText: '取消',
      okType: 'danger',
      onOk: () => {
        _resetPassword = pwd;
        Modal.confirm({
          title: '是否保留应用文件？',
          icon: <ExclamationCircleOutlined />,
          content: '选择「保留」将保留已上传的文件和文档附件。选择「不保留」将删除所有文件，系统回到初始状态。',
          okText: '不保留，全部删除',
          cancelText: '保留文件',
          okType: 'danger',
          onOk: () => doReset(false),
          onCancel: () => doReset(true),
        });
      },
    });
  };

  const doReset = async (keepFiles: boolean) => {
    try {
      const resp = await fetch('/api/v1/system/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keep_files: keepFiles, password: _resetPassword }),
      });
      const json = await resp.json();
      if (json.code === 0) {
        clearTokens();
        message.success('系统已重置，即将跳转到初始化页面...');
        setTimeout(() => { window.location.href = '/welcome'; }, 1500);
      } else {
        message.error(json.msg || '重置失败');
      }
    } catch { message.error('重置失败'); }
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
            <Text strong>v{localVersion}</Text>
          </div>
          <div>
            <Text type="secondary">仓库最新：</Text>
            <Text strong>{remoteVersion && remoteVersion !== '无法获取' ? `v${remoteVersion}` : remoteVersion || '未检查'}</Text>
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
              loading={false}
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

      <Card title="危险操作" style={{ marginTop: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Paragraph type="danger">
            删除所有数据将使系统恢复到初始状态。此操作不可撤销。
          </Typography.Paragraph>
          <Button
            type="primary"
            danger
            icon={<ExclamationCircleOutlined />}
            onClick={handleReset}
          >
            删除所有数据
          </Button>
        </Space>
      </Card>
    </div>
  );
}
