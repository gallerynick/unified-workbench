"""模型下载管理服务 - 进度跟踪、暂停/恢复/取消、卡死回收

本模块历史上出现「进度条 / 速度 / 已下载量永久卡在 96%」的缺陷，根因有四：

1. **进度样本被静默丢弃**：Ollama `/api/pull` 返回 NDJSON（每行一个 JSON 对象），
   而 `response.aiter_bytes()` 给出的字节块与 JSON 行并不对齐。旧实现直接对整个块
   `json.loads`，一个块里含多行时整体抛错并被 `except: pass` 吞掉，整批进度样本
   丢失，进度看起来像冻结。现在做行缓冲后再解析。
2. **速度计算窗口错位**：旧实现用「距上次写入 Redis 的间隔」当分母，节流一旦跳过写入
   就会把长时间窗口的增量除进去，速度被严重低估（0.09 MB/s 即由此而来）。
   现在按最近 N 秒的采样点滑动窗口计算。
3. **僵尸任务**：下载由 `asyncio.create_task` 驱动，进程重启后协程消失但 Redis 状态
   仍是 `downloading`，前端会永久轮询一个不存在的任务。现在：下载协程持续写心跳
   `updated_at`，读侧按心跳判定存活并回收为 error，启动时统一清理孤儿任务。
4. **无单飞保护**：多次点击会并发多个 pull，既互相竞争也留下多份孤儿键。
   现在同用户同模型只保留一个活跃任务。
"""

from __future__ import annotations

import asyncio
import json
import time
from collections import deque
from typing import Any

import httpx
import redis.asyncio as aioredis

from app.core.config import get_settings

settings = get_settings()

OLLAMA_BASE_URL = "http://ollama:11434"

# Redis key 前缀与 TTL
DOWNLOAD_KEY_PREFIX = "model_download:"
KEY_TTL = 7200  # 2 小时过期


class DownloadStatus:
    """下载状态"""

    PENDING = "pending"
    DOWNLOADING = "downloading"
    PAUSED = "paused"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    ERROR = "error"


# 活跃状态：受存活判定约束（终态不在其中）
ACTIVE_STATUSES = (DownloadStatus.PENDING, DownloadStatus.DOWNLOADING)

MAX_RETRIES = 3                        # 整条 pull 流异常后的最大重试次数
RETRY_DELAY = 5                        # 重试间隔（秒）
HEARTBEAT_INTERVAL = 5.0               # 心跳间隔：无新数据也刷新 updated_at，证明协程存活
PROGRESS_WRITE_INTERVAL = 0.5          # 进度写 Redis 的最小间隔（节流）
SPEED_WINDOW = 15.0                    # 速度计算滑动窗口（秒）
MIN_SPEED_WINDOW = 2.0                 # 速度计算的最小窗口跨度（秒），跨度不足时不报速度
MAX_PLAUSIBLE_SPEED = 250 * 1024 * 1024  # 单段隐含速率上限（字节/秒），剔除缓存复用跳变
STALE_AFTER_SECONDS = 120.0            # 心跳缺失超过该秒数 → 任务已丢失
PROGRESS_STALL_AFTER_SECONDS = 600.0   # 零字节增长超过该秒数 → 上游网络卡死
MAX_DURATION_SECONDS = 6 * 3600        # 单个下载任务最长存活时间

# 后台下载协程引用保活：asyncio 对 Task 只持弱引用，不保存引用可能被 GC
_DOWNLOAD_TASKS: set[asyncio.Task[None]] = set()

# 心跳 Lua：只原子地刷新 updated_at，避免与进度写入互相覆盖
_HEARTBEAT_LUA = """
local v = redis.call('GET', KEYS[1])
if not v then return 0 end
local o = cjson.decode(v)
o.updated_at = tonumber(ARGV[1])
redis.call('SET', KEYS[1], cjson.encode(o), 'EX', tonumber(ARGV[2]))
return 1
"""


