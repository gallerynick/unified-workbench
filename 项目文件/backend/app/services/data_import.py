"""全量数据导入服务 — 加密 ZIP 解密 → 版本校验 → 清空覆盖

安全设计：
  - Pepper：从服务端 system_config 表读取（与导出时相同）
  - Salt：由用户随 ZIP 一并提供（十六进制），不在加密 ZIP 内
  - 密钥派生：PBKDF2(passphrase + pepper, salt, 600000 iterations) → AES-256 key
  - 解密条件：管理员需同时持有 ZIP 文件 + salt + 密码短语 + 服务端 pepper 才能解密
"""

from __future__ import annotations

import json
import os
import shutil
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert  # noqa: F401

from app.core.config import get_settings
from app.services.data_export import (
    derive_key,
    get_or_create_pepper,
    EXPORT_TABLE_ORDER,
    TABLE_MODEL_MAP,
)
from app.services.data_migrations import apply_migration_chain
from app.version import __version__

settings = get_settings()


# ── 版本比较工具 ────────────────────────────────────────────────────────


def _version_gt(a: str, b: str) -> bool:
    """语义化版本比较：a > b 返回 True。"""
    parts_a = tuple(int(x) for x in a.split("."))
    parts_b = tuple(int(x) for x in b.split("."))
    return parts_a > parts_b


def _parse_datetimes(records: list[dict]) -> list[dict]:
    """将记录中的 ISO 时间字符串还原为 datetime 对象。"""
    for r in records:
        for k, v in list(r.items()):
            if isinstance(v, str) and len(v) >= 19 and v[4] == '-' and v[10] == 'T':
                try:
                    # fromisoformat handles timezone-aware (+00:00) and naive strings
                    r[k] = datetime.fromisoformat(v)
                except (ValueError, TypeError):
                    pass
    return records


# ═══════════════════════ 1. 读取清单 ═══════════════════════════════════


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
        raise ValueError(f"无法读取清单文件（密码或 salt 错误）: {e}")


# ═══════════════════════ 2. 版本校验 ═══════════════════════════════════


def validate_version(manifest_version: str) -> None:
    """校验数据版本与当前应用版本的兼容性。

    - manifest_version > __version__ → 拒绝（数据来源版本高于当前）
    - manifest_version == __version__ → 直接导入，无需迁移
    - manifest_version < __version__ → 导入时由迁移链处理版本升级

    Raises:
        ValueError: 数据来源版本高于当前版本时抛出。
    """
    if _version_gt(manifest_version, __version__):
        raise ValueError("数据来源版本高于当前版本，无法导入")
    # == : 无需迁移
    # <  : 迁移链将在 import_table_data 中处理


# ═══════════════════════ 3. 清空数据库 ══════════════════════════════════


async def truncate_all_tables(db: AsyncSession) -> None:
    """按反向 FK 依赖顺序清空所有数据表（子表优先，避免外键冲突）。

    遍历 EXPORT_TABLE_ORDER 的逆序，对每个表执行 TRUNCATE CASCADE。
    """
    for table_name in reversed(EXPORT_TABLE_ORDER):
        model = TABLE_MODEL_MAP.get(table_name)
        if model is None:
            continue
        await db.execute(text(f'TRUNCATE TABLE "{table_name}" CASCADE'))
    await db.commit()


# ═══════════════════════ 3.5. 紧急备份与回退 ══════════════════════════════


