"""系统更新业务逻辑 — 手动更新指南模式"""

from __future__ import annotations

import re
import subprocess

from sqlalchemy.ext.asyncio import AsyncSession

from app.version import __version__


async def get_github_repo(db: AsyncSession) -> str:
    """获取配置的 GitHub 仓库地址"""
    from app.services.system_config import get_config
    value = await get_config(db, "github_repo")
    if value and isinstance(value, dict):
        return value.get("repo", "gallerynick/unified-workbench")
    return "gallerynick/unified-workbench"


async def get_github_token(db: AsyncSession) -> str:
    """获取配置的 GitHub Token"""
    from app.services.system_config import get_config
    value = await get_config(db, "github_token")
    if value and isinstance(value, dict):
        return value.get("token", "")
    return ""


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


async def check_update(db: AsyncSession) -> dict:
    """检查是否有新版本。先尝试无 token 访问，失败则使用已配置的 token。"""
    repo = await get_github_repo(db)
    token = await get_github_token(db)

    def _parse_tags(output: str) -> str:
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
        result = subprocess.run(
            ["git", "ls-remote", "--tags", "--refs", repo_url],
            capture_output=True, text=True, timeout=15,
        )
        return result.returncode, result.stdout, result.stderr

    url = f"https://github.com/{repo}.git"

    try:
        rc, out, _ = _run_ls_remote(url)
        if rc == 0:
            remote_version = _parse_tags(out)
            if remote_version != "0.0.0":
                cmp = version_compare(remote_version, __version__)
                return {"available": cmp > 0, "current": __version__,
                        "remote": remote_version, "repo": repo}
    except subprocess.TimeoutExpired:
        pass

    if token:
        try:
            token_url = f"https://oauth2:{token}@github.com/{repo}.git"
            rc, out, _ = _run_ls_remote(token_url)
            if rc == 0:
                remote_version = _parse_tags(out)
                if remote_version != "0.0.0":
                    cmp = version_compare(remote_version, __version__)
                    return {"available": cmp > 0, "current": __version__,
                            "remote": remote_version, "repo": repo}
        except subprocess.TimeoutExpired:
            pass

    return {"available": False, "current": __version__,
            "error": "无法获取远程版本信息"}


async def set_github_repo(db: AsyncSession, repo: str) -> None:
    """设置 GitHub 仓库地址"""
    from app.services.system_config import update_config
    await update_config(db, "github_repo", {"repo": repo})


async def set_github_token(db: AsyncSession, token: str) -> None:
    """设置 GitHub Token"""
    from app.services.system_config import update_config
    await update_config(db, "github_token", {"token": token})


async def validate_repo(repo: str, token: str = "") -> dict:
    """验证仓库是否为本应用仓库"""
    import base64
    import httpx
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"
    async with httpx.AsyncClient() as client:
        for branch in ["main", "master"]:
            url = f"https://api.github.com/repos/{repo}/contents/.unified-workbench?ref={branch}"
            resp = await client.get(url, headers=headers, timeout=10)
            if resp.status_code == 200:
                try:
                    content = base64.b64decode(resp.json()["content"]).decode("utf-8")
                    marker = __import__("json").loads(content)
                    if marker.get("app_id") == "unified-workbench":
                        return {"valid": True, "app_id": marker["app_id"]}
                except Exception:
                    pass
    return {"valid": False, "error": "该仓库不是一站式工作台应用（缺少标识文件）"}