def _map_phase(status_text: str) -> str:
    """把 Ollama 的 status 文本映射成简短中文阶段，供前端展示"""
    s = (status_text or "").lower()
    if "success" in s:
        return "完成"
    if "verifying" in s:
        return "校验中"
    if "writing" in s:
        return "写入中"
    if "metadata" in s or "reading" in s:
        return "读取元数据"
    if "build" in s or "executing" in s:
        return "构建中"
    if "manifest" in s:
        return "拉取清单"
    if "pulling" in s:
        return "下载中"
    return status_text or "下载中"


def _feed_ndjson(buf: bytearray, chunk: bytes) -> list[dict[str, Any]]:
    """把新到达的字节并入缓冲区，切出所有完整行并解析。

    不完整的行留在 `buf` 中等待后续字节；流结束时调用方补一个换行即可解析残余行。
    解析失败（非法 JSON）的行直接跳过，不影响同块内的其他行。
    """
    buf.extend(chunk)
    items: list[dict[str, Any]] = []
    while True:
        nl = buf.find(b"\n")
        if nl < 0:
            break
        line = bytes(buf[:nl]).strip()
        del buf[: nl + 1]
        if not line:
            continue
        try:
            obj = json.loads(line.decode("utf-8", "ignore"))
        except ValueError:
            continue
        if isinstance(obj, dict):
            items.append(obj)
    return items


