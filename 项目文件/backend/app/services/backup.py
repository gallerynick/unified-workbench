"""备份业务逻辑 —— 全量加密备份（数据库 + 文件）

设计（决策 A，2026-09-29 确认）：

- 内容：pg_dump -Fc 全库转储 + FILE_STORAGE_PATH 整个目录树 + manifest.json
- 加密：pyzipper AES-256；密钥由 ENCRYPTION_MASTER_KEY 经 HMAC-SHA256 派生，
  服务端自持，创建与解密均无人工介入
- 完整性：manifest 内含 database_sha256 与 files_sha256，恢复前自动校验
- 恢复：管理员密码在 API 层验证（授权闸门，非解密密钥）→ 校验哈希 →
  快照当前库与文件 → DROP/CREATE → pg_restore → 文件解压 → 任一步失败自动回退快照

与原实现的差异：

- 原实现只 pg_dump 数据库，不含任何用户文件，且完全不加密
- 原实现硬编码 '-U postgres'（真实用户是 workbench）并从不传密码，
  加之镜像缺 pg_dump，生产环境 100% 不可用
- 现改为备份与数据迁转共用 app.services.pg_dump_service
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import get_settings
from app.services import pg_dump_service
from app.version import __version__

logger = logging.getLogger(__name__)
settings = get_settings()

# 备份密钥用途标识：与 master key 做 HMAC，隔离出备份专用的 32 字节密钥
BACKUP_KEY_INFO = b"unified-workbench-backup-v1"

# config.py 中的出厂默认值；用于提示部署者尚未替换
DEFAULT_MASTER_KEY = "7433947cd794fc1c74ca1a2063baf5defd908128356ac1f6e36b6861a1d283eb"

APP_ID = "unified-workbench"


# === 密钥派生 ===

def backup_password() -> bytes:
    """派生备份加密密码（32 字节原始密钥）。

    由 ENCRYPTION_MASTER_KEY 经 HMAC-SHA256 派生，服务端自持、无人工介入。
    选择 env 而非 DB 存储的原因：备份的价值场景是数据库已损坏后恢复，
    此时 DB 内存储的密钥已不可用；env 随 .env 持久存在。

    返回 bytes 而非 str：pyzipper.AESZipFile.setpassword 要求 bytes。
    """
    master = get_settings().ENCRYPTION_MASTER_KEY.encode("utf-8")
    return hmac.new(master, BACKUP_KEY_INFO, hashlib.sha256).digest()


def _warn_if_default_master_key() -> None:
    """master key 仍为出厂默认值时告警（影响所有加密，非仅备份）。"""
    if get_settings().ENCRYPTION_MASTER_KEY == DEFAULT_MASTER_KEY:
        logger.warning(
            "ENCRYPTION_MASTER_KEY 仍为出厂默认值，备份加密强度受此影响；"
            "请在 .env 中设置 64 位十六进制随机值"
        )


def _backup_dir() -> str:
    """备份目录：优先环境变量 BACKUP_DIR，否则 /data/backups。"""
    return os.environ.get("BACKUP_DIR") or "/data/backups"


# === 哈希工具 ===

def _sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _sha256_file_tree(root_dir: str) -> tuple[str, int]:
    """对目录下所有文件计算 (files_sha256, file_count)。

    哈希输入为按相对路径排序的「相对路径<TAB>大小<换行>」行，
    稳定且与解压顺序无关。
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


# === 创建备份 ===

