"""资源监视响应模型

这些模型只描述响应结构，字段值全部来自运行时采样，与数据库列无关，
因此不设 INT4_MAX / MAX_CPU_CORES 之类的存储上限校验（那些约束属于
请求侧 schema，避免请求能通过校验却被 asyncpg 拒绝）。
"""

from __future__ import annotations

from pydantic import BaseModel


class HostCpuBreakdown(BaseModel):
    """CPU 占用类型拆分（百分比，合计约 100）。"""

    user: float = 0.0
    system: float = 0.0
    iowait: float = 0.0
    steal: float = 0.0
    idle: float = 0.0


class HostCpu(BaseModel):
    """运行环境 CPU。per_core 长度等于 cores，均为百分比。"""

    total: float = 0.0
    per_core: list[float] = []
    breakdown: HostCpuBreakdown = HostCpuBreakdown()


class HostMemory(BaseModel):
    """运行环境内存。

    used 为排除可回收缓存（buffers + cached）后的真实占用；
    available 为可被新进程使用的内存（含可回收部分），
    压力计算以 available 为准而非 free。
    """

    total: int = 0
    used: int = 0
    cached: int = 0
    buffers: int = 0
    free: int = 0
    available: int = 0
    used_percent: float = 0.0


class HostSwap(BaseModel):
    total: int = 0
    used: int = 0
    free: int = 0
    percent: float = 0.0


class HostLoad(BaseModel):
    load1: float = 0.0
    load5: float = 0.0
    load15: float = 0.0


class HostDisk(BaseModel):
    """磁盘聚合速率。

    非 root 无法读取其他进程的 /proc/<pid>/io（内核限制），
    故只提供全局聚合值，不提供进程级磁盘 IO。
    """

    read_bytes_per_sec: int = 0
    write_bytes_per_sec: int = 0
    read_count_per_sec: int = 0
    write_count_per_sec: int = 0


class HostNet(BaseModel):
    bytes_sent_per_sec: int = 0
    bytes_recv_per_sec: int = 0
    packets_sent_per_sec: int = 0
    packets_recv_per_sec: int = 0


class HostSnapshot(BaseModel):
    ts: float = 0.0
    cores: int = 1
    cpu: HostCpu = HostCpu()
    memory: HostMemory = HostMemory()
    swap: HostSwap = HostSwap()
    load: HostLoad = HostLoad()
    disk: HostDisk = HostDisk()
    net: HostNet = HostNet()


class ContainerCpu(BaseModel):
    """本容器 CPU 配额与限流。

    未配置 deploy.resources.limits 时 has_limit 为 False，
    quota_cores / used_percent 为 None，前端显示「未设配额」。
    """

    has_limit: bool = False
    quota_cores: float | None = None
    used_cores: float | None = None
    used_percent: float | None = None
    throttled_count: int = 0
    throttled_seconds: float = 0.0


class ContainerMemory(BaseModel):
    has_limit: bool = False
    limit: int | None = None
    current: int = 0
    used_percent: float | None = None
    oom_kill_count: int = 0
    max_events: int = 0


class ContainerSnapshot(BaseModel):
    cpu: ContainerCpu = ContainerCpu()
    memory: ContainerMemory = ContainerMemory()


class PressureDimension(BaseModel):
    key: str
    label: str
    value: float


class Pressure(BaseModel):
    """综合压力取各维度中最严重者。

    causes 为达到阈值（>=60）的维度标签，供前端生成成因文案。
    """

    index: float = 0.0
    level: str = "normal"
    level_label: str = "正常"
    dimensions: list[PressureDimension] = []
    causes: list[str] = []


class ProcessRow(BaseModel):
    pid: int
    name: str
    username: str
    status: str
    cpu_percent: float = 0.0
    memory_rss: int = 0
    memory_percent: float = 0.0


class HistorySeries(BaseModel):
    """并行数组，前端按索引拼接为 recharts 的 data 数组。

    超出 300 点时后端等距降采样并保留首尾两点。
    """

    ts: list[float] = []
    cpu_total: list[float] = []
    cpu_user: list[float] = []
    cpu_system: list[float] = []
    cpu_iowait: list[float] = []
    memory_used_percent: list[float] = []
    memory_cached_percent: list[float] = []
    memory_buffers_percent: list[float] = []
    memory_free_percent: list[float] = []
    load1: list[float] = []
    load5: list[float] = []
    load15: list[float] = []
    disk_read_bps: list[float] = []
    disk_write_bps: list[float] = []
    net_sent_bps: list[float] = []
    net_recv_bps: list[float] = []


class MonitorMeta(BaseModel):
    """运行环境元信息，用于前端如实标注观测口径。"""

    in_container: bool = False
    platform: str = ""
    machine: str = ""
    sample_interval_seconds: float = 1.0
    history_seconds: int = 600


class MonitorData(BaseModel):
    host: HostSnapshot | None = None
    container: ContainerSnapshot | None = None
    pressure: Pressure | None = None
    processes: list[ProcessRow] = []
    history: HistorySeries = HistorySeries()
    meta: MonitorMeta = MonitorMeta()
