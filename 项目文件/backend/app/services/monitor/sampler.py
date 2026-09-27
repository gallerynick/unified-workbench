"""资源采样器：进程内单例 + 内存环形缓冲。

由 app.main.lifespan 启动与取消。采集在 asyncio.to_thread() 中执行，
不阻塞事件循环。

口径说明：
- 「运行环境」读取 /proc/stat、/proc/meminfo、/proc/loadavg。这些文件不隔
  命名空间，容器内取到的是整台机器的真实值；macOS / Windows 的 Docker
  Desktop 上「整机」实际是那台 Docker VM，前端按「运行环境」表述。
- 「本容器」读取 /sys/fs/cgroup（v2 主路径，v1 兜底），非 root 可读。
  未配置 deploy.resources.limits 时配额为 None，前端显示「未设配额」。
- 进程级磁盘 IO 不做：非 root 无法读取其他进程的 /proc/<pid>/io（内核限制），
  磁盘只取聚合值。
- 历史只存内存不落库：资源指标是瞬时态，持久化既无审计价值，也会与
  「审计日志只增不改不删」的语义混淆。
"""

from __future__ import annotations

import asyncio
import logging
import os
import platform
import time
from collections import deque
from typing import Any

import psutil

from app.services.monitor.metrics import (
    compute_pressure,
    downsample_series,
    is_unlimited_memory,
    parse_cpu_quota,
    parse_int,
    parse_keyed_stat,
    pressure_to_dict,
)

logger = logging.getLogger(__name__)

SAMPLE_INTERVAL_SECONDS = 1.0
HISTORY_SECONDS = 600  # 环形缓冲总时长（10 分钟）
DEFAULT_WINDOW_MINUTES = 5
MAX_HISTORY_POINTS = 300  # 下发历史上限，超出则等距降采样
PROCESS_SET_LIMIT = 2000  # 进程枚举上限，避免异常进程表拖垮采样

CGROUP_ROOT = "/sys/fs/cgroup"
CGROUP_V2 = {
    "cpu_max": os.path.join(CGROUP_ROOT, "cpu.max"),
    "cpu_stat": os.path.join(CGROUP_ROOT, "cpu.stat"),
    "mem_max": os.path.join(CGROUP_ROOT, "memory.max"),
    "mem_current": os.path.join(CGROUP_ROOT, "memory.current"),
    "mem_events": os.path.join(CGROUP_ROOT, "memory.events"),
}
CGROUP_V1 = {
    "quota": "/sys/fs/cgroup/cpu/cpu.cfs_quota_us",
    "period": "/sys/fs/cgroup/cpu/cpu.cfs_period_us",
    "usage": "/sys/fs/cgroup/cpuacct/cpuacct.usage",
    "mem_limit": "/sys/fs/cgroup/memory/memory.limit_in_bytes",
    "mem_current": "/sys/fs/cgroup/memory/memory.usage_in_bytes",
}

DEFAULT_DISK = {"read_bytes": 0, "write_bytes": 0, "read_count": 0, "write_count": 0}
DEFAULT_NET = {"bytes_sent": 0, "bytes_recv": 0, "packets_sent": 0, "packets_recv": 0}

HISTORY_KEYS = (
    "ts",
    "cpu_total",
    "cpu_user",
    "cpu_system",
    "cpu_iowait",
    "memory_used_percent",
    "memory_cached_percent",
    "memory_buffers_percent",
    "memory_free_percent",
    "load1",
    "load5",
    "load15",
    "disk_read_bps",
    "disk_write_bps",
    "net_sent_bps",
    "net_recv_bps",
)