async def create_backup(backup_dir: str | None = None) -> dict:
    """创建一份全量加密备份，返回备份元信息字典。

    返回字段：filename / size / created_at / checksum / table_count / file_count
    """
    try:
        import pyzipper
    except ImportError as e:
        raise RuntimeError("pyzipper 未安装，请运行 pip install pyzipper") from e

    _warn_if_default_master_key()
    target_dir = backup_dir or _backup_dir()
    os.makedirs(target_dir, exist_ok=True)

    tmpdir = tempfile.mkdtemp(prefix="backup_build_")
    try:
        # Phase 1: 全库转储
        dump_path = os.path.join(tmpdir, "database.dump")
        await pg_dump_service.dump_database(dump_path)
        db_sha = _sha256_file(dump_path)
        table_count = await pg_dump_service.table_count()

        # Phase 2: 复制用户文件
        files_dir = os.path.join(tmpdir, "files")
        os.makedirs(files_dir, exist_ok=True)
        storage = settings.FILE_STORAGE_PATH
        if os.path.isdir(storage):
            shutil.copytree(storage, files_dir, dirs_exist_ok=True)
        files_sha, file_count = _sha256_file_tree(files_dir)

        # Phase 3: manifest（含校验和）
        manifest = {
            "app_id": APP_ID,
            "version": __version__,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "table_count": table_count,
            "file_count": file_count,
            "database_sha256": db_sha,
            "files_sha256": files_sha,
        }
        manifest_path = os.path.join(tmpdir, "manifest.json")
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

        # Phase 4: 加密打包
        now = datetime.now()
        rand = os.urandom(4).hex()
        filename = "backup_%s_%s.zip" % (now.strftime("%Y%m%d_%H%M%S"), rand)
        zip_path = os.path.join(target_dir, filename)
        with pyzipper.AESZipFile(
            zip_path, "w",
            compression=pyzipper.ZIP_DEFLATED,
            encryption=pyzipper.WZ_AES,
        ) as zf:
            zf.setpassword(backup_password())
            zf.setencryption(pyzipper.WZ_AES, nbits=256)
            zf.write(dump_path, "database.dump")
            zf.write(manifest_path, "manifest.json")
            for dirpath, _dirs, filenames in os.walk(files_dir):
                for name in filenames:
                    full = os.path.join(dirpath, name)
                    rel = os.path.relpath(full, files_dir).replace(os.sep, "/")
                    zf.write(full, "files/" + rel)

        size = os.path.getsize(zip_path)
        logger.info(
            "备份完成: %s (%d bytes, %d 表, %d 文件)",
            filename, size, table_count, file_count,
        )
        return {
            "filename": filename,
            "size": size,
            "created_at": now.isoformat(),
            "checksum": db_sha,
            "table_count": table_count,
            "file_count": file_count,
        }
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# === 备份列表与删除 ===

def list_backups(backup_dir: str | None = None) -> list[dict]:
    """列出备份目录中的所有备份文件（按创建时间倒序）。"""
    target_dir = backup_dir or _backup_dir()
    if not os.path.isdir(target_dir):
        return []
    items: list[dict] = []
    for name in os.listdir(target_dir):
        if not name.endswith(".zip"):
            continue
        full = os.path.join(target_dir, name)
        if not os.path.isfile(full):
            continue
        st = os.stat(full)
        items.append({
            "filename": name,
            "size": st.st_size,
            "created_at": datetime.fromtimestamp(st.st_mtime).isoformat(),
        })
    return sorted(items, key=lambda x: x["created_at"], reverse=True)


def delete_backup(filename: str, backup_dir: str | None = None) -> bool:
    """删除指定备份文件。返回是否删除成功。"""
    target_dir = backup_dir or _backup_dir()
    # 防目录穿越：只接受纯文件名
    if os.path.basename(filename) != filename or "/" in filename or "\\" in filename:
        return False
    full = os.path.join(target_dir, filename)
    if not os.path.isfile(full):
        return False
    os.remove(full)
    return True


def cleanup_old_backups(backup_dir: str | None = None, max_keep: int = 0) -> int:
    """保留最新的 max_keep 份，删除更旧的。max_keep<=0 表示不清理。"""
    if max_keep <= 0:
        return 0
    backups = sorted(
        list_backups(backup_dir),
        key=lambda x: x["created_at"],
        reverse=True,
    )
    removed = 0
    for old in backups[max_keep:]:
        if delete_backup(old["filename"], backup_dir):
            removed += 1
    return removed


# === 解压与完整性校验 ===

def _extract_zip(zip_path: str, dest_dir: str) -> dict:
    """解压加密备份到 dest_dir 并校验 manifest 中的两份校验和。

    Raises:
        ValueError: 密钥错误或完整性校验失败。
    """
    try:
        import pyzipper
    except ImportError as e:
        raise ValueError("pyzipper 未安装，请运行 pip install pyzipper") from e

    try:
        with pyzipper.AESZipFile(zip_path, "r", encryption=pyzipper.WZ_AES) as zf:
            zf.setpassword(backup_password())
            names = zf.namelist()
            if "manifest.json" not in names:
                raise ValueError("备份包缺少 manifest.json，文件可能已损坏")
            if "database.dump" not in names:
                raise ValueError("备份包缺少 database.dump，文件可能已损坏")
            zf.extractall(dest_dir)
    except RuntimeError as e:
        # pyzipper 密码错误会抛 RuntimeError: Password is required / bad decrypt
        raise ValueError("备份包解密失败，密钥不匹配或文件已损坏: %s" % e) from e

    manifest = json.loads(
        Path(os.path.join(dest_dir, "manifest.json")).read_text(encoding="utf-8")
    )

    # 校验数据库转储
    actual_db = _sha256_file(os.path.join(dest_dir, "database.dump"))
    if actual_db != manifest.get("database_sha256"):
        raise ValueError("完整性校验失败：database.dump 的 SHA256 与 manifest 不符")

    # 校验文件目录
    actual_files_sha, _ = _sha256_file_tree(os.path.join(dest_dir, "files"))
    if actual_files_sha != manifest.get("files_sha256"):
        raise ValueError("完整性校验失败：files 目录的 SHA256 与 manifest 不符")

    return manifest


