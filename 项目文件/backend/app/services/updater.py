"""系统更新业务逻辑 — 全量替换更新机制"""

from __future__ import annotations

import os
import platform
import re
import shutil
import subprocess
import time
import uuid
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.version import __version__

# 工作台根目录（容器内外统一路径）
WORKBENCH_ROOT = Path("/Users/gallerynick/Documents/Project/Project_UnifiedWorkbench")
# 项目文件目录
PROJECT_DIR = WORKBENCH_ROOT / "项目文件"
# 临时更新目录
TEMP_UPDATE_DIR = Path("/tmp/unified_workbench_update")

# 更新进度存储（key: task_id, value: dict with progress info）
_update_progress: dict[str, dict] = {}


def get_progress(task_id: str) -> dict | None:
    """获取更新进度"""
    return _update_progress.get(task_id)


def _report_progress(task_id: str, percent: int, message: str):
    """更新进度"""
    _update_progress[task_id] = {
        "task_id": task_id,
        "percent": percent,
        "message": message,
        "status": "running" if percent < 100 else "done",
        "timestamp": time.time(),
    }
    # 清理超过 10 分钟的旧进度记录
    now = time.time()
    for tid in list(_update_progress.keys()):
        if now - _update_progress[tid].get("timestamp", 0) > 600:
            del _update_progress[tid]


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


async def perform_update(db: AsyncSession) -> dict:
    """执行全量更新。

    流程：
    1. git clone 新版本到临时目录
    2. 拷贝更新 runner 脚本到 /tmp/（确保替换时不被删除）
    3. 替换整个项目文件目录
    4. 执行 runner 脚本重启服务
    """
    task_id = str(uuid.uuid4())[:8]
    _report_progress(task_id, 0, "准备更新...")

    repo = await get_github_repo(db)
    token = await get_github_token(db)
    clone_url = f"https://oauth2:{token}@github.com/{repo}.git" if token else f"https://github.com/{repo}.git"

    try:
        # 1. 清理旧的临时目录
        if TEMP_UPDATE_DIR.exists():
            shutil.rmtree(TEMP_UPDATE_DIR, ignore_errors=True)

        # 2. git clone 新版本
        _report_progress(task_id, 10, "正在下载新版本...")
        result = subprocess.run(
            ["git", "clone", "--depth", "1", clone_url, str(TEMP_UPDATE_DIR)],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            _report_progress(task_id, 0, f"下载失败: {result.stderr.strip()}")
            return {"success": False, "error": f"下载失败: {result.stderr.strip()}", "task_id": task_id}

        _report_progress(task_id, 30, "下载完成，准备替换...")

        # 3. 拷贝更新 runner 到 /tmp/（确保不被替换操作删除）
        runner_src = TEMP_UPDATE_DIR / "项目文件" / "backend" / "app" / "services" / "update_runner.py"
        runner_dst = Path("/tmp/update_runner.py")
        _report_progress(task_id, 40, "准备更新程序...")

        # 内联 runner 脚本（不依赖外部文件）
        _write_runner_script(runner_dst)

        _report_progress(task_id, 50, "正在替换文件...")

        # 4. 替换项目文件
        src_project = TEMP_UPDATE_DIR / "项目文件"
        if src_project.exists():
            # 用 rsync 风格替换：先删旧，再复制新
            if PROJECT_DIR.exists():
                shutil.rmtree(PROJECT_DIR, ignore_errors=True)
            shutil.copytree(str(src_project), str(PROJECT_DIR))

        # 5. 确保 start.sh / start.bat 可执行
        _report_progress(task_id, 80, "正在重启服务...")
        start_sh = PROJECT_DIR / "start.sh"
        start_bat = PROJECT_DIR / "start.bat"
        if start_sh.exists():
            os.chmod(start_sh, 0o755)
        if start_bat.exists():
            os.chmod(start_bat, 0o755)

        # 6. 从 /tmp/ 以 nohup 方式启动 runner，确保父进程被 docker compose down 杀死后
        #    runner 仍能存活并完成重启
        _write_runner_script(runner_dst)
        subprocess.Popen(
            ["python3", str(runner_dst)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,  # 脱离父进程 Session，防止被 SIGTERM 连带杀死
        )

        _report_progress(task_id, 100, "更新完成，服务重启中...")
        return {"success": True, "message": "更新完成，服务正在重启", "task_id": task_id}

    except Exception as e:
        _report_progress(task_id, 0, f"更新失败: {str(e)}")
        return {"success": False, "error": str(e), "task_id": task_id}


def _write_runner_script(path: Path):
    """写入更新 runner 脚本（含临时文件清理）"""
    path.write_text("""# 更新 runner - 由系统更新触发
import subprocess, shutil, os, platform
from pathlib import Path

WORKBENCH = Path("/Users/gallerynick/Documents/Project/Project_UnifiedWorkbench/项目文件")
TEMP_DIR = Path("/tmp/unified_workbench_update")
RUNNER = Path("/tmp/update_runner.py")

# 等待父进程完成响应
import time; time.sleep(2)

# 执行重启
system = platform.system()
if system == "Darwin" or system == "Linux":
    subprocess.run(["bash", str(WORKBENCH / "start.sh")], cwd=str(WORKBENCH))
elif system == "Windows":
    subprocess.run(["cmd", "/c", str(WORKBENCH / "start.bat")], cwd=str(WORKBENCH))

# 清理临时文件
try:
    shutil.rmtree(TEMP_DIR, ignore_errors=True)
    os.remove(RUNNER)
except Exception:
    pass
""")
    os.chmod(path, 0o755)


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