def _is_orphan(info: dict[str, Any], now: float) -> tuple[bool, str]:
    """判断一个活跃任务是否已失去写者，返回 (是否死掉, 原因)。

    判据分三层，从快到慢：
    - 心跳缺失 → 下载协程已不存在（进程重启 / 异常逃逸），是最常见的卡死来源；
    - 零字节增长超时 → 连接还活着但上游一直不出数据；
    - 总时长超限 → 兜底。
    """
    if info.get("status") not in ACTIVE_STATUSES:
        return False, ""

    updated_at = float(info.get("updated_at") or 0)
    if not updated_at:
        return False, ""

    if now - updated_at > STALE_AFTER_SECONDS:
        return True, "下载连接已中断（后端任务已丢失），请重新下载"

    if info.get("status") == DownloadStatus.DOWNLOADING:
        progress_at = float(info.get("progress_updated_at") or updated_at)
        if progress_at and now - progress_at > PROGRESS_STALL_AFTER_SECONDS:
            return True, "下载长时间无进度（上游网络异常），请检查网络后重试"

    started_at = float(info.get("started_at") or 0)
    if started_at and now - started_at > MAX_DURATION_SECONDS:
        max_hours = int(MAX_DURATION_SECONDS // 3600)
        return True, f"下载超时（已超过 {max_hours} 小时），请检查网络后重试"

    return False, ""


async def _get_redis() -> aioredis.Redis:
    return aioredis.from_url(settings.REDIS_URL)


async def _get_status(redis: aioredis.Redis, task_key: str) -> dict | None:
    """读取任务状态，不存在返回 None"""
    data = await redis.get(task_key)
    if data:
        return json.loads(data)
    return None


def _with_elapsed(info: dict) -> dict:
    """补上实时耗时（秒）。由服务端 started_at 推导，避免客户端与服务端时钟偏差。"""
    started = float(info.get("started_at") or 0)
    info["elapsed_seconds"] = max(0.0, time.time() - started) if started > 0 else 0.0
    return info


async def _update_status(redis: aioredis.Redis, task_key: str, updates: dict) -> None:
    """把 updates 合并进任务状态并写回 Redis"""
    current = await _get_status(redis, task_key)
    if current:
        current.update(updates)
        await redis.set(task_key, json.dumps(current), ex=KEY_TTL)


async def _heartbeat(redis: aioredis.Redis, task_key: str) -> None:
    """刷新心跳时间戳。失败不影响下载主流程。"""
    try:
        await redis.eval(_HEARTBEAT_LUA, 1, task_key, str(time.time()), str(KEY_TTL))
    except Exception:
        pass


async def _maybe_reap(redis: aioredis.Redis, task_key: str, info: dict) -> dict:
    """读侧兜底：把已失去写者的活跃任务回收成 error，返回最新状态"""
    stale, reason = _is_orphan(info, time.time())
    if not stale:
        return info
    await _update_status(redis, task_key, {
        "status": DownloadStatus.ERROR,
        "error": reason,
        "phase": "已中断",
        "updated_at": time.time(),
    })
    refreshed = await _get_status(redis, task_key)
    return refreshed or info


async def _find_active_task(
    redis: aioredis.Redis, user_id: str, model_name: str
) -> dict | None:
    """查找同用户同模型的活跃任务（用于单飞复用），顺带回收僵尸任务"""
    keys = await redis.keys(f"{DOWNLOAD_KEY_PREFIX}*")
    candidates: list[tuple[float, dict]] = []
    for key in keys:
        key_str = key.decode() if isinstance(key, bytes) else key
        info = await _get_status(redis, key_str)
        if not info or info.get("user_id") != user_id or info.get("model_name") != model_name:
            continue
        info = await _maybe_reap(redis, key_str, info)
        if info.get("status") in ACTIVE_STATUSES:
            candidates.append((float(info.get("started_at") or 0), info))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


async def _last_incomplete_started_at(
    redis: aioredis.Redis, user_id: str, model_name: str
) -> float:
    """同用户同模型最近一次未完成任务（取消 / 出错）的 started_at。

    取消或中断后重新下载时，Ollama 会复用本地已缓存的分片，
    「已下载」并非全部由本次任务产生，若不沿用上一次任务的起始时间，
    会出现「用时 34 秒、已下载 3 GB」这类互相矛盾的数字。
    返回 0.0 表示没有可继承的历史。
    """
    best = 0.0
    keys = await redis.keys(f"{DOWNLOAD_KEY_PREFIX}*")
    for key in keys:
        info = await _get_status(redis, key.decode() if isinstance(key, bytes) else key)
        if not info or info.get("user_id") != user_id or info.get("model_name") != model_name:
            continue
        if info.get("status") not in (DownloadStatus.CANCELLED, DownloadStatus.ERROR):
            continue
        started = float(info.get("started_at") or 0)
        if started > best:
            best = started
    return best


def _blob_id_from_status(status: str) -> str:
    """从 Ollama 的 status 文本中提取 blob 标识，用于按 blob 聚合进度。

    Ollama 的 `total` / `completed` 是针对**单个 blob** 上报的，不是整个模型：
    一个模型由 manifest、system、template、license 等多个 blob 组成，逐个下载，
    每个 blob 有自己的 total，且 completed 从 0 重新开始。若按「最后一条覆盖」，
    进度会退化成最后一个 blob 的进度，导致百分比爆炸或停滞。

    形如 ``downloading 58d1e17ffe51 3.2%`` → ``58d1e17ffe51``；
    无 blob 标识的行（``pulling manifest``、``verifying sha256 digest``、``success``）
    不携带 total / completed，用什么键都不影响聚合结果。
    """
    parts = status.split()
    return parts[1] if len(parts) >= 2 else status


class _ProgressState:
    """一次 pull 流内的进度聚合状态"""

    __slots__ = (
        "blobs",
        "total",
        "downloaded",
        "phase",
        "error",
        "samples",
        "last_write",
        "last_recorded",
    )

    def __init__(self) -> None:
        self.blobs: dict[str, dict[str, int]] = {}
        self.total = 0
        self.downloaded = 0
        self.phase = "连接中"
        self.error = ""
        self.samples: deque[tuple[float, int]] = deque()
        self.last_write = 0.0
        self.last_recorded = -1


async def _apply_lines(
    redis: aioredis.Redis, task_key: str, p: _ProgressState, objs: list[dict[str, Any]]
) -> None:
    """把一批 Ollama 进度行应用到状态，并按节流写回 Redis"""
    for obj in objs:
        if "status" in obj:
            p.phase = _map_phase(str(obj["status"]))
        # Ollama 失败时以 HTTP 200 + {"error": ...} 正常结束流，必须捕获，否则会误判为下载完成
        if "error" in obj:
            p.error = str(obj["error"])
        blob = p.blobs.setdefault(_blob_id_from_status(str(obj.get("status") or "")), {
            "total": 0,
            "completed": 0,
        })
        if "total" in obj:
            blob["total"] = max(blob["total"], int(obj["total"]))
        if "completed" in obj:
            blob["completed"] = max(blob["completed"], int(obj["completed"]))
        # 只报了 total 没报 completed 的分片视为已就位（本地缓存命中），
        # 否则已缓存模型的进度会一直停在 0%
        if "completed" not in obj and blob["completed"] == 0:
            blob["completed"] = blob["total"]

    p.total = sum(v["total"] for v in p.blobs.values())
    p.downloaded = sum(v["completed"] for v in p.blobs.values())

    now = time.time()

    # completed 未变化时不重复入样，避免空样本把窗口无谓拉长
    if not (p.samples and p.samples[-1][1] == p.downloaded):
        p.samples.append((now, p.downloaded))

    while p.samples and now - p.samples[0][0] > SPEED_WINDOW:
        p.samples.popleft()

    # 剔除窗口首段的「缓存复用跳变」：Ollama 复用本地已缓存分片时，completed 会在毫秒级
    # 从 0 跳到接近 total，该跳变不属本窗口内的真实下载，需逐段前移锚点直到速率回落
    while len(p.samples) >= 2:
        dt_head = p.samples[1][0] - p.samples[0][0]
        dd_head = p.samples[1][1] - p.samples[0][1]
        head_rate = (dd_head / dt_head) if dt_head > 0 else float("inf")
        if head_rate > MAX_PLAUSIBLE_SPEED:
            p.samples.popleft()
        else:
            break

    if len(p.samples) >= 2 and p.samples[-1][0] - p.samples[0][0] >= MIN_SPEED_WINDOW:
        dt = p.samples[-1][0] - p.samples[0][0]
        dd = p.samples[-1][1] - p.samples[0][1]
        speed = max(0.0, dd / dt)
    else:
        speed = 0.0

    if now - p.last_write < PROGRESS_WRITE_INTERVAL:
        return

    p.last_write = now
    progress = min(100.0, p.downloaded / p.total * 100) if p.total > 0 else 0.0
    updates: dict[str, Any] = {
        "progress": progress,
        "total": p.total,
        "downloaded": p.downloaded,
        "speed": speed,
        "phase": p.phase,
        "updated_at": now,
    }
    if p.downloaded != p.last_recorded:
        updates["progress_updated_at"] = now
        p.last_recorded = p.downloaded
    await _update_status(redis, task_key, updates)


class _ControlFlag:
    """watchdog 与 reader 之间的控制信号"""

    __slots__ = ("value",)

    def __init__(self) -> None:
        self.value: str | None = None

    def set(self, value: str) -> None:
        self.value = value

    def get(self) -> str | None:
        return self.value


async def _run_pull(redis: aioredis.Redis, task_key: str, model_name: str) -> str:
    """执行一次 pull 流并跟踪进度。

    返回结果：completed / http_error / pull_error / cancelled / paused / timeout。
    连接级异常（EOF、断连等）向外抛出，由上层决定重试。
    """
    started_at = time.time()
    control = _ControlFlag()
    reader_task: asyncio.Task[None] | None = None
    watchdog_task: asyncio.Task[None] | None = None

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "POST",
            f"{OLLAMA_BASE_URL}/api/pull",
            json={"name": model_name},
        ) as response:
            if response.status_code != 200:
                await _update_status(redis, task_key, {
                    "status": DownloadStatus.ERROR,
                    "error": f"HTTP {response.status_code}",
                    "updated_at": time.time(),
                })
                return "http_error"

            p = _ProgressState()

            async def reader() -> None:
                buf = bytearray()
                async for chunk in response.aiter_bytes():
                    objs = _feed_ndjson(buf, chunk)
                    if objs:
                        await _apply_lines(redis, task_key, p, objs)
                # 流结束：最后一行可能没有换行符，补一个触发解析
                if buf:
                    objs = _feed_ndjson(buf, b"\n")
                    if objs:
                        await _apply_lines(redis, task_key, p, objs)

            async def watchdog() -> None:
                while True:
                    await asyncio.sleep(HEARTBEAT_INTERVAL)
                    await _heartbeat(redis, task_key)
                    info = await _get_status(redis, task_key)
                    if not info:
                        return
                    status = info.get("status")
                    if status == DownloadStatus.CANCELLED:
                        control.set("cancelled")
                    elif status == DownloadStatus.PAUSED:
                        control.set("paused")
                    elif (
                        time.time()
                        - float(info.get("started_at") or started_at)
                        > MAX_DURATION_SECONDS
                    ):
                        control.set("timeout")
                    else:
                        continue
                    if reader_task is not None:
                        reader_task.cancel()
                    return

            reader_task = asyncio.create_task(reader())
            watchdog_task = asyncio.create_task(watchdog())
            try:
                await reader_task
            except asyncio.CancelledError:
                return control.get() or "cancelled"
            finally:
                if watchdog_task is not None:
                    watchdog_task.cancel()
                    try:
                        await watchdog_task
                    except BaseException:
                        pass

    # 流正常结束：若流内带 error 字段则是拉取失败（如模型名无效 / 清单不存在），不能当成成功
    if p.error:
        await _update_status(redis, task_key, {
            "status": DownloadStatus.ERROR,
            "error": f"Ollama 拉取失败: {p.error}",
            "phase": "失败",
            "updated_at": time.time(),
        })
        return "pull_error"

    await _update_status(redis, task_key, {
        "status": DownloadStatus.COMPLETED,
        "progress": 100.0,
        "phase": "完成",
        "speed": 0,
        "updated_at": time.time(),
    })
    return "completed"


