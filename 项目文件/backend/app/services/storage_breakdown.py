"""存储占用分布采集

按业务分类统计存储占用：本地模型、用户数据、文件共享、备份，以及无法从
应用容器内分解的「其他」（Docker 镜像、构建缓存、容器可写层、其余数据卷）。

口径决定（2026-09-30 确认）：

- **能统计的全统计，不能统计的归「其他」并加说明**。不引入宿主机采集器、
  不挂载 Docker socket，全部在后端容器内完成。
- 每个分类绑定一个程序已知的路径或接口 —— 已知位置即能算出大小。
- 不做历史持久化：容量指标是瞬时态，落库既无审计价值，也会与「审计日志
  只增不改不删」的语义混淆（与 app/api/monitor.py 的边界约定一致）。

两个文件系统不可求和，处理方式不同：

- **工作盘**（/data/files 所在卷）：已用空间绝大部分属于宿主机本身而非工作台，
  只取其中的 files / backups 精确计入，不做残差。
- **Docker 虚拟机卷**（/ 所在卷）：Docker Desktop 为该部署专建的虚拟机，
  卷内资源基本都属工作台，故「其他」以该卷已用空间为锚做残差。

files / backups 住在工作盘，不参与 Docker 卷残差计算，两个卷互不交叉。
"""

from __future__ import annotations

import asyncio
import logging
import os
import stat
import time
from collections.abc import Awaitable
from dataclasses import dataclass
from typing import Any

import redis.asyncio as aioredis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.schemas.storage import (
    AccuracyLevel,
    CategoryDetail,
    DiskInfo,
    StorageBreakdown,
    StorageCategory,
)
from app.services import llama_cpp
from app.utils.timeutil import now_shanghai_iso

logger = logging.getLogger(__name__)

# 单个目录遍历上限。files 目录可能含数十万文件，超时后返回已遍历部分。
DIR_WALK_TIMEOUT_SECONDS = 30.0
# Docker 虚拟机卷的容器内挂载点：overlay 根文件系统
DOCKER_VM_ROOT = "/"

# 「其他」的固定说明：应用容器内确实没有数据源可读，只能给出边界与宿主机命令
OTHER_NOTE = (
    "包含 Docker 镜像、构建缓存、容器可写层、pg_data/redis_data 数据卷及同机"
    "其他 Docker 资源，无法进一步分解。构建缓存通常占其中最大份额且可回收。"
    "请在宿主机执行 docker system df 查看明细，docker builder prune 清理构建缓存。"
)


# ── 目录遍历 ────────────────────────────────────────────────


@dataclass
class _SizeAccumulator:
    """目录遍历累加器。

    用可变对象在递归间共享状态，deadline 由调用方一次性设定，
    避免每层递归重新读取时钟以外的开销。
    """

    total: int = 0
    walked: int = 0
    errors: int = 0
    complete: bool = True
    deadline: float = 0.0


def _measure_directory(path: str) -> tuple[int, bool, int]:
    """递归统计目录占用。

    返回 (bytes, complete, errors)。

    取块数而非逻辑大小：st_blocks * 512 反映真实磁盘块占用，与 du 语义一致；
    为 0 时回退 st_size（稀疏文件或不支持 blocks 的挂载）。
    符号链接一律跳过，避免环与跨挂载点重复计数。
    """
    acc = _SizeAccumulator(deadline=time.monotonic() + DIR_WALK_TIMEOUT_SECONDS)
    _walk_dir(path, acc)
    return acc.total, acc.complete, acc.errors


def _walk_dir(dir_path: str, acc: _SizeAccumulator) -> None:
    if not acc.complete:
        return
    if time.monotonic() > acc.deadline:
        acc.complete = False
        return
    try:
        with os.scandir(dir_path) as it:
            for entry in it:
                if time.monotonic() > acc.deadline:
                    acc.complete = False
                    return
                acc.walked += 1
                try:
                    st = entry.stat(follow_symlinks=False)
                except OSError:
                    acc.errors += 1
                    continue
                mode = st.st_mode
                if stat.S_ISLNK(mode):
                    continue
                if stat.S_ISDIR(mode):
                    _walk_dir(entry.path, acc)
                    continue
                if stat.S_ISREG(mode):
                    blocks = st.st_blocks * 512
                    acc.total += blocks if blocks > 0 else st.st_size
    except OSError:
        acc.errors += 1


