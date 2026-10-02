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
        result = delete_backup("nonexistent.zip", tmpdir)
        assert result is False


def test_delete_backup_rejects_path_traversal():
    """含路径分隔符的文件名一律拒绝（防目录穿越）。"""
    with tempfile.TemporaryDirectory() as tmpdir:
        assert delete_backup("../secret.zip", tmpdir) is False
        assert delete_backup("a/b.zip", tmpdir) is False


def test_cleanup_old_backups():
    """清理超过 max_keep 数量的旧备份。"""
    with tempfile.TemporaryDirectory() as tmpdir:
        # 创建 10 个假备份文件（.zip，与 create_backup 的输出格式一致）
        for i in range(10):
            filepath = os.path.join(tmpdir, f"backup_20260101_{i:06d}.zip")
            with open(filepath, "w") as f:
                f.write("test")

        deleted = cleanup_old_backups(tmpdir, max_keep=5)
        assert deleted == 5
        assert len(list_backups(tmpdir)) == 5


def test_cleanup_old_backups_disabled():
    """max_keep<=0 时不清理任何备份。"""
    with tempfile.TemporaryDirectory() as tmpdir:
        for i in range(3):
            with open(os.path.join(tmpdir, f"backup_{i}.zip"), "w") as f:
                f.write("test")
        assert cleanup_old_backups(tmpdir, max_keep=0) == 0
        assert len(list_backups(tmpdir)) == 3
