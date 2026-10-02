"""全量数据导出服务 — pg_dump 全库转储 → 用户文件 → AES-256 加密 ZIP

安全设计：
  - Pepper：存储在 system_config 表（JSONB value），首次使用时由 os.urandom(32) 生成
  - Salt：每次导出随机生成 32 字节，通过响应头 X-Export-Salt 返回给客户端
  - 密钥派生：PBKDF2(passphrase + pepper, salt, 600000 iterations) → AES-256 key
  - ZIP 加密：pyzipper AES-256 (WZ_AES, nbits=256)
  - 解密条件：管理员需同时持有 ZIP 文件 + salt + 密码短语 + 服务端 pepper 才能解密

与备份模块（app.services.backup）的区别：
  - 备份使用服务端自持密钥（ENCRYPTION_MASTER_KEY 派生），无人工介入
  - 迁转使用用户密码短语，适用于跨机器数据迁移
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
import uuid
from collections.abc import Callable
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import SystemConfig
from app.services import pg_dump_service
from app.version import __version__

settings = get_settings()

APP_ID = "unified-workbench"


# === Pepper 管理 ===


async def get_or_create_pepper(db: AsyncSession) -> bytes:
    """从 system_config 获取或创建 data_export_pepper。

    SystemConfig.value 列类型为 JSONB (dict)，因此 pepper 以
    {"pepper": "<hex>"} 格式存储。
    """
    result = await db.execute(
        select(SystemConfig).where(SystemConfig.key == "data_export_pepper"),
    )
    config = result.scalar_one_or_none()

    if config is not None and isinstance(config.value, dict) and "pepper" in config.value:
        return bytes.fromhex(config.value["pepper"])

    pepper_bytes = os.urandom(32)
    pepper_hex = pepper_bytes.hex()
    if config is not None:
        config.value = {"pepper": pepper_hex}
    else:
        db.add(SystemConfig(key="data_export_pepper", value={"pepper": pepper_hex}))
    await db.commit()
    return pepper_bytes


# === 密钥派生 ===


def derive_key(passphrase: str, pepper: bytes, salt: bytes) -> bytes:
    """PBKDF2-HMAC-SHA256(passphrase + pepper, salt, 600000, dklen=32)。"""
    combined = passphrase.encode("utf-8") + pepper
    return hashlib.pbkdf2_hmac("sha256", combined, salt, 600000, dklen=32)


# === 哈希工具 ===


def _sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _sha256_file_tree(root_dir: str) -> tuple[str, int]:
    """对目录下所有文件计算 (files_sha256, file_count)。

    哈希输入为按相对路径排序的「相对路径<TAB>大小<换行>」行。
    """
    h = hashlib.sha256()
    count = 0
    entries: list[tuple[str, int]] = []
    for dirpath, _dirs, filenames in os.walk(root_dir):
        for name in filenames:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, root_dir).replace(os.sep, "/")
            entries.append((rel, os.path.getsize(full)))
            count += 1
    for rel, size in sorted(entries):
        h.update(("%s\t%d\n" % (rel, size)).encode("utf-8"))
    return h.hexdigest(), count


# === 核心导出逻辑 ===


async def export_all(
    db: AsyncSession,
    passphrase: str,
    progress_callback: Callable[[dict], None] | None = None,
) -> tuple[str, bytes]:
    """导出全量数据至加密 ZIP，返回 (zip_path, salt_bytes)。

    流程：pg_dump 全库转储 → 复制用户文件 → 生成 manifest → AES-256 加密打包

    Raises:
        ImportError / ValueError: 缺少 pyzipper 时抛出。
    """
    try:
        import pyzipper
    except ImportError:
        raise ValueError("pyzipper 未安装，请运行 pip install pyzipper")

    pepper = await get_or_create_pepper(db)
    salt = os.urandom(32)
    key = derive_key(passphrase, pepper, salt)

    tmpdir = tempfile.mkdtemp(prefix="export_")
    try:
        # Phase 1: pg_dump 全库转储
        dump_path = os.path.join(tmpdir, "database.dump")
        await pg_dump_service.dump_database(dump_path)
        db_sha = _sha256_file(dump_path)
        table_count = await pg_dump_service.table_count()

        if progress_callback is not None:
            progress_callback({"phase": "dump", "status": "completed"})

        # Phase 2: 复制用户文件
        files_dir = os.path.join(tmpdir, "files")
        os.makedirs(files_dir, exist_ok=True)
        storage = settings.FILE_STORAGE_PATH
        if os.path.isdir(storage):
            shutil.copytree(storage, files_dir, dirs_exist_ok=True)
        files_sha, file_count = _sha256_file_tree(files_dir)

        if progress_callback is not None:
            progress_callback({"phase": "files", "status": "completed"})

        # Phase 3: 生成 manifest
        manifest = {
            "app_id": APP_ID,
            "version": __version__,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "table_count": table_count,
            "file_count": file_count,
            "database_sha256": db_sha,
            "files_sha256": files_sha,
        }
        manifest_path = os.path.join(tmpdir, "manifest.json")
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

        # Phase 4: 加密打包
        zip_path = os.path.join(tmpdir, "export.zip")
        with pyzipper.AESZipFile(
            zip_path, "w",
            compression=pyzipper.ZIP_DEFLATED,
            encryption=pyzipper.WZ_AES,
        ) as zf:
            zf.setpassword(key)
            zf.setencryption(pyzipper.WZ_AES, nbits=256)
            zf.write(dump_path, "database.dump")
            zf.write(manifest_path, "manifest.json")
            for dirpath, _dirs, filenames in os.walk(files_dir):
                for name in filenames:
                    full = os.path.join(dirpath, name)
                    rel = os.path.relpath(full, files_dir).replace(os.sep, "/")
                    zf.write(full, "files/" + rel)

        return zip_path, salt
    finally:
        pass


# === 导出任务追踪（内存模式） ===

_export_tasks: dict[str, dict] = {}


async def start_export(db: AsyncSession, passphrase: str) -> str:
    """启动异步导出，返回 export_id（UUID）。"""
    export_id = str(uuid.uuid4())
    _export_tasks[export_id] = {
        "status": "running",
        "zip_path": None,
        "salt_hex": None,
        "error": None,
    }
    try:
        zip_path, salt_bytes = await export_all(db, passphrase)
        _export_tasks[export_id]["status"] = "completed"
        _export_tasks[export_id]["zip_path"] = zip_path
        _export_tasks[export_id]["salt_hex"] = salt_bytes.hex()
    except Exception as e:
        _export_tasks[export_id]["status"] = "failed"
        _export_tasks[export_id]["error"] = str(e)
    return export_id


def get_export_status(export_id: str) -> dict | None:
    """查询导出任务状态。"""
    return _export_tasks.get(export_id)


def get_export_path(export_id: str) -> tuple[str, str] | None:
    """返回 (zip_path, salt_hex)，仅已完成任务有效。"""
    task = _export_tasks.get(export_id)
    if task is None or task.get("status") != "completed":
        return None
    return task["zip_path"], task["salt_hex"]
