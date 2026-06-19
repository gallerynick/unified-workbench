"""备份业务逻辑"""

from __future__ import annotations

import asyncio
import gzip
import logging
import os
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


async def create_backup(backup_dir: str = "/data/backups") -> str:
    """创建数据库备份。返回备份文件路径。"""
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{timestamp}.sql.gz"
    filepath = os.path.join(backup_dir, filename)

    # 使用 pg_dump 创建备份
    proc = await asyncio.create_subprocess_exec(
        "pg_dump", "-h", "db", "-U", "postgres", "-d", "unified_workbench",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        raise RuntimeError(f"pg_dump 失败: {stderr.decode()}")

    # 压缩备份
    with gzip.open(filepath, "wb") as f:
        f.write(stdout)

    logger.info(f"备份创建成功: {filepath}")
    return filepath


def list_backups(backup_dir: str = "/data/backups") -> list[dict]:
    """列出所有备份文件。"""
    if not os.path.exists(backup_dir):
        return []

    backups = []
    for f in sorted(Path(backup_dir).glob("backup_*.sql.gz"), reverse=True):
        stat = f.stat()
        backups.append({
            "filename": f.name,
            "size": stat.st_size,
            "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        })
    return backups


def delete_backup(filename: str, backup_dir: str = "/data/backups") -> bool:
    """删除指定备份文件。"""
    filepath = os.path.join(backup_dir, filename)
    if os.path.exists(filepath):
        os.remove(filepath)
        logger.info(f"备份已删除: {filepath}")
        return True
    return False


async def restore_backup(filename: str, backup_dir: str = "/data/backups") -> bool:
    """从备份恢复数据库。"""
    filepath = os.path.join(backup_dir, filename)
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"备份文件不存在: {filepath}")

    # 解压并恢复
    with gzip.open(filepath, "rb") as f:
        sql_content = f.read()

    proc = await asyncio.create_subprocess_exec(
        "psql", "-h", "db", "-U", "postgres", "-d", "unified_workbench",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate(input=sql_content)

    if proc.returncode != 0:
        raise RuntimeError(f"恢复失败: {stderr.decode()}")

    logger.info(f"备份恢复成功: {filepath}")
    return True


def cleanup_old_backups(backup_dir: str = "/data/backups", max_keep: int = 5) -> int:
    """清理旧备份，保留最新的 max_keep 个。"""
    backups = sorted(Path(backup_dir).glob("backup_*.sql.gz"))
    deleted = 0
    while len(backups) > max_keep:
        oldest = backups.pop(0)
        oldest.unlink()
        deleted += 1
        logger.info(f"清理旧备份: {oldest}")
    return deleted