async def _wait_for_resume(redis: aioredis.Redis, task_key: str) -> str:
    """阻塞直到任务被恢复或取消，返回 resumed / cancelled / gone"""
    while True:
        await asyncio.sleep(1)
        info = await _get_status(redis, task_key)
        if not info:
            return "gone"
        status = info.get("status")
        if status == DownloadStatus.DOWNLOADING:
            return "resumed"
        if status == DownloadStatus.CANCELLED:
            return "cancelled"


async def _do_download(task_id: str, model_name: str) -> None:
    """下载主流程：连接、重试、暂停恢复、超时与取消处理"""
    redis = await _get_redis()
    task_key = f"{DOWNLOAD_KEY_PREFIX}{task_id}"
    retry_count = 0
    last_error = ""

    try:
        while True:
            await _update_status(redis, task_key, {
                "status": DownloadStatus.DOWNLOADING,
                "phase": "连接 Ollama",
                "retry_count": retry_count,
                "updated_at": time.time(),
            })

            try:
                outcome = await _run_pull(redis, task_key, model_name)
            except Exception as exc:
                last_error = str(exc) or exc.__class__.__name__
                retry_count += 1
                if retry_count >= MAX_RETRIES:
                    await _update_status(redis, task_key, {
                        "status": DownloadStatus.ERROR,
                        "error": f"下载失败（已重试 {MAX_RETRIES} 次）: {last_error}",
                        "updated_at": time.time(),
                    })
                    return
                await _update_status(redis, task_key, {
                    "status": DownloadStatus.DOWNLOADING,
                    "phase": f"重试中（第 {retry_count}/{MAX_RETRIES} 次）",
                    "error": f"连接中断，{RETRY_DELAY} 秒后自动重试: {last_error}",
                    "retry_count": retry_count,
                    "updated_at": time.time(),
                })
                await asyncio.sleep(RETRY_DELAY)
                continue

            if outcome == "completed":
                return
            if outcome in ("http_error", "pull_error", "cancelled", "gone"):
                return
            if outcome == "timeout":
                await _update_status(redis, task_key, {
                    "status": DownloadStatus.ERROR,
                    "error": (
                        f"下载超时（超过 {int(MAX_DURATION_SECONDS // 3600)} 小时），"
                        "请检查网络后重试"
                    ),
                    "updated_at": time.time(),
                })
                return
            if outcome == "paused":
                await _update_status(redis, task_key, {
                    "phase": "已暂停，等待恢复",
                    "updated_at": time.time(),
                })
                wait_result = await _wait_for_resume(redis, task_key)
                if wait_result == "resumed":
                    # 重新发起 pull；Ollama 会从已缓存的分片续传，无需从零开始
                    continue
            return
    finally:
        await redis.close()


