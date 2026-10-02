"""存储占用分布响应模型

这些模型只描述响应结构，字段值全部来自运行时测量（目录遍历、Ollama API、
SQL / Redis 查询、statvfs），与数据库列无关，因此不设 INT4_MAX 之类的存储
上限校验（那些约束属于请求侧 schema，避免请求能通过校验却被 asyncpg 拒绝）。

边界约定：本端点只返回实时采样数据，不做任何持久化。历史只存内存不落库的
理由与 app/api/monitor.py 一致 —— 容量指标是瞬时态，落库既无审计价值，
也会与「审计日志只增不改不删」的语义混淆。
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

# 精度语义：
# - exact    字节数来自实际磁盘统计或权威接口，可直接相加
# - logical  逻辑数据量（如 pg_database_size、Redis 内存），不含 WAL/索引膨胀
#            等磁盘开销，不可与 exact 项混算精确总量
# - residual 残差值：卷级已用空间扣除已归类项，包含非工作台资源，无法进一步分解
AccuracyLevel = Literal["exact", "logical", "residual"]


class CategoryDetail(BaseModel):
    """分类明细条目（如 Ollama 单模型大小）。"""

    name: str
    bytes: int = 0


class StorageCategory(BaseModel):
    """单个存储分类。

    reachable=False 表示该分类的数据源本次不可达（服务未启动、目录不存在等），
    此时 counted 为 False，bytes 无参考意义；其余分类不受影响。
    """

    key: str
    group: str
    name: str
    bytes: int | None = None
    source: str = ""
    accuracy: AccuracyLevel = "exact"
    reachable: bool = True
    counted: bool = True
    path: str | None = None
    note: str | None = None
    anchor: str | None = None
    details: list[CategoryDetail] = []


class DiskInfo(BaseModel):
    """单个文件系统的容量信息。

    工作盘与 Docker 虚拟机卷是两个互不交叉的文件系统，不做求和、不做残差相减
    到工作盘 —— 工作盘的已用空间绝大部分属于宿主机本身而非工作台。
    """

    key: str
    name: str
    total_bytes: int = 0
    used_bytes: int = 0
    free_bytes: int = 0
    measured_via: str = ""


class StorageBreakdown(BaseModel):
    """存储占用分布快照。"""

    generated_at: str = ""
    elapsed_ms: int = 0
    categories: list[StorageCategory] = []
    measured_total_bytes: int = 0
    # logical 项（数据库逻辑量、Redis 内存）物理上已落在「其他」残差内，
    # 不再累加进 measured_total_bytes，否则重复计入；单独返回作为参考值
    logical_reference_bytes: int = 0
    disks: list[DiskInfo] = []

