"""备份服务测试"""

import os
import tempfile

from app.services.backup import cleanup_old_backups, delete_backup, list_backups


def test_list_backups_empty():
    """空目录返回空列表。"""
    with tempfile.TemporaryDirectory() as tmpdir:
        result = list_backups(tmpdir)
        assert result == []


def test_list_backups_nonexistent():
    """不存在的目录返回空列表。"""
    result = list_backups("/nonexistent/path")
    assert result == []


def test_delete_backup_not_found():
    """删除不存在的文件返回 False。"""
    with tempfile.TemporaryDirectory() as tmpdir:
        result = delete_backup("nonexistent.sql.gz", tmpdir)
        assert result is False


def test_cleanup_old_backups():
    """清理超过 max_keep 数量的旧备份。"""
    with tempfile.TemporaryDirectory() as tmpdir:
        # 创建 10 个假备份文件
        for i in range(10):
            filepath = os.path.join(tmpdir, f"backup_20260101_{i:06d}.sql.gz")
            with open(filepath, "w") as f:
                f.write("test")

        deleted = cleanup_old_backups(tmpdir, max_keep=5)
        assert deleted == 5
        assert len(list_backups(tmpdir)) == 5
