"""时间工具：项目统一时区 Asia/Shanghai。

《开发基准文档》7.1 要求数据库 / 容器 / Python 三层时区一致。
所有对外暴露的时间戳统一经此模块生成，避免各处各写一份偏移量。
"""

from datetime import UTC, datetime, timedelta, timezone

# 项目统一时区：Asia/Shanghai（UTC+8，无夏令时）
TZ_SHANGHAI = timezone(timedelta(hours=8))


def now_shanghai() -> datetime:
    """当前时间（aware datetime，+08:00）"""
    return datetime.now(TZ_SHANGHAI)


def now_shanghai_iso() -> str:
    """当前时间的 ISO8601 字符串，精确到秒，如 2026-09-08T12:00:00+08:00"""
    return now_shanghai().isoformat(timespec="seconds")