def _disk_info(path: str, key: str, name: str) -> DiskInfo | None:
    """statvfs 取卷级容量；路径不可访问时返回 None。

    used 按 df 语义计算（total - avail），会把 root 预留块计入已用。
    """
    try:
        sv = os.statvfs(path)
    except OSError:
        logger.warning("statvfs 不可用：%s", path)
        return None
    block_size = sv.f_frsize
    total = sv.f_blocks * block_size
    free = sv.f_bavail * block_size
    return DiskInfo(
        key=key,
        name=name,
        total_bytes=total,
        used_bytes=max(0, total - free),
        free_bytes=free,
        measured_via=path,
    )


def _backups_path() -> str:
    """备份目录：与 app/services/backup.py 的 _backup_dir() 保持一致。"""
    return os.environ.get("BACKUP_DIR") or get_settings().FILE_BACKUPS_PATH


# ── 分类采集器 ───────────────────────────────────────────────


def _mark_unreachable(cat: StorageCategory, reason: str) -> StorageCategory:
    cat.reachable = False
    cat.counted = False
    cat.note = reason
    return cat


def _collect_local_ai() -> StorageCategory:
    """本地模型 · llama.cpp：直接遍历共享的 GGUF 目录。

    后端与 llama.cpp 共用同一份目录（后端挂载为 /data/gguf，llama.cpp 为 /models），
    所以字节数直接来自文件系统实测，不必再问引擎——磁盘本身就是事实来源。
    """
    cat = StorageCategory(
        key="model_local_ai",
        group="本地模型",
        name="本地 AI 模型",
        source="filesystem",
        accuracy="exact",
    )
    files = llama_cpp.local_model_files()
    if not files:
        _mark_unreachable(cat, "GGUF 目录为空或不存在，当前没有已下载的本地模型")
        return cat

    cat.path = llama_cpp.MODELS_DIR
    cat.bytes = sum(int(item["size_bytes"]) for item in files)
    cat.details = [
        CategoryDetail(name=str(item["name"]), bytes=int(item["size_bytes"]))
        for item in files
    ]
    return cat


def _measure_subdir(path: str) -> tuple[int, bool, int]:
    """统计单个子目录占用；目录不可访问时返回 0 并记一次错误。"""
    try:
        return _measure_directory(path)
    except OSError:
        return 0, True, 1


def _collect_modelscope() -> StorageCategory:
    """本地模型 · ModelScope 缓存：命名卷已挂载进后端容器，直接遍历。

    models/ 下的每个子目录对应一个模型（repo_id 中的 / 已替换为 --），
    故额外给出按模型明细，便于与「模型管理」面板对照。
    明细口径是目录完整占用，包含模型仓库自带的 example/ fig/ 官方样例数据，
    因此可能比「模型管理」面板按 snapshot 首层统计的体积偏大。
    """
    path = get_settings().MODELSCOPE_CACHE_PATH
    cat = StorageCategory(
        key="model_modelscope",
        group="本地模型",
        name="ModelScope 缓存",
        source="directory",
        accuracy="exact",
        path=path,
        note="ASR 语音识别等模型的下载缓存，位于模型下载服务使用的命名卷",
    )
    if not os.path.isdir(path):
        return _mark_unreachable(cat, f"目录不存在或不可访问，未计入：{path}")
    size, complete, errors = _measure_directory(path)
    cat.bytes = size

    # 明细：再对 models/ 下的每个模型目录单独遍历一遍。多一次遍历换来
    # 模型级可读性；总量仍以整根目录的遍历结果为准，不把明细当总量来源。
    models_dir = os.path.join(path, "models")
    if os.path.isdir(models_dir):
        try:
            entries = sorted(
                [e for e in os.scandir(models_dir)], key=lambda e: e.name
            )
        except OSError:
            entries = []
            errors += 1
        details: list[CategoryDetail] = []
        for entry in entries:
            try:
                st = entry.stat(follow_symlinks=False)
            except OSError:
                errors += 1
                continue
            if not stat.S_ISDIR(st.st_mode):
                continue
            child, c_complete, c_errors = _measure_subdir(entry.path)
            errors += c_errors
            complete = complete and c_complete
            details.append(CategoryDetail(name=entry.name, bytes=child))
        details.sort(key=lambda d: -d.bytes)
        cat.details = details

    return _apply_walk_result(cat, complete, errors)