def _spawn(task: asyncio.Task[None]) -> None:
    """保存后台任务引用，防止被垃圾回收"""
    _DOWNLOAD_TASKS.add(task)
    task.add_done_callback(_DOWNLOAD_TASKS.discard)


async def start_model_download(model_name: str, user_id: str) -> str:
    """启动模型下载，返回任务 ID。同用户同模型已有活跃任务时直接复用（单飞）。"""
    redis = await _get_redis()
    try:
        existing = await _find_active_task(redis, user_id, model_name)
        if existing:
            return existing["task_id"]

        task_id = f"{model_name}_{int(time.time())}"
        now = time.time()
        download_info = {
            "task_id": task_id,
            "model_name": model_name,
            "user_id": user_id,
            "status": DownloadStatus.PENDING,
            "progress": 0.0,
            "total": 0,
            "downloaded": 0,
            "speed": 0,
            "phase": "排队中",
            "started_at": now,
            "elapsed_seconds": 0.0,
            "updated_at": now,
            "progress_updated_at": now,
            "retry_count": 0,
        }
        # 沿用上一次未完成任务的起始时间：已下载量含上一次留下的缓存分片，
        # 重新计时会让「用时」与「已下载」互相矛盾
        inherited = await _last_incomplete_started_at(redis, user_id, model_name)
        if inherited and inherited < now:
            download_info["started_at"] = inherited
            download_info["elapsed_seconds"] = now - inherited
            download_info["phase"] = "续传中"
        await redis.set(
            f"{DOWNLOAD_KEY_PREFIX}{task_id}",
            json.dumps(download_info),
            ex=KEY_TTL,
        )
        _spawn(asyncio.create_task(_do_download(task_id, model_name)))
        return task_id
    finally:
        await redis.close()


