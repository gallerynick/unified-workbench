"""基于 GitHub Releases 的自动更新服务，支持仓库标识验证"""

import json
import subprocess

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.version import __version__
from app.services.system_config import get_config, update_config

DEFAULT_GITHUB_REPO = "gallerynick/unified-workbench"
APP_ID = "unified-workbench"


async def get_github_repo(db: AsyncSession) -> str:
    """获取配置的 GitHub 仓库地址"""
    value = await get_config(db, "github_repo")
    if value and isinstance(value, dict):
        return value.get("repo", DEFAULT_GITHUB_REPO)
    return DEFAULT_GITHUB_REPO


async def set_github_repo(db: AsyncSession, repo: str) -> None:
    """设置 GitHub 仓库地址"""
    await update_config(db, "github_repo", {"repo": repo})


async def validate_repo(repo: str) -> dict:
    """验证仓库是否为本应用仓库"""
    async with httpx.AsyncClient() as client:
        # 1. 检查标识文件是否存在（尝试 main 和 master 分支）
        marker = None
        for branch in ["main", "master"]:
            url = f"https://raw.githubusercontent.com/{repo}/{branch}/.unified-workbench"
            resp = await client.get(url, timeout=10)
            if resp.status_code == 200:
                try:
                    marker = resp.json()
                    break
                except json.JSONDecodeError:
                    return {"valid": False, "error": "标识文件格式错误"}
        
        if marker is None:
            return {"valid": False, "error": "该仓库不是一站式工作台应用（缺少标识文件）"}

        # 2. 验证 app_id
        if marker.get("app_id") != APP_ID:
            return {
                "valid": False,
                "error": f"该仓库不是一站式工作台应用（app_id: {marker.get('app_id')})",
            }

        return {"valid": True, "app_id": marker["app_id"]}


async def check_update(db: AsyncSession) -> dict:
    """检查是否有新版本"""
    repo = await get_github_repo(db)

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
        cmp = version_compare(remote_version, __version__)
        if cmp <= 0:
            return {
                "available": False,
                "current": __version__,
                "remote": remote_version,
                "repo": repo,
                "error": "当前已是最新版本" if cmp == 0 else f"本地版本（{__version__}）高于远程版本（{remote_version}），无需更新",
            }

        return {
            "available": True,
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
        if a > b:
            return 1
        if a < b:
            return -1
    return len(parts1) - len(parts2)


async def perform_update(db: AsyncSession) -> dict:
    """执行更新"""
    repo = await get_github_repo(db)

    # 再次验证仓库
    validation = await validate_repo(repo)
    if not validation["valid"]:
        return {"success": False, "error": validation["error"]}

    try:
        # 1. 拉取最新代码
        result = subprocess.run(
            ["git", "pull", "origin", "main"],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            return {"success": False, "error": f"git pull 失败: {result.stderr}"}

        # 2. 重新构建并重启
        result = subprocess.run(
            ["docker", "compose", "-p", "workbench", "up", "-d", "--build"],
            capture_output=True,
            text=True,
            timeout=600,
        )
        if result.returncode != 0:
            return {"success": False, "error": f"docker compose 失败: {result.stderr}"}

        return {"success": True, "message": "更新成功，服务已重启"}
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "更新超时"}
    except Exception as e:
        return {"success": False, "error": str(e)}