def _read_file(path: str) -> str | None:
    """读取 cgroup 文件；不存在或无权限时返回 None。"""
    try:
        with open(path, encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return None


def _mem_field(vm: psutil.svmem, name: str) -> int:
    """读取 svmem 字段。

    buffers / cached 只在 Linux 的 svmem 上存在（macOS 用 wired / compressed），
    缺失时按 0 处理，保证同一份代码在开发机与容器内都不会因字段差异崩溃。
    """
    return int(getattr(vm, name, 0) or 0)


def _rate(current: int, previous: int, dt: float) -> int:
    """由累计计数器计算每秒速率。计数器回退（容器重启）时返回 0。"""
    if dt <= 0:
        return 0
    return max(current - previous, 0) // max(dt, 0.001)


def _detect_container() -> bool:
    """判断是否运行在容器内（.dockerenv 为 Docker 官方标记文件）。"""
    try:
        if os.path.exists("/.dockerenv"):
            return True
        return "containerd" in (_read_file("/proc/1/cgroup") or "")
    except OSError:
        return False


def _flat_value(sample: dict[str, Any], key: str) -> float:
    """从样本的 flat 表取值；缺失时补 0.0 保持历史列对齐。"""
    flat = sample.get("flat")
    if not isinstance(flat, dict):
        return 0.0
    value = flat.get(key)
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


class ResourceSampler:
    """后台采样 + 环形缓冲。

    读写都在同一事件循环内（采集本身在线程池，但 _history 的 append 与
    读取均由协程触发），故无需加锁。
    """

    def __init__(self, interval: float = SAMPLE_INTERVAL_SECONDS) -> None:
        self._interval = interval
        self._history: deque[dict[str, Any]] = deque(maxlen=HISTORY_SECONDS)
        self._task: asyncio.Task[None] | None = None
        self._dt = interval
        self._last_mono: float | None = None
        self._last_disk: dict[str, int] = dict(DEFAULT_DISK)
        self._last_net: dict[str, int] = dict(DEFAULT_NET)
        self._last_container_cpu_usec: int | None = None
        self._procs: dict[int, psutil.Process] = {}

    # ── 生命周期 ────────────────────────────────────────────

    async def start(self) -> None:
        """启动后台采样。幂等：已在运行则直接返回。"""
        if self._task is not None and not self._task.done():
            return
        try:
            await asyncio.to_thread(self._prime)
        except Exception:  # noqa: BLE001 - 预热失败不应阻止采样启动
            logger.exception("资源采样预热失败")
        self._task = asyncio.create_task(self._run(), name="resource-sampler")

    async def stop(self) -> None:
        """停止采样（进程关闭时调用）。"""
        task, self._task = self._task, None
        if task is not None:
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass

    async def _run(self) -> None:
        """采样主循环。"""
        while True:
            try:
                now_mono = time.monotonic()
                dt = now_mono - self._last_mono if self._last_mono else self._interval
                self._last_mono = now_mono
                self._dt = max(dt, 0.001)
                sample = await asyncio.to_thread(self._collect)
                self._history.append(sample)
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 - 单周期失败不应终止采样器
                logger.exception("资源采样失败，跳过本周期")
            await asyncio.sleep(self._interval)

    # ── 采集 ────────────────────────────────────────────────

    def _prime(self) -> None:
        """预热采样基线。

        psutil 的 cpu_percent() 首次调用必然返回 0.0；进程 CPU 同理。
        不预热则首屏数据失真。
        """
        psutil.cpu_percent(percpu=True)
        psutil.cpu_times_percent(percpu=True)
        self._refresh_procs()
        for proc in self._procs.values():
            try:
                proc.cpu_percent(None)
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue

    def _collect(self) -> dict[str, Any]:
        """采集一次完整样本（同步执行，运行在线程池中）。"""
        cpu_percent = psutil.cpu_percent(percpu=True) or []
        agg_times = psutil.cpu_times_percent(percpu=False)
        vm = psutil.virtual_memory()
        swap = psutil.swap_memory()
        disk = psutil.disk_io_counters()
        net = psutil.net_io_counters()

        cores = max(psutil.cpu_count(logical=True) or len(cpu_percent) or 1, 1)
        try:
            load1, load5, load15 = os.getloadavg()
        except OSError:
            load1 = load5 = load15 = 0.0

        total = max(vm.total, 1)
        buffers = _mem_field(vm, "buffers")
        cached = _mem_field(vm, "cached")
        used = max(vm.total - vm.free - buffers - cached, 0)
        cpu_total = sum(cpu_percent) / max(len(cpu_percent), 1)

        disk_read = disk.read_bytes if disk else 0
        disk_write = disk.write_bytes if disk else 0
        disk_read_count = disk.read_count if disk else 0
        disk_write_count = disk.write_count if disk else 0
        net_sent = net.bytes_sent if net else 0
        net_recv = net.bytes_recv if net else 0
        net_sent_pkt = net.packets_sent if net else 0
        net_recv_pkt = net.packets_recv if net else 0
        prev_disk, prev_net = self._last_disk, self._last_net
        self._last_disk = {
            "read_bytes": disk_read,
            "write_bytes": disk_write,
            "read_count": disk_read_count,
            "write_count": disk_write_count,
        }
        self._last_net = {
            "bytes_sent": net_sent,
            "bytes_recv": net_recv,
            "packets_sent": net_sent_pkt,
            "packets_recv": net_recv_pkt,
        }

        self._refresh_procs()
        processes = self._collect_processes(20)

        pressure = compute_pressure(
            cpu_total=cpu_total,
            cpu_iowait=agg_times.iowait,
            memory_total=vm.total,
            memory_available=vm.available,
            load1=load1,
            cores=cores,
            swap_total=swap.total,
            swap_percent=swap.percent,
        )

        return {
            "host": {
                "ts": time.time(),
                "cores": cores,
                "cpu": {
                    "total": round(cpu_total, 2),
                    "per_core": [round(v, 2) for v in cpu_percent],
                    "breakdown": {
                        "user": round(agg_times.user, 2),
                        "system": round(agg_times.system, 2),
                        "iowait": round(agg_times.iowait, 2),
                        "steal": round(agg_times.steal, 2),
                        "idle": round(agg_times.idle, 2),
                    },
                },
                "memory": {
                    "total": vm.total,
                    "used": used,
                    "cached": cached,
                    "buffers": buffers,
                    "free": vm.free,
                    "available": vm.available,
                    "used_percent": round(used / total * 100, 2),
                },
                "swap": {
                    "total": swap.total,
                    "used": swap.used,
                    "free": swap.free,
                    "percent": swap.percent,
                },
                "load": {"load1": load1, "load5": load5, "load15": load15},
                "disk": {
                    "read_bytes_per_sec": _rate(disk_read, prev_disk["read_bytes"], self._dt),
                    "write_bytes_per_sec": _rate(disk_write, prev_disk["write_bytes"], self._dt),
                    "read_count_per_sec": _rate(
                        disk_read_count, prev_disk["read_count"], self._dt
                    ),
                    "write_count_per_sec": _rate(
                        disk_write_count, prev_disk["write_count"], self._dt
                    ),
                },
                "net": {
                    "bytes_sent_per_sec": _rate(net_sent, prev_net["bytes_sent"], self._dt),
                    "bytes_recv_per_sec": _rate(net_recv, prev_net["bytes_recv"], self._dt),
                    "packets_sent_per_sec": _rate(
                        net_sent_pkt, prev_net["packets_sent"], self._dt
                    ),
                    "packets_recv_per_sec": _rate(
                        net_recv_pkt, prev_net["packets_recv"], self._dt
                    ),
                },
            },
            "container": self._collect_container(),
            "processes": processes,
            "pressure": pressure_to_dict(pressure),
            "flat": {
                "ts": time.time(),
                "cpu_total": round(cpu_total, 2),
                "cpu_user": round(agg_times.user, 2),
                "cpu_system": round(agg_times.system, 2),
                "cpu_iowait": round(agg_times.iowait, 2),
                "memory_used_percent": round(used / total * 100, 2),
                "memory_cached_percent": round(vm.cached / total * 100, 2),
                "memory_buffers_percent": round(vm.buffers / total * 100, 2),
                "memory_free_percent": round(vm.free / total * 100, 2),
                "load1": load1,
                "load5": load5,
                "load15": load15,
                "disk_read_bps": _rate(disk_read, prev_disk["read_bytes"], self._dt),
                "disk_write_bps": _rate(disk_write, prev_disk["write_bytes"], self._dt),
                "net_sent_bps": _rate(net_sent, prev_net["bytes_sent"], self._dt),
                "net_recv_bps": _rate(net_recv, prev_net["bytes_recv"], self._dt),
            },
        }

    def _collect_container(self) -> dict[str, Any]:
        """采集本容器 cgroup 指标。v2 主路径，v1 兜底。"""
        cpu_max_raw = _read_file(CGROUP_V2["cpu_max"])
        cpu_stat_raw = _read_file(CGROUP_V2["cpu_stat"])
        mem_max_raw = _read_file(CGROUP_V2["mem_max"])
        mem_current_raw = _read_file(CGROUP_V2["mem_current"])
        mem_events_raw = _read_file(CGROUP_V2["mem_events"])

        quota_cores: float | None = None
        usage_usec: int | None = None
        throttled_count = 0
        throttled_seconds = 0.0
        oom_kill_count = 0
        max_events = 0
        mem_limit: int | None = None

        if cpu_max_raw is not None:
            quota_cores, _ = parse_cpu_quota(cpu_max_raw)
            stat = parse_keyed_stat(
                cpu_stat_raw, ("usage_usec", "nr_throttled", "throttled_usec")
            )
            usage_usec = stat.get("usage_usec")
            throttled_count = stat.get("nr_throttled", 0)
            throttled_seconds = round(stat.get("throttled_usec", 0) / 1_000_000, 2)
            events = parse_keyed_stat(mem_events_raw, ("oom", "oom_kill", "max"))
            oom_kill_count = events.get("oom_kill", 0)
            max_events = events.get("max", 0)
        else:
            quota = parse_int(_read_file(CGROUP_V1["quota"]))
            period = parse_int(_read_file(CGROUP_V1["period"]))
            if quota is not None and period and quota > 0:
                quota_cores = quota / period
            usage_ns = parse_int(_read_file(CGROUP_V1["usage"]))
            if usage_ns is not None:
                usage_usec = usage_ns // 1000

        limit_raw = mem_max_raw if mem_max_raw is not None else _read_file(CGROUP_V1["mem_limit"])
        mem_limit = None if is_unlimited_memory(limit_raw) else parse_int(limit_raw)

        current_raw = (
            mem_current_raw if mem_current_raw is not None else _read_file(CGROUP_V1["mem_current"])
        )
        mem_current = parse_int(current_raw)

        used_cores: float | None = None
        if usage_usec is not None and self._last_container_cpu_usec is not None:
            delta = (usage_usec - self._last_container_cpu_usec) / max(self._dt, 0.001)
            used_cores = round(max(delta, 0) / 1_000_000, 3)
        self._last_container_cpu_usec = usage_usec

        used_percent: float | None = None
        if used_cores is not None and quota_cores:
            used_percent = round(used_cores / quota_cores * 100, 1)

        mem_percent: float | None = None
        if mem_limit and mem_current is not None:
            mem_percent = round(mem_current / mem_limit * 100, 1)

        return {
            "cpu": {
                "has_limit": quota_cores is not None,
                "quota_cores": round(quota_cores, 2) if quota_cores is not None else None,
                "used_cores": used_cores,
                "used_percent": used_percent,
                "throttled_count": throttled_count,
                "throttled_seconds": throttled_seconds,
            },
            "memory": {
                "has_limit": mem_limit is not None,
                "limit": mem_limit,
                "current": mem_current or 0,
                "used_percent": mem_percent,
                "oom_kill_count": oom_kill_count,
                "max_events": max_events,
            },
        }

    def _collect_processes(self, top: int) -> list[dict[str, Any]]:
        """CPU Top10 与内存 Top10 的并集，去重后按 CPU 降序，最多 top 条。

        取并集而非单纯按 CPU 排序：高内存但低 CPU 的常驻进程不该因为
        「不烧 CPU」而永远不可见。
        """
        total_mem = psutil.virtual_memory().total or 1
        rows: list[dict[str, Any]] = []
        for pid, proc in self._procs.items():
            try:
                cpu = proc.cpu_percent(None) or 0.0
                rss = proc.memory_info().rss
                username = proc.username()
                name = proc.name() or "unknown"
                status_name = proc.status()
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
            except Exception:  # noqa: BLE001 - 进程随时可能消失，逐条降级
                continue
            rows.append(
                {
                    "pid": pid,
                    "name": name,
                    "username": (username or "").split("/")[-1] or "unknown",
                    "status": status_name,
                    "cpu_percent": round(cpu, 1),
                    "memory_rss": rss,
                    "memory_percent": round(rss / total_mem * 100, 2),
                }
            )
        by_cpu = sorted(rows, key=lambda r: float(r["cpu_percent"]), reverse=True)[:10]
        by_mem = sorted(rows, key=lambda r: int(r["memory_rss"]), reverse=True)[:10]
        merged: dict[int, dict[str, Any]] = {}
        for row in by_cpu + by_mem:
            merged.setdefault(row["pid"], row)
        return sorted(merged.values(), key=lambda r: float(r["cpu_percent"]), reverse=True)[:top]

    def _refresh_procs(self) -> None:
        """跨采样复用 Process 对象，使 cpu_percent(None) 能取到真实差值。

        psutil 每个 Process 实例独立记录上次 CPU 时间；若每次采样都新建
        实例，首次 cpu_percent 永远返回 0。故缓存 pid -> Process 映射。
        """
        keep: dict[int, psutil.Process] = {}
        for proc in psutil.process_iter():
            try:
                keep[proc.pid] = proc
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
            if len(keep) >= PROCESS_SET_LIMIT:
                break
        self._procs = keep

    # ── 对外数据 ────────────────────────────────────────────

    def payload(self, minutes: int = DEFAULT_WINDOW_MINUTES, top: int = 20) -> dict[str, Any]:
        """组装对外响应：快照 + 压力 + 进程 + 历史。"""
        window = max(1, min(minutes, HISTORY_SECONDS // 60)) * 60
        samples = list(self._history)[-window:]
        latest = self._history[-1] if self._history else None

        if latest is None:
            host = None
            container = None
            pressure = None
            processes: list[dict[str, Any]] = []
        else:
            host = latest["host"]
            container = latest["container"]
            pressure = latest["pressure"]
            processes = self._collect_processes(top)

        history: dict[str, list[float]] = {}
        for key in HISTORY_KEYS:
            values = [_flat_value(s, key) for s in samples]
            history[key] = downsample_series(values, MAX_HISTORY_POINTS)

        return {
            "host": host,
            "container": container,
            "pressure": pressure,
            "processes": processes,
            "history": history,
            "meta": {
                "in_container": _detect_container(),
                "platform": platform.system(),
                "machine": platform.machine(),
                "sample_interval_seconds": self._interval,
                "history_seconds": HISTORY_SECONDS,
            },
        }


_sampler: ResourceSampler | None = None


def get_sampler() -> ResourceSampler:
    """进程内单例。"""
    global _sampler
    if _sampler is None:
        _sampler = ResourceSampler()
    return _sampler
