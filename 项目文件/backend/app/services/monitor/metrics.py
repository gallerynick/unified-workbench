"""资源指标纯函数：压力计算、cgroup 解析、历史降采样。

本模块刻意不依赖 psutil —— psutil 属运行时采集依赖，测试环境可能未安装；
把可测的判定逻辑与采集逻辑分离，单测可直接 import 本模块验证核心规则。
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

# ── 压力等级阈值 ────────────────────────────────────────────
# 区间：[0,60) 正常 / [60,80) 偏高 / [80,95) 紧张 / [95,+∞) 过载
NORMAL_MAX = 60.0
ELEVATED_MAX = 80.0
HIGH_MAX = 95.0
# 维度值达到该值即写入「压力成因」文案
CAUSE_THRESHOLD = 60.0

LEVEL_NORMAL = ("normal", "正常")
LEVEL_ELEVATED = ("elevated", "偏高")
LEVEL_HIGH = ("high", "紧张")
LEVEL_CRITICAL = ("critical", "过载")


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    """把数值夹到闭区间内，避免负值或超过 100 的百分比。"""
    return max(low, min(high, value))


def classify_level(value: float) -> tuple[str, str]:
    """返回 (等级码, 中文标签)。区间边界取「左闭右开」。"""
    v = clamp(value)
    if v < NORMAL_MAX:
        return LEVEL_NORMAL
    if v < ELEVATED_MAX:
        return LEVEL_ELEVATED
    if v < HIGH_MAX:
        return LEVEL_HIGH
    return LEVEL_CRITICAL


@dataclass(frozen=True)
class PressureDimension:
    """单个压力维度。"""

    key: str
    label: str
    value: float


@dataclass(frozen=True)
class PressureResult:
    """压力计算结果。index 取各维度中最严重者。"""

    index: float
    level: str
    level_label: str
    dimensions: tuple[PressureDimension, ...]
    causes: tuple[str, ...]


def compute_pressure(
    cpu_total: float,
    cpu_iowait: float,
    memory_total: int,
    memory_available: int,
    load1: float,
    cores: int,
    swap_total: int = 0,
    swap_percent: float = 0.0,
) -> PressureResult:
    """按四个维度计算压力（各 0–100），综合压力取最严重者。

    - CPU：max(总占用, iowait) —— iowait 是 CPU 忙于等 IO，同样算压力
    - 内存：(total - available) / total —— available 已排除可回收缓存
    - 负载：load1 / 核心数 —— 1.0 即每核满载
    - 交换：swap 已用占比（无 swap 时不列为维度）
    """
    safe_cores = max(cores, 1)
    dimensions = [
        PressureDimension("cpu", "CPU", round(clamp(max(cpu_total, cpu_iowait)), 1)),
        PressureDimension(
            "memory",
            "内存",
            round(clamp((memory_total - memory_available) / memory_total * 100, 0, 100), 1)
            if memory_total > 0
            else 0.0,
        ),
        PressureDimension("load", "负载", round(clamp(load1 / safe_cores * 100), 1)),
    ]
    if swap_total > 0:
        dimensions.append(PressureDimension("swap", "交换", round(clamp(swap_percent), 1)))
    index = max(d.value for d in dimensions)
    level, label = classify_level(index)
    causes = tuple(d.label for d in dimensions if d.value >= CAUSE_THRESHOLD)
    return PressureResult(
        index=index,
        level=level,
        level_label=label,
        dimensions=tuple(dimensions),
        causes=causes,
    )


def pressure_to_dict(result: PressureResult) -> dict[str, Any]:
    """转换为可 JSON 序列化结构（供 API 响应使用）。"""
    return asdict(result)


# ── cgroup 解析 ────────────────────────────────────────────

# cgroup v1 的默认「无限制」上限（8 EiB）
V1_UNLIMITED_MARKERS = {"max", "9223372036854771712"}


def parse_cpu_quota(raw: str | None) -> tuple[float | None, float]:
    """解析 cgroup v2 的 cpu.max。

    格式为 "<quota_us> <period_us>"；配额为 "max" 表示未设限制。

    Returns:
        (配额核心数, 周期微秒)。无配额时配额为 None。
    """
    if not raw:
        return None, 100_000.0
    parts = raw.split()
    if len(parts) < 2:
        return None, 100_000.0
    quota_raw, period_raw = parts[0], parts[1]
    try:
        period = int(period_raw)
    except ValueError:
        period = 0
    if period <= 0:
        period = 100_000
    if quota_raw == "max":
        return None, float(period)
    try:
        return int(quota_raw) / period, float(period)
    except ValueError:
        return None, float(period)


def is_unlimited_memory(raw: str | None) -> bool:
    """判断内存上限是否为「无限制」。"""
    if not raw:
        return True
    return raw.strip().lower() in V1_UNLIMITED_MARKERS


def parse_int(raw: str | None) -> int | None:
    """宽松解析整数；空值或非法值返回 None。"""
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def parse_keyed_stat(raw: str | None, keys: tuple[str, ...]) -> dict[str, int]:
    """解析 cgroup 键值统计文件（如 cpu.stat / memory.events）。

    每行形如 "usage_usec 123456"；只返回 keys 中出现的键。
    """
    out: dict[str, int] = {}
    if not raw:
        return out
    for line in raw.splitlines():
        parts = line.split()
        if len(parts) < 2 or parts[0] not in keys:
            continue
        try:
            out[parts[0]] = int(parts[1])
        except ValueError:
            continue
    return out


# ── 历史降采样 ────────────────────────────────────────────


def downsample_series(values: list[float], max_points: int) -> list[float]:
    """等距降采样，保留首尾两点，用于控制历史 payload 体积。"""
    if max_points <= 0 or len(values) <= max_points:
        return list(values)
    step = (len(values) - 1) / (max_points - 1)
    picked = [values[int(round(i * step))] for i in range(max_points - 1)]
    picked.append(values[-1])
    return picked


# ── 累计计数器速率 ────────────────────────────────────────


def prev_counter(prior: dict[str, int] | None, key: str) -> int | None:
    """取上一轮累计值；首样本无基准时返回 None（速率为 0）。"""
    return prior[key] if prior else None


def rate_per_second(current: int, previous: int | None, dt: float) -> int:
    """由累计计数器计算每秒速率。

    首个样本无基准（或计数器回退，如容器重启）时返回 0：累计值本身是
    开机以来的总量，直接与 0 相除会得到天文数字。
    """
    if previous is None or dt <= 0:
        return 0
    # 分母是 float，// 会返回 float，这里强制转 int 保持响应为整型
    return int(max(current - previous, 0) // max(dt, 0.001))
