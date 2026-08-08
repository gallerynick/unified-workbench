"""全量数据导出服务 — 31 表分页导出 JSON → 加密 ZIP

安全设计：
  - Pepper：存储在 system_config 表（JSONB value），首次使用时由 os.urandom(32) 生成
  - Salt：每次导出随机生成 32 字节，写入侧车文件 .salt，不与 ZIP 一同加密（避免鸡生蛋问题）
  - 密钥派生：PBKDF2(passphrase + pepper, salt, 600000 iterations) → AES-256 key
  - ZIP 加密：pyzipper AES-256 (WZ_AES, nbits=256)
  - 解密条件：管理员需同时持有 ZIP 文件 + salt + 密码短语 + 服务端 pepper 才能解密
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
from app.models import (
    Announcement,
    Budget,
    CalendarEvent,
    Contact,
    Content,
    FileShare,
    Form,
    FormResponse,
    Inventory,
    Note,
    Notification,
    Project,
    Reminder,
    Secret,
    SecretCategory,
    Server,
    Service,
    StreamRoom,
    Subscription,
    System,
    SystemConfig,
    Tag,
    Task,
    Template,
    Topology,
    User,
    UserTag,
    Vote,
    VoteRecord,
)
from app.version import __version__

settings = get_settings()

# ── 表导出顺序（按外键依赖：先父表后子表） ──────────────────────────
EXPORT_TABLE_ORDER = [
    "user",
    "user_tag",
    "system_config",
    "tag",
    "announcement",
    "budget",
    "subscription",
    "calendar_event",
    "contact",
    "content",
    "file_share",
    "form",
    "form_response",
    "inventory",
    "note",
    "notification",
    "project",
    "reminder",
    "secret_category",
    "secret",
    "server",
    "system",
    "service",
    "stream_room",
    "task",
    "template",
    "topology",
    "vote",
    "vote_record",
]

# 表名 → SQLAlchemy Model 映射
TABLE_MODEL_MAP: dict[str, type] = {
    "user": User,
    "user_tag": UserTag,
    "system_config": SystemConfig,
    "tag": Tag,
    "announcement": Announcement,
    "budget": Budget,
    "subscription": Subscription,
    "calendar_event": CalendarEvent,
    "contact": Contact,
    "content": Content,
    "file_share": FileShare,
    "form": Form,
    "form_response": FormResponse,
    "inventory": Inventory,
    "note": Note,
    "notification": Notification,
    "project": Project,
    "reminder": Reminder,
    "secret_category": SecretCategory,
    "secret": Secret,
    "server": Server,
    "system": System,
    "service": Service,
    "stream_room": StreamRoom,
    "task": Task,
    "template": Template,
    "topology": Topology,
    "vote": Vote,
    "vote_record": VoteRecord,
}

# 跳过表：无需导出的表（file_share 为临时共享记录，不在导出范围内）
SKIP_TABLES: set[str] = {"user_notification_config", "file_share"}


# ═══════════════════════ Pepper 管理 ══════════════════════════════════

async def get_or_create_pepper(db: AsyncSession) -> bytes:
    """从 system_config 获取或创建 data_export_pepper。

    SystemConfig.value 列类型为 JSONB (dict)，因此 pepper 以
    ``{"pepper": "<hex>"}`` 格式存储。
    """
    result = await db.execute(
        select(SystemConfig).where(SystemConfig.key == "data_export_pepper"),
    )
    config = result.scalar_one_or_none()

    if config is not None and isinstance(config.value, dict) and "pepper" in config.value:
        return bytes.fromhex(config.value["pepper"])

    # 不存在或格式非法 → 生成新的 pepper
    pepper_bytes = os.urandom(32)
    pepper_hex = pepper_bytes.hex()
    if config is not None:
        config.value = {"pepper": pepper_hex}
    else:
        db.add(SystemConfig(key="data_export_pepper", value={"pepper": pepper_hex}))
    await db.commit()
    return pepper_bytes


# ═══════════════════════ 密钥派生 ════════════════════════════════════

def derive_key(passphrase: str, pepper: bytes, salt: bytes) -> bytes:
    """PBKDF2-HMAC-SHA256(passphrase + pepper, salt, 600000, dklen=32)。"""
    combined = passphrase.encode("utf-8") + pepper
    return hashlib.pbkdf2_hmac("sha256", combined, salt, 600000, dklen=32)


# ═══════════════════════ 核心导出逻辑 ════════════════════════════════

async def export_all(
    db: AsyncSession,
    passphrase: str,
    progress_callback: Callable[[dict], None] | None = None,
) -> tuple[str, bytes]:
    """导出全量数据至加密 ZIP，返回 ``(zip_path, salt_bytes)``。

    Raises:
        ImportError / ValueError: 缺少 pyzipper 时抛出。
    """
    try:
        import pyzipper  # noqa: F811
    except ImportError:
        raise ValueError("pyzipper 未安装，请运行 pip install pyzipper")

    pepper = await get_or_create_pepper(db)
    salt = os.urandom(32)
    key = derive_key(passphrase, pepper, salt)

    tmpdir = tempfile.mkdtemp(prefix="export_")
    tables_dir = os.path.join(tmpdir, "tables")
    files_dir = os.path.join(tmpdir, "files")
    os.makedirs(tables_dir, exist_ok=True)
    os.makedirs(files_dir, exist_ok=True)

    exported_count = 0
    total_rows = 0
    file_count = 0
    total_tables = len(EXPORT_TABLE_ORDER)

    # ── Phase 1: 导出数据库表 ──────────────────────────────────────
    for idx, table_name in enumerate(EXPORT_TABLE_ORDER):
        if table_name in SKIP_TABLES:
            continue
        if progress_callback is not None:
            progress_callback({
                "phase": "export",
                "status": "running",
                "completed_tables": exported_count,
                "total_tables": total_tables,
                "current_table": table_name,
            })

        model = TABLE_MODEL_MAP.get(table_name)
        if model is None:
            continue

        rows: list[dict] = []
        page = 0
        page_size = 1000
        while True:
            offset = page * page_size
            result = await db.execute(
                select(model).offset(offset).limit(page_size),
            )
            batch = result.scalars().all()
            if not batch:
                break
            for row in batch:
                row_dict: dict = {}
                for col in row.__table__.columns:
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
            page += 1
            if len(batch) < page_size:
                break

        total_rows += len(rows)
        table_path = os.path.join(tables_dir, f"{table_name}.json")
        with open(table_path, "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, default=str)
        exported_count += 1

    # ── Phase 2: 复制用户文件 ──────────────────────────────────────
    storage_path = settings.FILE_STORAGE_PATH
    if os.path.isdir(storage_path):
        for root, _dirs, filenames in os.walk(storage_path):
            for filename in filenames:
                src = os.path.join(root, filename)
                rel = os.path.relpath(src, storage_path)
                dst = os.path.join(files_dir, rel)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(src, dst)
                file_count += 1

    # ── Phase 3: 生成 manifest ─────────────────────────────────────
    manifest = {
        "app_id": "unified-workbench",
        "version": __version__,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "tables": [t for t in EXPORT_TABLE_ORDER if t not in SKIP_TABLES],
        "total_rows": total_rows,
        "file_count": file_count,
    }
    manifest_path = os.path.join(tmpdir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    # ── Phase 4: 打包为 AES-256 加密 ZIP ───────────────────────────
    zip_path = os.path.join(tmpdir, "export.zip")
    with pyzipper.AESZipFile(
        zip_path,
        "w",
        compression=pyzipper.ZIP_DEFLATED,
        encryption=pyzipper.WZ_AES,
    ) as zf:
        zf.setpassword(key)
        zf.setencryption(pyzipper.WZ_AES, nbits=256)
        zf.write(manifest_path, "manifest.json")
        for table_name in [t for t in EXPORT_TABLE_ORDER if t not in SKIP_TABLES]:
            table_path = os.path.join(tables_dir, f"{table_name}.json")
            if os.path.exists(table_path):
                zf.write(table_path, f"tables/{table_name}.json")
        for root, _dirs, filenames in os.walk(files_dir):
            for filename in filenames:
                src = os.path.join(root, filename)
                rel = os.path.relpath(src, files_dir)
                zf.write(src, f"files/{rel}")

    return zip_path, salt


# ═══════════════════════ 导出任务追踪（内存模式） ════════════════════

_export_tasks: dict[str, dict] = {}


async def start_export(db: AsyncSession, passphrase: str) -> str:
    """启动异步导出，返回 export_id（UUID）。"""
    export_id = str(uuid.uuid4())
    _export_tasks[export_id] = {
        "status": "running",
        "completed_tables": 0,
        "total_tables": len(EXPORT_TABLE_ORDER),
        "current_table": "",
        "zip_path": None,
        "salt_hex": None,
        "error": None,
        "total_rows": 0,
        "file_count": 0,
    }
    try:
        zip_path, salt_bytes = await export_all(db, passphrase)
        _export_tasks[export_id]["status"] = "completed"
        _export_tasks[export_id]["zip_path"] = zip_path
        _export_tasks[export_id]["salt_hex"] = salt_bytes.hex()
        _export_tasks[export_id]["completed_tables"] = len(EXPORT_TABLE_ORDER)
    except Exception as e:
        _export_tasks[export_id]["status"] = "failed"
        _export_tasks[export_id]["error"] = str(e)
    return export_id


def get_export_status(export_id: str) -> dict | None:
    """查询导出任务状态。"""
    return _export_tasks.get(export_id)


def get_export_path(export_id: str) -> tuple[str, str] | None:
    """返回 ``(zip_path, salt_hex)``，仅已完成任务有效。"""
    task = _export_tasks.get(export_id)
    if task is None or task.get("status") != "completed":
        return None
    return task["zip_path"], task["salt_hex"]