# === 恢复 ===

async def _restore_database_from_dump(dump_path: str) -> None:
    """DROP/CREATE 后从转储恢复数据库。"""
    await pg_dump_service.drop_database()
    await pg_dump_service.create_database()
    await pg_dump_service.restore_database(dump_path)


def _swap_file_storage(src_dir: str) -> None:
    """用 src_dir 的内容替换 FILE_STORAGE_PATH。"""
    storage = settings.FILE_STORAGE_PATH
    if os.path.isdir(storage):
        shutil.rmtree(storage, ignore_errors=True)
    if os.path.isdir(src_dir):
        shutil.copytree(src_dir, storage, dirs_exist_ok=True)
    else:
        os.makedirs(storage, exist_ok=True)


async def restore_backup(filename: str, backup_dir: str | None = None) -> dict:
    """从指定备份恢复数据库与文件。

    流程：解压并校验完整性 → 快照当前库与文件（回退点）→ DROP/CREATE →
    pg_restore → 文件解压 → 任一步失败自动回退到恢复前状态。

    注意：管理员身份验证在 API 层完成（授权闸门），本函数不接收密码。

    Raises:
        FileNotFoundError: 备份文件不存在。
        ValueError: 解密失败或完整性校验失败（此时未做任何变更）。
        RuntimeError: 恢复过程中失败且已自动回退。
    """
    target_dir = backup_dir or _backup_dir()
    if os.path.basename(filename) != filename or "/" in filename or "\\" in filename:
        raise ValueError("非法的备份文件名")
    zip_path = os.path.join(target_dir, filename)
    if not os.path.isfile(zip_path):
        raise FileNotFoundError("备份文件不存在: %s" % filename)

    tmpdir = tempfile.mkdtemp(prefix="restore_")
    extracted = os.path.join(tmpdir, "extracted")
    snapshot_dump = os.path.join(tmpdir, "snapshot.dump")
    snapshot_files = os.path.join(tmpdir, "files_snapshot")
    os.makedirs(extracted, exist_ok=True)

    # Phase 1: 解压 + 完整性校验。
    # 此阶段失败时数据库与文件目录均未做任何变更，直接向上传播异常，不做回退。
    try:
        manifest = _extract_zip(zip_path, extracted)
    except (ValueError, RuntimeError) as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise

    # Phase 2: 快照 + 恢复。此阶段失败时可能已部分修改数据，必须回退。
    try:
        # 2a. 快照当前状态作为回退点
        if os.path.isdir(settings.FILE_STORAGE_PATH):
            shutil.copytree(
                settings.FILE_STORAGE_PATH, snapshot_files, dirs_exist_ok=True
            )
        await pg_dump_service.dump_database(snapshot_dump)

        # 2b. 恢复数据库
        await _restore_database_from_dump(os.path.join(extracted, "database.dump"))

        # 2c. 恢复文件目录
        _swap_file_storage(os.path.join(extracted, "files"))

        restored_at = datetime.now(timezone.utc).isoformat()
        logger.info(
            "恢复完成: %s（%d 表, %d 文件）",
            filename, manifest.get("table_count"), manifest.get("file_count"),
        )
        return {
            "restored_from": filename,
            "restored_at": restored_at,
            "table_count": manifest.get("table_count"),
            "file_count": manifest.get("file_count"),
            "backup_version": manifest.get("version"),
        }

    except Exception as e:
        rollback_result = await _rollback(snapshot_dump, snapshot_files)
        logger.error("恢复失败并已回退: %s；回退结果: %s", e, rollback_result)
        raise RuntimeError("恢复失败，已自动回退到恢复前状态: %s" % e) from e
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


async def _rollback(snapshot_dump: str, snapshot_files: str) -> str:
    """回退到恢复前状态。返回回退结果描述（永不抛出）。"""
    try:
        if os.path.isfile(snapshot_dump):
            await _restore_database_from_dump(snapshot_dump)
            db_result = "数据库已回退"
        else:
            db_result = "数据库无快照"
    except Exception as re:  # noqa: BLE001
        db_result = "数据库回退失败: %s" % re
        logger.error("回退数据库失败: %s", re)

    try:
        if os.path.isdir(snapshot_files):
            _swap_file_storage(snapshot_files)
            files_result = "文件已回退"
        else:
            files_result = "文件无快照"
    except Exception as re:  # noqa: BLE001
        files_result = "文件回退失败: %s" % re
        logger.error("回退文件失败: %s", re)

    return "%s；%s" % (db_result, files_result)
