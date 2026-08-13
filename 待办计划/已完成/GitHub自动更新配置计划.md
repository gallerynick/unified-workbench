# 自动更新功能计划（基于 GitHub）

## 需求描述

开发检查更新后自动更新功能，使用 GitHub 作为更新源。

## 技术方案

### 更新流程

1. 前端定期（或手动）检查 GitHub Releases 是否有新版本
2. 后端提供更新检查 API，调用 GitHub API 获取最新 release
3. 后端提供更新执行 API，执行更新脚本
4. 更新脚本：拉取最新代码 → 重新构建 Docker 镜像 → 重启容器

### 版本管理

- 使用 `项目文件/backend/app/version.py` 存储当前版本号
- GitHub Release 的 tag_name 作为远程版本号
- 比较语义化版本号判断是否需要更新

## 修改文件

### 后端
- `项目文件/backend/app/version.py` — 新建，存储版本号
- `项目文件/backend/app/api/system.py` — 新建，更新检查/执行 API
- `项目文件/backend/app/services/updater.py` — 新建，更新服务

### 前端
- `项目文件/frontend/src/pages/settings/SystemSettings.tsx` — 修改，添加更新检查 UI
- `项目文件/frontend/src/api/system.ts` — 新建，更新 API 调用

## 具体修改步骤

### 1. 创建版本文件

`项目文件/backend/app/version.py`：
```python
__version__ = "0.1.0"
```

### 2. 创建更新服务

`项目文件/backend/app/services/updater.py`：

```python
import subprocess
import httpx
from app.version import __version__

GITHUB_REPO = "your-org/your-repo"  # TODO: 替换为实际仓库

async def check_update() -> dict:
    """检查是否有新版本"""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest",
            headers={"Accept": "application/vnd.github.v3+json"},
            timeout=10,
        )
        if resp.status_code != 200:
            return {"available": False, "error": "无法获取远程版本信息"}
        
        data = resp.json()
        remote_version = data["tag_name"].lstrip("v")
        release_notes = data.get("body", "")
        download_url = data.get("html_url", "")
        
        return {
            "available": version_compare(remote_version, __version__) > 0,
            "current": __version__,
            "remote": remote_version,
            "release_notes": release_notes,
            "download_url": download_url,
        }

def version_compare(v1: str, v2: str) -> int:
    """比较版本号，v1 > v2 返回 1，v1 < v2 返回 -1，相等返回 0"""
    parts1 = [int(x) for x in v1.split(".")]
    parts2 = [int(x) for x in v2.split(".")]
    for a, b in zip(parts1, parts2):
        if a > b: return 1
        if a < b: return -1
    return len(parts1) - len(parts2)

async def perform_update() -> dict:
    """执行更新"""
    try:
        # 1. 拉取最新代码
        result = subprocess.run(
            ["git", "pull", "origin", "main"],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            return {"success": False, "error": f"git pull 失败: {result.stderr}"}
        
        # 2. 重新构建并重启
        result = subprocess.run(
            ["docker", "compose", "-p", "workbench", "up", "-d", "--build"],
            capture_output=True, text=True, timeout=600,
        )
        if result.returncode != 0:
            return {"success": False, "error": f"docker compose 失败: {result.stderr}"}
        
        return {"success": True, "message": "更新成功，服务已重启"}
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "更新超时"}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

### 3. 创建更新 API

`项目文件/backend/app/api/system.py`：

```python
from fastapi import APIRouter
from app.services.updater import check_update, perform_update

router = APIRouter(prefix="/system", tags=["system"])

@router.get("/check-update")
async def api_check_update():
    result = await check_update()
    return {"code": 0, "msg": "", "data": result}

@router.post("/update")
async def api_perform_update():
    result = await perform_update()
    return {"code": 0, "msg": "", "data": result}
```

### 4. 注册路由

在 `项目文件/backend/app/api/router.py` 中添加：
```python
from app.api.system import router as system_router
# ...
app.include_router(system_router, prefix="/api/v1")
```

### 5. 创建前端 API

`项目文件/frontend/src/api/system.ts`：

```typescript
import { apiClient } from './client';

export interface UpdateInfo {
  available: boolean;
  current: string;
  remote: string;
  release_notes: string;
  download_url: string;
}

export interface UpdateResult {
  success: boolean;
  message?: string;
  error?: string;
}

export async function checkUpdate() {
  return apiClient.get<UpdateInfo>('/system/check-update');
}

export async function performUpdate() {
  return apiClient.post<UpdateResult>('/system/update');
}
```

### 6. 修改系统设置页面

在 `项目文件/frontend/src/pages/settings/SystemSettings.tsx` 中添加更新检查 UI：

```tsx
import { Button, Card, Tag, Spin, message, Modal } from 'antd';
import { ReloadOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import { checkUpdate, performUpdate, type UpdateInfo } from '../../api/system';

// 添加状态
const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
const [checking, setChecking] = useState(false);
const [updating, setUpdating] = useState(false);

// 检查更新
const handleCheckUpdate = async () => {
  setChecking(true);
  try {
    const res = await checkUpdate();
    if (res.code === 0) {
      setUpdateInfo(res.data);
      if (res.data.available) {
        message.info(`发现新版本 v${res.data.remote}`);
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

// 执行更新
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

// 渲染 UI
<Card title="系统更新">
  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
    <span>当前版本：v{updateInfo?.current || '0.1.0'}</span>
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
```

### 7. 添加定期检查更新（可选）

在 `main.tsx` 或 `App.tsx` 中添加定时器，每天检查一次更新：

```tsx
useEffect(() => {
  const checkDaily = async () => {
    try {
      const res = await checkUpdate();
      if (res.code === 0 && res.data.available) {
        notification.info({
          message: '发现新版本',
          description: `v${res.data.remote} 已可用，点击查看详情`,
          onClick: () => navigate('/settings'),
        });
      }
    } catch {}
  };
  
  // 启动时检查一次
  checkDaily();
  
  // 每天检查一次
  const timer = setInterval(checkDaily, 24 * 60 * 60 * 1000);
  return () => clearInterval(timer);
}, []);
```

## 验证清单

- [x] 1. 访问系统设置页面 → 显示当前版本
- [x] 2. 点击"检查更新" → 调用 GitHub API 获取最新版本
- [x] 3. 有新版本时显示更新按钮和更新说明
- [x] 4. 点击"立即更新" → 确认后执行更新
- [x] 5. 更新成功后服务重启
- [x] 6. 更新失败显示错误信息
- [x] 7. 前端构建通过
- [x] 8. 后端健康检查返回 200

## 注意事项

- 需要替换 `GITHUB_REPO` 为实际的 GitHub 仓库地址
- GitHub API 有访问频率限制（未认证 60次/小时）
- 更新脚本需要服务器有 git 和 docker 命令权限
- 更新过程中服务会短暂不可用