def _collect_files() -> StorageCategory:
    """文件共享：FILE_STORAGE_PATH，工作盘上的绑定挂载。"""
    path = get_settings().FILE_STORAGE_PATH
    cat = StorageCategory(
        key="files",
        group="文件共享",
        name="共享文件",
        source="directory",
        accuracy="exact",
        path=path,
    )
    return _fill_directory(cat, path)


def _collect_backups() -> StorageCategory:
    """备份：程序已知备份位置，读得到就计入，读不到计 0 并说明原因。

    容器内无法判定绑定挂载的源路径是本地盘还是 NAS，不做主观推断；
    挂载缺失或网络盘断开时目录不可访问，自然落入 reachable=False。
    """
    path = _backups_path()
    cat = StorageCategory(
        key="backups",
        group="备份",
        name="备份文件",
        source="directory",
        accuracy="exact",
        path=path,
    )
    return _fill_directory(cat, path)


def _apply_walk_result(
    cat: StorageCategory, complete: bool, errors: int
) -> StorageCategory:
    """把遍历的完整性与错误数写进分类说明。"""
    if errors:
        cat.note = (cat.note + "；" if cat.note else "") + f"遍历时跳过 {errors} 个不可读条目"
    if not complete:
        cat.note = (
            cat.note + "；" if cat.note else ""
        ) + f"遍历超过 {DIR_WALK_TIMEOUT_SECONDS:.0f} 秒上限，结果为部分统计"
    return cat


def _fill_directory(cat: StorageCategory, path: str) -> StorageCategory:
    """把目录遍历结果填入分类；目录不存在时标记为不可达。"""
    if not os.path.isdir(path):
        return _mark_unreachable(cat, f"目录不存在或不可访问，未计入：{path}")
    size, complete, errors = _measure_directory(path)
    cat.bytes = size
    return _apply_walk_result(cat, complete, errors)


async def _collect_database(db: AsyncSession) -> StorageCategory:
    """用户数据 · 数据库：pg_database_size 给出逻辑数据量。

    非磁盘占用 —— 不含 WAL、索引膨胀与未压缩的空间，
    实际 pg_data 卷占用会明显更大，故精度标为 logical。
    """
    cat = StorageCategory(
        key="db",
        group="用户数据",
        name="数据库",
        source="sql:pg_database_size",
        accuracy="logical",
        note=(
            "逻辑数据量，仅作参考、不计入合计；不含 WAL 与索引膨胀，"
            "实际数据卷占用更大，已包含在「其他」的残差内"
        ),
    )
    result = await db.execute(text("SELECT pg_database_size(current_database())"))
    cat.bytes = int(result.scalar_one())
    return cat


async def _collect_redis() -> StorageCategory:
    """用户数据 · 缓存：Redis 内存占用。

    used_memory 是进程内存而非磁盘占用；磁盘占用取决于 AOF 配置，
    故精度标为 logical。
    """
    cat = StorageCategory(
        key="cache",
        group="用户数据",
        name="缓存 (Redis)",
        source="redis:INFO memory",
        accuracy="logical",
        note=(
            "Redis 内存占用，仅作参考、不计入合计；磁盘占用取决于 AOF 配置，"
            "已包含在「其他」的残差内"
        ),
    )
    settings = get_settings()
    # redis-py 的 from_url 无类型存根，与 app/services/model_download.py 一致
    client = aioredis.from_url(settings.REDIS_URL)  # type: ignore[no-untyped-call]
    try:
        info: dict[str, Any] = await client.info("memory")
    finally:
        await client.aclose()
    cat.bytes = int(info.get("used_memory") or 0)
    return cat


def _collect_other(disk_used_bytes: int, attributed_bytes: int) -> StorageCategory:
    """其他：Docker 虚拟机卷已用空间扣除已归类项后的残差。

    attributed_bytes 只包含确实住在该卷上的 exact 项（本地 AI 模型目录 +
    ModelScope 缓存卷）；files / backups 住在工作盘，逻辑值项物理上也落在
    该卷内，都不在这里扣除。

    残差会混入同机非工作台的 Docker 资源（其他项目的卷、残留镜像），
    无法进一步分解，故标为 residual 并在 note 中说明。
    """
    cat = StorageCategory(
        key="other",
        group="其他",
        name="应用文件与临时文件（不可分解）",
        source="residual:docker-vm",
        accuracy="residual",
        note=OTHER_NOTE,
    )
    if disk_used_bytes <= 0:
        return _mark_unreachable(cat, "无法读取 Docker 虚拟机卷容量，未计入")
    gb = 2**30
    cat.bytes = max(0, disk_used_bytes - attributed_bytes)
    cat.anchor = (
        f"Docker 虚拟机卷已用 {disk_used_bytes / gb:.1f} GB"
        f" − 已归类 {attributed_bytes / gb:.1f} GB"
    )
    return cat


