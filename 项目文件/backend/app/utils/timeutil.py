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


def wav_duration_seconds(audio_file_path: str | None) -> int | None:
    """读取 WAV 文件实际时长（秒）。

    会议时长必须以「实际录音时长」为准，而不是 started_at→ended_at 的墙钟时间：
    用户中途离开/暂停期间不录音，墙钟跨度会虚高（实测 35 分钟的会议记成 2.2 小时）。
    文件不存在或非标准 WAV 返回 None，由调用方回退到墙钟时间。
    """
    import os
    import struct

    if not audio_file_path or not os.path.isfile(audio_file_path):
        return None
    try:
        with open(audio_file_path, "rb") as fh:
            header = fh.read(44)
        if len(header) < 44 or header[:4] != b"RIFF" or header[8:12] != b"WAVE":
            return None
        data_size = struct.unpack("<I", header[40:44])[0]
        # 会议音频固定 16kHz / 16-bit / 单声道
        return int(data_size // (2 * 1 * 16000))
    except Exception:
        return None
