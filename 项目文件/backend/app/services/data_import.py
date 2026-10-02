"""全量数据导入服务 — AES-256 解密 → 版本校验 → pg_restore 恢复

安全设计：
  - Pepper：从服务端 system_config 表读取（与导出时相同）
  - Salt：由用户随 ZIP 一并提供（十六进制），不在加密 ZIP 内
  - 密钥派生：PBKDF2(passphrase + pepper, salt, 600000 iterations) → AES-256 key
  - 解密条件：管理员需同时持有 ZIP 文件 + salt + 密码短语 + 服务端 pepper 才能解密

流程：解密 → 校验 SHA256 → 版本校验 → 快照当前库与文件 →
DROP/CREATE → pg_restore → 文件解压 → 任一步失败自动回退

同版本限制：仅允许与当前应用版本完全一致的数据包导入（不做跨版本迁移）。
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import get_settings
from app.core.database import isolated_session
from app.services import pg_dump_service
from app.services.data_export import derive_key, get_or_create_pepper
from app.version import __version__

settings = get_settings()


# === 版本校验 ===


def validate_version(manifest_version: str) -> None:
    """校验数据版本与当前应用版本的兼容性。

    仅允许完全一致版本导入，不做跨版本迁移。

    Raises:
        ValueError: 版本不匹配时抛出。
    """
    if manifest_version != __version__:
        raise ValueError(
            "数据来源版本 %s 与当前版本 %s 不兼容，无法导入"
            % (manifest_version, __version__)
        )


# === 哈希工具 ===


def _sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _sha256_file_tree(root_dir: str) -> tuple[str, int]:
    """对目录下所有文件计算 (files_sha256, file_count)。"""
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


# === 1. 读取清单 ===


def read_manifest(
    zip_path: str,
    passphrase: str,
    pepper: bytes,
    salt: bytes,
) -> dict:
    """从加密 ZIP 中读取并解析 manifest.json。

    Args:
        zip_path:   加密 ZIP 文件路径。
        passphrase: 用户输入的密码短语。
        pepper:     服务端存储的 pepper（32 字节）。
        salt:       导出时生成的随机 salt（32 字节）。

    Returns:
        解析后的 manifest 字典。

    Raises:
        ValueError: 密码或 salt 错误时抛出。
    """
    try:
        import pyzipper
    except ImportError:
        raise ValueError("pyzipper 未安装，请运行 pip install pyzipper")

    key = derive_key(passphrase, pepper, salt)
    try:
        with pyzipper.AESZipFile(zip_path, "r", encryption=pyzipper.WZ_AES) as zf:
            zf.setpassword(key)
            raw = zf.read("manifest.json")
            return json.loads(raw.decode("utf-8"))
    except (RuntimeError, KeyError) as e:
        raise ValueError("无法读取清单文件（密码或 salt 错误）: %s" % e)


# === 2. 解压与完整性校验 ===


def _extract_and_verify(
    zip_path: str,
    passphrase: str,
    pepper: bytes,
    salt: bytes,
    dest_dir: str,
) -> dict:
    """解密 ZIP 到 dest_dir 并校验 manifest 中的 SHA256 校验和。

    Raises:
        ValueError: 解密失败或完整性校验失败。
    """
    try:
        import pyzipper
    except ImportError:
        raise ValueError("pyzipper 未安装，请运行 pip install pyzipper")

    key = derive_key(passphrase, pepper, salt)
    try:
        with pyzipper.AESZipFile(zip_path, "r", encryption=pyzipper.WZ_AES) as zf:
            zf.setpassword(key)
            names = zf.namelist()
            if "manifest.json" not in names:
                raise ValueError("数据包缺少 manifest.json，文件可能已损坏")
            if "database.dump" not in names:
                raise ValueError("数据包缺少 database.dump，文件可能已损坏")
            zf.extractall(dest_dir)
    except RuntimeError as e:
        raise ValueError("数据包解密失败，密钥不匹配或文件已损坏: %s" % e)

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


# === 3. 恢复辅助函数 ===


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


async def _rollback(snapshot_dump: str, snapshot_files: str) -> str:
    """回退到导入前状态。返回回退结果描述（永不抛出）。"""
    try:
        if os.path.isfile(snapshot_dump):
            await _restore_database_from_dump(snapshot_dump)
            db_result = "数据库已回退"
        else:
            db_result = "数据库无快照"
    except Exception as re:  # noqa: BLE001
        db_result = "数据库回退失败: %s" % re

    try:
        if os.path.isdir(snapshot_files):
            _swap_file_storage(snapshot_files)
            files_result = "文件已回退"
        else:
            files_result = "文件无快照"
    except Exception as re:  # noqa: BLE001
        files_result = "文件回退失败: %s" % re

    return "%s；%s" % (db_result, files_result)


# === 4. 总编排 ===


async def import_all(
    zip_path: str,
    passphrase: str,
    salt_hex: str,
) -> dict:
    """导入全量数据的完整编排流程（含快照与自动回退）。

    流程：
      1. 获取服务端 pepper
      2. 解码 salt（十六进制 → 字节）
      3. 解压并校验完整性 + 版本校验
      4. 快照当前库与文件（回退点）
      5. DROP/CREATE → pg_restore
      6. 文件解压
      7. 删除数据包
      导入失败时自动从快照回退。

    Args:
        db:         数据库会话。
        zip_path:   加密 ZIP 文件路径。
        passphrase: 用户输入的密码短语。
        salt_hex:   十六进制编码的 salt 字符串。

    Returns:
        stats 字典。
    """
    errors: list[str] = []

    def _early_return(**overrides):
        result = {
            "imported_tables": 0,
            "imported_rows": 0,
            "total_tables": 0,
            "file_count": 0,
            "errors": [],
            "rollback": False,
        }
        result.update(overrides)
        return result

    # 1. 获取 pepper（使用独立 session，因为后续 DROP/CREATE 会断开连接）
    try:
        async with isolated_session() as db:
            pepper = await get_or_create_pepper(db)
    except Exception as e:
        return _early_return(errors=["获取服务端 pepper 失败: %s" % e])

    # 2. 解码 salt
    try:
        salt = bytes.fromhex(salt_hex)
    except (ValueError, TypeError) as e:
        return _early_return(errors=["salt 格式无效（需为十六进制字符串）: %s" % e])

    # 3. 解压 + 完整性校验 + 版本校验（失败时数据未被修改，无需回退）
    tmpdir = tempfile.mkdtemp(prefix="import_")
    extracted = os.path.join(tmpdir, "extracted")
    os.makedirs(extracted, exist_ok=True)

    try:
        manifest = _extract_and_verify(zip_path, passphrase, pepper, salt, extracted)
    except ValueError as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        return _early_return(errors=[str(e)])

    try:
        validate_version(manifest["version"])
    except ValueError as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        return _early_return(errors=[str(e)])

    table_count = manifest.get("table_count", 0)
    file_count = manifest.get("file_count", 0)

    # 4-7. 快照 + 恢复（失败时需要回退）
    snapshot_dump = os.path.join(tmpdir, "snapshot.dump")
    snapshot_files = os.path.join(tmpdir, "files_snapshot")
    rollback = False

    try:
        # 4. 快照当前状态作为回退点
        if os.path.isdir(settings.FILE_STORAGE_PATH):
            shutil.copytree(
                settings.FILE_STORAGE_PATH, snapshot_files, dirs_exist_ok=True
            )
        await pg_dump_service.dump_database(snapshot_dump)

        # 5. 恢复数据库
        await _restore_database_from_dump(os.path.join(extracted, "database.dump"))

        # 6. 恢复文件目录
        _swap_file_storage(os.path.join(extracted, "files"))

        # 7. 删除数据包
        try:
            os.remove(zip_path)
        except OSError:
            pass

        return {
            "imported_tables": 1,
            "imported_rows": 0,
            "total_tables": table_count,
            "file_count": file_count,
            "errors": errors,
            "rollback": False,
            "table_count": table_count,
            "version": manifest.get("version"),
        }

    except Exception as e:
        errors.append("导入过程失败: %s" % e)
        rollback_result = await _rollback(snapshot_dump, snapshot_files)
        rollback = True
        if "失败" in rollback_result:
            errors.append("回退异常: %s" % rollback_result)
        return {
            "imported_tables": 0,
            "imported_rows": 0,
            "total_tables": table_count,
            "file_count": file_count,
            "errors": errors,
            "rollback": rollback,
        }
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# === 5. 导入任务追踪（内存模式） ===

_import_tasks: dict[str, dict] = {}


async def start_import(
    zip_path: str,
    passphrase: str,
    salt_hex: str,
) -> str:
    """启动异步导入，返回 import_id（UUID）。"""
    task_id = str(uuid.uuid4())
    _import_tasks[task_id] = {
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "stats": None,
        "error": None,
    }
    try:
        stats = await import_all(zip_path, passphrase, salt_hex)
        _import_tasks[task_id]["status"] = "completed"
        _import_tasks[task_id]["stats"] = stats
    except Exception as e:
        _import_tasks[task_id]["status"] = "failed"
        _import_tasks[task_id]["error"] = str(e)
    return task_id


def get_import_status(task_id: str) -> dict | None:
    """查询导入任务状态。"""
    return _import_tasks.get(task_id)