# ── 容错包装与编排 ───────────────────────────────────────────


async def _safe_collect(
    key: str,
    group: str,
    name: str,
    accuracy: AccuracyLevel,
    coro: Awaitable[StorageCategory],
) -> StorageCategory:
    """单个分类采集失败只影响该分类，不影响整体返回。

    失败分类保留 key / group / accuracy，否则前端精度标签与颜色映射会失真。
    """
    try:
        return await coro
    except Exception:
        logger.warning("存储分类「%s」采集失败", name, exc_info=True)
        base = StorageCategory(key=key, group=group, name=name, accuracy=accuracy)
        return _mark_unreachable(base, "本次采集失败，请刷新重试")


async def build_storage_breakdown(db: AsyncSession) -> StorageBreakdown:
    """采集全部分类，返回存储占用分布快照。"""
    started = time.monotonic()

    # 目录遍历是阻塞 IO，必须放到线程池，否则会卡住事件循环
    results = await asyncio.gather(
        _safe_collect(
            "model_local_ai",
            "本地模型",
            "本地 AI 模型",
            "exact",
            asyncio.to_thread(_collect_local_ai),
        ),
        _safe_collect(
            "model_modelscope",
            "本地模型",
            "ModelScope 缓存",
            "exact",
            asyncio.to_thread(_collect_modelscope),
        ),
        _safe_collect(
            "files", "文件共享", "共享文件", "exact", asyncio.to_thread(_collect_files)
        ),
        _safe_collect(
            "backups", "备份", "备份文件", "exact", asyncio.to_thread(_collect_backups)
        ),
        _safe_collect("db", "用户数据", "数据库", "logical", _collect_database(db)),
        _safe_collect(
            "cache", "用户数据", "缓存 (Redis)", "logical", _collect_redis()
        ),
    )
    local_ai, modelscope, files, backups, database, cache = results

    # 工作盘容量锚点：files 所在卷。files 采集失败时回退默认路径再试一次
    disk_work_path = files.path or get_settings().FILE_STORAGE_PATH
    disks = [
        d
        for d in (
            _disk_info(disk_work_path, "work", "工作盘（文件共享/备份所在卷）"),
            _disk_info(DOCKER_VM_ROOT, "docker_vm", "Docker 虚拟机卷"),
        )
        if d is not None
    ]

    docker_disk = next((d for d in disks if d.key == "docker_vm"), None)
    attributed = 0
    if local_ai.counted and local_ai.bytes:
        attributed += local_ai.bytes
    if modelscope.counted and modelscope.bytes:
        attributed += modelscope.bytes
    other = _collect_other(
        docker_disk.used_bytes if docker_disk else 0, attributed
    )

    categories = [
        local_ai,
        modelscope,
        database,
        cache,
        files,
        backups,
        other,
    ]

    # 逻辑值项（数据库 / Redis）代表数据体积而非磁盘占用，其物理占用已经落在
    # 「其他」的残差里；若再计入合计会重复计数，故统一置 counted=False 并单独
    # 作为参考值返回。由此 counted 成为「是否计入 measured_total」的唯一判定，
    # 前端按 counted 过滤的环图与合计、占比分母天然一致。
    logical_reference = sum(
        c.bytes or 0 for c in categories if c.accuracy == "logical" and c.reachable
    )
    for cat in categories:
        if cat.accuracy == "logical":
            cat.counted = False

    measured_total = sum(c.bytes or 0 for c in categories if c.counted)

    return StorageBreakdown(
        generated_at=now_shanghai_iso(),
        elapsed_ms=int((time.monotonic() - started) * 1000),
        categories=categories,
        measured_total_bytes=measured_total,
        logical_reference_bytes=logical_reference,
        disks=disks,
    )