async def reap_orphaned_downloads() -> int:
    """进程启动时清理孤儿下载任务，返回回收数量。

    下载由 asyncio.create_task 驱动，进程重启后协程必然已消失，
    但 Redis 里仍标记为 pending / downloading，会变成永久卡住的僵尸任务。
    """
    redis = await _get_redis()
    reaped = 0
    try:
        keys = await redis.keys(f"{DOWNLOAD_KEY_PREFIX}*")
        for key in keys:
            key_str = key.decode() if isinstance(key, bytes) else key
            info = await _get_status(redis, key_str)
            if not info or info.get("status") not in ACTIVE_STATUSES:
                continue
            await _update_status(redis, key_str, {
                "status": DownloadStatus.ERROR,
                "error": "下载任务已丢失（服务重启），请重新下载",
                "phase": "已中断",
                "updated_at": time.time(),
            })
            reaped += 1
        return reaped
    finally:
        await redis.close()


def _is_owner(info: dict | None, user_id: str) -> bool:
    """判断任务归属。user_id 为空时不做校验（仅供内部调用）。"""
    if not user_id:
        return True
    if not info:
        return False
    return str(info.get("user_id") or "") == str(user_id)


async def get_download_status(task_id: str, user_id: str = "") -> dict | None:
    """获取下载进度（读侧按心跳回收僵尸任务）。

    非本人任务一律返回 None，对外表现为「任务不存在」，不泄露任务是否存在。
    """
    redis = await _get_redis()
    task_key = f"{DOWNLOAD_KEY_PREFIX}{task_id}"
    try:
        info = await _get_status(redis, task_key)
        if not info or not _is_owner(info, user_id):
            return None
        return _with_elapsed(await _maybe_reap(redis, task_key, info))
    finally:
        await redis.close()


