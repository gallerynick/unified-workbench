"""基于 GitHub Releases 的自动更新服务，支持仓库标识验证"""

import json
import subprocess

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.version import __version__
from app.services.system_config import get_config, update_config

DEFAULT_GITHUB_REPO = "gallerynick/unified-workbench"
APP_ID = "unified-workbench"


async def get_github_token(db: AsyncSession) -> str:
    """获取配置的 GitHub Token"""
    value = await get_config(db, "github_token")
    if value and isinstance(value, dict):
        return value.get("token", "")
    return ""


async def set_github_token(db: AsyncSession, token: str) -> None:
    """设置 GitHub Token"""
    await update_config(db, "github_token", {"token": token})


async def get_github_repo(db: AsyncSession) -> str:
    """获取配置的 GitHub 仓库地址"""
    value = await get_config(db, "github_repo")
    if value and isinstance(value, dict):
        return value.get("repo", DEFAULT_GITHUB_REPO)
    return DEFAULT_GITHUB_REPO


async def set_github_repo(db: AsyncSession, repo: str) -> None:
    """设置 GitHub 仓库地址"""
    await update_config(db, "github_repo", {"repo": repo})


async def validate_repo(repo: str, token: str = "") -> dict:
    """验证仓库是否为本应用仓库"""
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"
    
    async with httpx.AsyncClient() as client:
        marker = None
        for branch in ["main", "master"]:
            url = f"https://api.github.com/repos/{repo}/contents/.unified-workbench?ref={branch}"
            resp = await client.get(url, headers=headers, timeout=10)
            if resp.status_code == 200:
                import base64
                try:
                    content = base64.b64decode(resp.json()["content"]).decode("utf-8")
                    marker = json.loads(content)
                    break
                except (json.JSONDecodeError, KeyError):
                    return {"valid": False, "error": "标识文件格式错误"}
        
        if marker is None:
            return {"valid": False, "error": "该仓库不是一站式工作台应用（缺少标识文件）"}

        if marker.get("app_id") != APP_ID:
            return {
                "valid": False,
                "error": f"该仓库不是一站式工作台应用（app_id: {marker.get('app_id')})",
            }

        return {"valid": True, "app_id": marker["app_id"]}


async def check_update(db: AsyncSession) -> dict:
    """检查是否有新版本。
    先尝试无 token 访问，失败则使用已配置的 token。
    """
    import re
    repo = await get_github_repo(db)
    token = await get_github_token(db)

    def _parse_tags(output: str) -> str:
        """解析 git ls-remote 输出，返回最高版本号"""
        remote = "0.0.0"
        for line in output.strip().split("\n"):
            if not line.strip():
                continue
            tag = line.split("refs/tags/")[-1].strip().lstrip("v")
            if re.match(r"^\d+\.\d+\.\d+$", tag):
                if version_compare(tag, remote) > 0:
                    remote = tag
        return remote

    def _run_ls_remote(repo_url: str) -> tuple[int, str, str]:
        """执行 git ls-remote，返回 (returncode, stdout, stderr)"""
        result = subprocess.run(
            ["git", "ls-remote", "--tags", "--refs", repo_url],
            capture_output=True, text=True, timeout=15,
        )
        return result.returncode, result.stdout, result.stderr

    url = f"https://github.com/{repo}.git"

    # 1. 先尝试无 token
    try:
        rc, out, err = _run_ls_remote(url)
        if rc == 0:
            remote_version = _parse_tags(out)
            if remote_version != "0.0.0":
                cmp = version_compare(remote_version, __version__)
                return {
                    "available": cmp > 0,
                    "current": __version__,
                    "remote": remote_version,
                    "repo": repo,
                }
    except subprocess.TimeoutExpired:
        pass  # fall through to token attempt

    # 2. 无 token 失败，尝试带 token
    if token:
        try:
            token_url = f"https://oauth2:{token}@github.com/{repo}.git"
            rc, out, err = _run_ls_remote(token_url)
            if rc == 0:
                remote_version = _parse_tags(out)
                if remote_version != "0.0.0":
                    cmp = version_compare(remote_version, __version__)
                    return {
                        "available": cmp > 0,
                        "current": __version__,
                        "remote": remote_version,
                        "repo": repo,
                    }
        except subprocess.TimeoutExpired:
            pass

    # 3. 都失败
    return {"available": False, "current": __version__,
            "error": "无法获取远程版本信息"}


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
    token = await get_github_token(db)

    validation = await validate_repo(repo, token)
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