async def _backup_tables(db: AsyncSession, backup_dir: str) -> None:
    """导出所有表到 backup_dir 作为紧急回退点。"""
    os.makedirs(backup_dir, exist_ok=True)
    for table_name in EXPORT_TABLE_ORDER:
        model = TABLE_MODEL_MAP.get(table_name)
        if not model:
            continue
        result = await db.execute(select(model))
        rows = []
        for row in result.scalars().all():
            row_dict = {}
            for col in model.__table__.columns:
                val = getattr(row, col.name)
                if isinstance(val, datetime):
                    row_dict[col.name] = val.isoformat()
                elif isinstance(val, uuid.UUID):
                    row_dict[col.name] = str(val)
                elif isinstance(val, bytes):
                    row_dict[col.name] = val.hex()
                else:
                    row_dict[col.name] = val
            rows.append(row_dict)
        with open(os.path.join(backup_dir, f"{table_name}.json"), "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, default=str)


async def _restore_from_backup(db: AsyncSession, backup_dir: str) -> bool:
    """从备份恢复所有表。成功返回 True。"""
    try:
        # TRUNCATE all (reverse order)
        for table_name in reversed(EXPORT_TABLE_ORDER):
            model = TABLE_MODEL_MAP.get(table_name)
            if not model:
                continue
            await db.execute(text(f'TRUNCATE TABLE "{table_name}" CASCADE'))
        await db.commit()
        # Import from backup
        for table_name in EXPORT_TABLE_ORDER:
            model = TABLE_MODEL_MAP.get(table_name)
            if not model:
                continue
            path = os.path.join(backup_dir, f"{table_name}.json")
            if not os.path.exists(path):
                continue
            with open(path, "r", encoding="utf-8") as f:
                records = json.load(f)
            _parse_datetimes(records)
            for i in range(0, len(records), 500):
                await db.execute(model.__table__.insert(), records[i:i+500])
            await db.commit()
        return True
    except Exception:
        return False


# ═══════════════════════ 4. 导入单表数据 ════════════════════════════════


async def import_table_data(
    db: AsyncSession,
    table_name: str,
    records: list[dict],
    manifest_version: str,
) -> int:
    """导入单个表的数据：先迁移到当前版本格式，再批量写入。

    Args:
        db:              数据库会话。
        table_name:      表名。
        records:         原始记录列表（来自 JSON）。
        manifest_version: 数据来源版本号。

    Returns:
        实际导入的行数。如果迁移后返回空列表（如表已被删除），返回 0。
    """
    # 1. 版本迁移
    transformed = await apply_migration_chain(
        manifest_version,
        __version__,
        table_name,
        records,
    )

    # 迁移链可能返回空列表（如表在新版本中已删除），直接跳过
    if not transformed:
        return 0

    # 2. 获取模型
    model = TABLE_MODEL_MAP.get(table_name)
    if model is None:
        return 0

    # 3. 批量写入（TRUNCATE 后无冲突，直接 insert）
    batch_size = 500
    total = 0
    for i in range(0, len(transformed), batch_size):
        batch = transformed[i : i + batch_size]
        await db.execute(model.__table__.insert(), batch)
        await db.commit()
        total += len(batch)

    return total


# ═══════════════════════ 5. 导入文件 ════════════════════════════════════


def copy_imported_files(
    zip_path: str,
    passphrase: str,
    pepper: bytes,
    salt: bytes,
) -> int:
    """从加密 ZIP 中提取文件到 FILE_STORAGE_PATH。

    ZIP 内部路径 ``files/<relative>`` 映射到 ``<FILE_STORAGE_PATH>/<relative>``。

    Args:
        zip_path:   加密 ZIP 文件路径。
        passphrase: 用户输入的密码短语。
        pepper:     服务端存储的 pepper。
        salt:       导出时生成的 salt。

    Returns:
        成功提取的文件数量。
    """
    try:
        import pyzipper
    except ImportError:
        raise ValueError("pyzipper 未安装，请运行 pip install pyzipper")

    key = derive_key(passphrase, pepper, salt)
    count = 0
    storage_path = settings.FILE_STORAGE_PATH

    with pyzipper.AESZipFile(zip_path, "r", encryption=pyzipper.WZ_AES) as zf:
        zf.setpassword(key)
        for name in zf.namelist():
            # 跳过目录条目和非文件条目
            if name.endswith("/") or not name.startswith("files/"):
                continue
            rel = name[len("files/") :]
            if not rel:
                continue

            dest = os.path.join(storage_path, rel)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with zf.open(name) as src, open(dest, "wb") as dst:
                shutil.copyfileobj(src, dst)
            count += 1

    return count


# ═══════════════════════ 6. 总编排 ══════════════════════════════════════


async def import_all(
    db: AsyncSession,
    zip_path: str,
    passphrase: str,
    salt_hex: str,
) -> dict:
    """导入全量数据的完整编排流程（含紧急备份与回退）。

    流程：
      1. 获取服务端 pepper
      2. 解码 salt（十六进制 → 字节）
      3. 读取并校验 manifest
      4. 紧急备份现有数据
      5. 清空数据库（子表优先）
      6. 逐表读取 JSON + 迁移 + 批量写入
      7. 提取文件到存储目录
      8. 删除加密 ZIP
      导入失败时自动从备份回退。

    Args:
        db:         数据库会话。
        zip_path:   加密 ZIP 文件路径。
        passphrase: 用户输入的密码短语。
        salt_hex:   十六进制编码的 salt 字符串。

    Returns:
        stats 字典：
        ``{imported_tables, imported_rows, total_tables, file_count, errors, backup_size, rollback}``。
        失败时 errors 非空，rollback 指示是否已执行回退。
    """
    import tempfile

    errors: list[str] = []
    imported_tables = 0
    imported_rows = 0
    file_count = 0
    backup_size = 0
    rollback = False
    backup_dir = None

    def _early_return(**overrides):
        return {
            "imported_tables": 0,
            "imported_rows": 0,
            "total_tables": 0,
            "file_count": 0,
            "errors": [],
            "backup_size": 0,
            "rollback": False,
        } | overrides

    # ── 1. 获取 pepper ──────────────────────────────────────────────
    try:
        pepper = await get_or_create_pepper(db)
    except Exception as e:
        return _early_return(errors=[f"获取服务端 pepper 失败: {e}"])

    # ── 2. 解码 salt ─────────────────────────────────────────────────
    try:
        salt = bytes.fromhex(salt_hex)
    except (ValueError, TypeError) as e:
        return _early_return(errors=[f"salt 格式无效（需为十六进制字符串）: {e}"])

    # ── 3. 读取 manifest ────────────────────────────────────────────
    try:
        manifest = read_manifest(zip_path, passphrase, pepper, salt)
    except Exception as e:
        return _early_return(errors=[f"读取清单文件失败: {e}"])

    # ── 4. 版本校验 ─────────────────────────────────────────────────
    try:
        validate_version(manifest["version"])
    except Exception as e:
        return _early_return(errors=[f"版本校验失败: {e}"])

    manifest_version: str = manifest["version"]
    table_list: list[str] = manifest.get("tables", [])
    total_tables = len(table_list)

    # ── 5. 紧急备份现有数据 ─────────────────────────────────────────
    backup_dir = tempfile.mkdtemp(prefix="import_backup_")
    try:
        await _backup_tables(db, backup_dir)
        backup_size = sum(1 for f in os.listdir(backup_dir) if f.endswith(".json"))
    except Exception as e:
        errors.append(f"备份现有数据失败: {e}")
        if backup_dir and os.path.isdir(backup_dir):
            shutil.rmtree(backup_dir, ignore_errors=True)
        return _early_return(total_tables=total_tables, errors=errors, backup_size=backup_size)

    # ── 6-8. 清空 → 导入 → 文件 → 清理（含自动回退）────────────────
    try:
        # ── 6. 清空数据库 ───────────────────────────────────────────
        await truncate_all_tables(db)

        # ── 7. 导入表数据 ───────────────────────────────────────────
        try:
            import pyzipper
        except ImportError:
            raise RuntimeError("pyzipper 未安装，请运行 pip install pyzipper")

        key = derive_key(passphrase, pepper, salt)

        with pyzipper.AESZipFile(zip_path, "r", encryption=pyzipper.WZ_AES) as zf:
            zf.setpassword(key)

            for table_name in table_list:
                try:
                    entry_name = f"tables/{table_name}.json"
                    raw = zf.read(entry_name)
                    records: list[dict] = json.loads(raw.decode("utf-8"))
                    _parse_datetimes(records)
                except KeyError:
                    errors.append(f"ZIP 中缺少表数据: {table_name}")
                    continue
                except json.JSONDecodeError as e:
                    errors.append(f"表 {table_name} JSON 解析失败: {e}")
                    continue

                try:
                    rows = await import_table_data(
                        db, table_name, records, manifest_version,
                    )
                    imported_rows += rows
                    imported_tables += 1
                except Exception as e:
                    errors.append(f"导入表 {table_name} 失败: {e}")

        # ── 8. 导入文件 ─────────────────────────────────────────────
        try:
            file_count = copy_imported_files(zip_path, passphrase, pepper, salt)
        except Exception as e:
            errors.append(f"导入文件失败: {e}")

        # ── 9. 清理加密 ZIP ─────────────────────────────────────────
        try:
            os.remove(zip_path)
        except OSError:
            pass

    except Exception as e:
        errors.append(f"导入过程失败: {e}")
        # 执行紧急回退
        restore_ok = await _restore_from_backup(db, backup_dir)
        rollback = True
        if not restore_ok:
            errors.append("紧急回退失败，数据可能丢失！")
        return {
            "imported_tables": imported_tables,
            "imported_rows": imported_rows,
            "total_tables": total_tables,
            "file_count": file_count,
            "errors": errors,
            "backup_size": backup_size,
            "rollback": rollback,
        }
    finally:
        # 无论成功失败，清理临时备份目录
        if backup_dir and os.path.isdir(backup_dir):
            shutil.rmtree(backup_dir, ignore_errors=True)

    return {
        "imported_tables": imported_tables,
        "imported_rows": imported_rows,
        "total_tables": total_tables,
        "file_count": file_count,
        "errors": errors,
        "backup_size": backup_size,
        "rollback": rollback,
    }


# ═══════════════════════ 导入任务追踪（内存模式） ════════════════════════

_import_tasks: dict[str, dict] = {}


async def start_import(
    db: AsyncSession,
    zip_path: str,
    passphrase: str,
    salt_hex: str,
) -> str:
    """启动异步导入，返回 import_id（UUID）。

    Args:
        db:         数据库会话。
        zip_path:   加密 ZIP 文件路径。
        passphrase: 用户输入的密码短语。
        salt_hex:   十六进制编码的 salt 字符串。

    Returns:
        import_id，用于查询进度。
    """
    task_id = str(uuid.uuid4())
    _import_tasks[task_id] = {
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "stats": None,
        "error": None,
    }
    try:
        stats = await import_all(db, zip_path, passphrase, salt_hex)
        _import_tasks[task_id]["status"] = "completed"
        _import_tasks[task_id]["stats"] = stats
    except Exception as e:
        _import_tasks[task_id]["status"] = "failed"
        _import_tasks[task_id]["error"] = str(e)
    return task_id


def get_import_status(task_id: str) -> dict | None:
    """查询导入任务状态。

    Returns:
        任务状态字典，包含 status/stats/error 等字段。任务不存在时返回 None。
    """
    return _import_tasks.get(task_id)