async def get_user_current_download(user_id: str) -> dict | None:
    """获取当前用户最近一个活跃的下载任务（读侧按心跳回收僵尸任务）"""
    redis = await _get_redis()
    try:
        keys = await redis.keys(f"{DOWNLOAD_KEY_PREFIX}*")
        candidates: list[tuple[float, dict]] = []
        for key in keys:
            key_str = key.decode() if isinstance(key, bytes) else key
            info = await _get_status(redis, key_str)
            if not info or info.get("user_id") != user_id:
                continue
            info = await _maybe_reap(redis, key_str, info)
            if info.get("status") in ACTIVE_STATUSES:
                candidates.append((float(info.get("started_at") or 0), info))
        if not candidates:
            return None
        candidates.sort(key=lambda item: item[0], reverse=True)
        return _with_elapsed(candidates[0][1])
    finally:
        await redis.close()


async def pause_download(task_id: str, user_id: str = "") -> bool:
    """暂停下载（仅任务所有者）"""
    redis = await _get_redis()
    try:
        task_key = f"{DOWNLOAD_KEY_PREFIX}{task_id}"
        info = await _get_status(redis, task_key)
        if not info or not _is_owner(info, user_id):
            return False
        info = await _maybe_reap(redis, task_key, info)
        if info.get("status") in (DownloadStatus.PENDING, DownloadStatus.DOWNLOADING):
            await _update_status(redis, task_key, {
                "status": DownloadStatus.PAUSED,
                "phase": "已暂停",
                "updated_at": time.time(),
            })
            return True
        return False
    finally:
        await redis.close()


async def resume_download(task_id: str, user_id: str = "") -> bool:
    """恢复下载（仅任务所有者）"""
    redis = await _get_redis()
    try:
        task_key = f"{DOWNLOAD_KEY_PREFIX}{task_id}"
        info = await _get_status(redis, task_key)
        if info and _is_owner(info, user_id) and info.get("status") == DownloadStatus.PAUSED:
            await _update_status(redis, task_key, {
                "status": DownloadStatus.DOWNLOADING,
                "phase": "连接 Ollama",
                "updated_at": time.time(),
            })
            return True
        return False
    finally:
        await redis.close()


async def cancel_download(task_id: str, user_id: str = "") -> bool:
    """取消下载（仅任务所有者）"""
    redis = await _get_redis()
    try:
        task_key = f"{DOWNLOAD_KEY_PREFIX}{task_id}"
        info = await _get_status(redis, task_key)
        if (
            not info
            or not _is_owner(info, user_id)
            or info.get("status") == DownloadStatus.COMPLETED
        ):
            return False
        await _update_status(redis, task_key, {
            "status": DownloadStatus.CANCELLED,
            "phase": "已取消",
            "updated_at": time.time(),
        })

        # 删除已下载的模型（如果存在）
        model_name = info.get("model_name")
        if model_name:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    await client.delete(
                        f"{OLLAMA_BASE_URL}/api/delete",
                        json={"name": model_name},
                    )
            except Exception:
                pass  # 忽略删除失败

        return True
    finally:
        await redis.close()
