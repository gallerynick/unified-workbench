# 更新配置仓库地址验证计划

## 需求描述

1. 更新配置应该放在应用配置里，在那里填写仓库地址
2. 在仓库中添加标识防止用户乱填写导致更新失败
3. 要确保是版本比自己高然后是这个应用的
4. 默认仓库地址是 https://github.com/gallerynick/unified-workbench

## 技术方案

### 仓库标识验证

在仓库根目录添加 `.unified-workbench` 标识文件，内容为 JSON：
```json
{
  "app_id": "unified-workbench",
  "min_version": "0.1.0"
}
```

更新时验证：
1. 远程仓库存在 `.unified-workbench` 文件
2. 文件中 `app_id` 为 `unified-workbench`
3. 远程版本高于当前版本

### 配置存储

使用系统配置表存储仓库地址，支持前端修改。

## 修改文件

### 后端
- `.unified-workbench` — 新建，仓库标识文件
- `项目文件/backend/app/services/updater.py` — 修改，添加配置读取和验证逻辑
- `项目文件/backend/app/api/system.py` — 修改，添加配置保存 API

### 前端
- `项目文件/frontend/src/pages/settings/SystemSettings.tsx` — 修改，添加仓库地址配置 UI

## 具体修改步骤

### 1. 创建仓库标识文件

在项目根目录创建 `.unified-workbench`：
```json
{
  "app_id": "unified-workbench",
  "min_version": "0.1.0"
}
```

### 2. 修改更新服务

`项目文件/backend/app/services/updater.py`：

```python
import subprocess
import json
import httpx
from app.version import __version__
from app.services.system_config import get_config, set_config

DEFAULT_GITHUB_REPO = "gallerynick/unified-workbench"
APP_ID = "unified-workbench"

async def get_github_repo() -> str:
    """获取配置的 GitHub 仓库地址"""
    repo = await get_config("github_repo", DEFAULT_GITHUB_REPO)
    return repo

async def set_github_repo(repo: str) -> None:
    """设置 GitHub 仓库地址"""
    await set_config("github_repo", repo)

async def validate_repo(repo: str) -> dict:
    """验证仓库是否为本应用仓库"""
    async with httpx.AsyncClient() as client:
        # 1. 检查标识文件是否存在
        url = f"https://raw.githubusercontent.com/{repo}/main/.unified-workbench"
        resp = await client.get(url, timeout=10)
        if resp.status_code != 200:
            return {"valid": False, "error": "该仓库不是一站式工作台应用（缺少标识文件）"}
        
        # 2. 解析标识文件
        try:
            marker = resp.json()
        except json.JSONDecodeError:
            return {"valid": False, "error": "标识文件格式错误"}
        
        # 3. 验证 app_id
        if marker.get("app_id") != APP_ID:
            return {"valid": False, "error": f"该仓库不是一站式工作台应用（app_id: {marker.get('app_id')})"}
        
        return {"valid": True, "app_id": marker["app_id"]}

async def check_update() -> dict:
    """检查是否有新版本"""
    repo = await get_github_repo()
    
    # 验证仓库
    validation = await validate_repo(repo)
    if not validation["valid"]:
        return {"available": False, "error": validation["error"]}
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{repo}/releases/latest",
            headers={"Accept": "application/vnd.github.v3+json"},
            timeout=10,
        )
        if resp.status_code != 200:
            return {"available": False, "error": "无法获取远程版本信息"}
        
        data = resp.json()
        remote_version = data["tag_name"].lstrip("v")
        release_notes = data.get("body", "")
        download_url = data.get("html_url", "")
        
        # 确保版本比当前高
        available = version_compare(remote_version, __version__) > 0
        
        return {
            "available": available,
            "current": __version__,
            "remote": remote_version,
            "release_notes": release_notes,
            "download_url": download_url,
            "repo": repo,
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
    repo = await get_github_repo()
    
    # 再次验证仓库
    validation = await validate_repo(repo)
    if not validation["valid"]:
        return {"success": False, "error": validation["error"]}
    
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

### 3. 修改更新 API

`项目文件/backend/app/api/system.py`：

```python
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.updater import check_update, perform_update, get_github_repo, set_github_repo, validate_repo

router = APIRouter(prefix="/system", tags=["system"])

class RepoConfig(BaseModel):
    repo: str

@router.get("/check-update")
async def api_check_update():
    result = await check_update()
    return {"code": 0, "msg": "", "data": result}

@router.post("/update")
async def api_perform_update():
    result = await perform_update()
    return {"code": 0, "msg": "", "data": result}

@router.get("/repo")
async def api_get_repo():
    repo = await get_github_repo()
    return {"code": 0, "msg": "", "data": {"repo": repo}}

@router.put("/repo")
async def api_set_repo(config: RepoConfig):
    # 验证仓库格式
    parts = config.repo.split("/")
    if len(parts) != 2:
        return {"code": 1, "msg": "仓库地址格式错误，应为 owner/repo", "data": None}
    
    # 验证仓库是否为本应用
    validation = await validate_repo(config.repo)
    if not validation["valid"]:
        return {"code": 1, "msg": validation["error"], "data": None}
    
    await set_github_repo(config.repo)
    return {"code": 0, "msg": "仓库地址已更新", "data": {"repo": config.repo}}
```

### 4. 修改前端系统设置页面

`项目文件/frontend/src/pages/settings/SystemSettings.tsx`：

添加仓库地址配置功能：
- 显示当前配置的仓库地址
- 输入框修改仓库地址
- 保存时验证仓库有效性
- 验证通过后才保存

## 验证清单

- [x] 1. 访问系统设置页面 → 显示当前仓库地址（默认 gallerynick/unified-workbench）
- [x] 2. 修改仓库地址为有效地址 → 保存成功
- [x] 3. 修改仓库地址为无效地址 → 提示错误信息
- [x] 4. 修改仓库地址为其他应用仓库 → 提示"该仓库不是一站式工作台应用"
- [x] 5. 点击检查更新 → 只有版本高于当前才显示更新
- [x] 6. 点击立即更新 → 执行更新
- [x] 7. 前端构建通过
- [x] 8. 后端健康检查返回 200

## 注意事项

- 仓库标识文件 `.unified-workbench` 需要提交到仓库
- GitHub API 有访问频率限制（未认证 60次/小时）
- 仓库地址格式必须为 `owner/repo`
