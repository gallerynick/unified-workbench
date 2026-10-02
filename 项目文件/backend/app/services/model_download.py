"""模型下载管理服务 - 进度跟踪、暂停/恢复/取消、卡死回收

从 HuggingFace 流式拉取 GGUF 到本地模型目录（后端 /data/gguf，与 llama-cpp 的
/models 是同一份宿主目录），下载完成后通知 llama.cpp 重新扫描，无需重启容器。

本模块曾长期只服务 Ollama 的 `/api/pull`，那套实现有四个历史缺陷：

1. **进度样本被静默丢弃**：Ollama 返回 NDJSON，字节块与 JSON 行并不对齐，
   整块 `json.loads` 会在多行时抛错并被吞掉，进度看起来像冻结。
2. **速度计算窗口错位**：分母取「距上次写 Redis 的间隔」，节流跳过写入就把
   长时间增量除进短分母，速度被严重低估。
3. **僵尸任务**：协程随进程消失而 Redis 状态仍是 `downloading`，
   前端永久轮询一个不存在的任务。
4. **无单飞保护**：多次点击并发多个下载，互相竞争并留下孤儿键。

改直连 GGUF 之后，**第 1 条从根上消失**（不再解析任何流式 JSON，进度就是
「已写入字节数」）。第 2、3、4 条的防护是任务层的职责，与本模块的下载实现无关，
因此原样保留。
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from collections import deque
from typing import Any

import httpx
import redis.asyncio as aioredis

from app.core.config import get_settings
from app.services import llama_cpp

logger = logging.getLogger(__name__)

settings = get_settings()

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

    断点续传下，重试会带着上一次留下的 .part 继续拉，
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


class _ProgressState:
    """一次下载内的进度聚合状态"""

    __slots__ = ("total", "downloaded", "samples", "last_write", "last_recorded")

    def __init__(self) -> None:
        self.total = 0
        self.downloaded = 0
        self.samples: deque[tuple[float, int]] = deque()
        self.last_write = 0.0
        self.last_recorded = -1


async def _publish_progress(
    redis: aioredis.Redis, task_key: str, p: _ProgressState
) -> None:
    """按节流把当前进度写回 Redis。

    速度按最近 SPEED_WINDOW 秒的采样点滑动窗口计算。旧实现把窗口起点锚在
    「上次写 Redis」，节流一旦跳过写入，就会把一段长时间跨度的增量除进短分母，
    速度被严重低估。这里速度与写库节流解耦。
    """
    now = time.time()

    if not (p.samples and p.samples[-1][1] == p.downloaded):
        p.samples.append((now, p.downloaded))
    while p.samples and now - p.samples[0][0] > SPEED_WINDOW:
        p.samples.popleft()

    if len(p.samples) >= 2 and p.samples[-1][0] - p.samples[0][0] >= MIN_SPEED_WINDOW:
        span = p.samples[-1][0] - p.samples[0][0]
        speed = max(0.0, (p.samples[-1][1] - p.samples[0][1]) / span)
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
        "phase": "下载中",
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


async def _run_download(redis: aioredis.Redis, task_key: str, model_name: str) -> str:
    """从 HuggingFace 拉取模型 GGUF 并跟踪进度。

    返回：completed / interrupted / http_error / download_error /
    cancelled / paused / timeout。连接级异常向外抛出，由上层重试。
    """
    target = llama_cpp.resolve_download_target(model_name)
    if target is None:
        await _update_status(redis, task_key, {
            "status": DownloadStatus.ERROR,
            "error": f"模型 {model_name} 不在可下载目录中",
            "phase": "失败",
            "updated_at": time.time(),
        })
        return "download_error"

    destination = llama_cpp.model_file_path(model_name)
    destination.parent.mkdir(parents=True, exist_ok=True)
    # 先写 .part 再原子改名：中途失败不会留下一个「看起来完整」的坏文件
    partial = destination.with_name(destination.name + ".part")

    # 断点续传：已有半成品就带 Range 续拉。大文件弱网重来代价很高，
    # 且 _do_download 重试时并不删 .part，因此这里能真正接着上次的进度。
    resume_from = partial.stat().st_size if partial.exists() else 0

    started_at = time.time()
    control = _ControlFlag()
    writer_task: asyncio.Task[None] | None = None
    watchdog_task: asyncio.Task[None] | None = None
    state = _ProgressState()

    async with httpx.AsyncClient(timeout=None, follow_redirects=True) as client:
        response = None
        last_error: Exception | None = None
        for url in target["urls"]:
            try:
                request = client.build_request("GET", url)
                if resume_from > 0:
                    request.headers["Range"] = f"bytes={resume_from}-"
                candidate = await client.send(request, stream=True)
                if candidate.status_code in (200, 206):
                    response = candidate
                    break
                await candidate.aclose()
                last_error = RuntimeError(f"HTTP {candidate.status_code}")
            except Exception as exc:
                # 换下一个源继续试；全部失败才报错
                last_error = exc

        if response is None:
            await _update_status(redis, task_key, {
                "status": DownloadStatus.ERROR,
                "error": f"所有下载源均不可用：{last_error}",
                "phase": "失败",
                "updated_at": time.time(),
            })
            return "http_error"

        content_length = int(response.headers.get("content-length") or 0)
        if response.status_code == 206 and resume_from > 0:
            # 206 的 content-length 只覆盖剩余部分，总量要把已下载的加回去
            state.total = resume_from + content_length
        else:
            # 服务端不支持 Range（返回 200）时必须从头写，否则文件会错位
            state.total = content_length
            resume_from = 0

        await _update_status(redis, task_key, {"total": state.total, "phase": "下载中"})

        # 边下边算 sha256，下载完成后与目录里的官方哈希比对，
        # 防止 CDN 出错或源被篡改后留下「字节数对得上但内容是坏的」文件。
        digest = hashlib.sha256()
        if resume_from > 0:
            # 断点续传：先把已有半成品的字节补算进哈希，
            # 这样最后比对的是「旧 + 新」的完整文件哈希，而不是跳过校验。
            with open(partial, "rb") as fp:
                for block in iter(lambda: fp.read(1 << 20), b""):
                    digest.update(block)

        async def writer() -> None:
            mode = "ab" if resume_from > 0 else "wb"
            state.downloaded = resume_from
            with open(partial, mode) as fp:
                async for chunk in response.aiter_bytes():
                    fp.write(chunk)
                    digest.update(chunk)
                    state.downloaded += len(chunk)
                    await _publish_progress(redis, task_key, state)

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
                    time.time() - float(info.get("started_at") or started_at)
                    > MAX_DURATION_SECONDS
                ):
                    control.set("timeout")
                else:
                    continue
                if writer_task is not None:
                    writer_task.cancel()
                return

        writer_task = asyncio.create_task(writer())
        watchdog_task = asyncio.create_task(watchdog())
        try:
            await writer_task
        except asyncio.CancelledError:
            partial.unlink(missing_ok=True)
            return control.get() or "cancelled"
        except Exception as exc:
            partial.unlink(missing_ok=True)
            await _update_status(redis, task_key, {
                "status": DownloadStatus.ERROR,
                "error": f"下载中断：{exc}",
                "phase": "失败",
                "updated_at": time.time(),
            })
            return "interrupted"
        finally:
            if watchdog_task is not None:
                watchdog_task.cancel()
                try:
                    await watchdog_task
                except BaseException:
                    pass
            try:
                await response.aclose()
            except Exception:
                pass

    # 字节数校验：声明长度与实际写入不符说明流被截断，
    # 此时文件不可用，必须判失败，不能当成「下载完成」。
    if state.total > 0 and state.downloaded != state.total:
        partial.unlink(missing_ok=True)
        logger.warning(
            "下载字节数不符：期望 %s，实得 %s", state.total, state.downloaded
        )
        return "interrupted"

    # sha256 校验：目录里登记了官方哈希的模型必须逐字节对上。
    # 覆盖两种情况——全新下载（哈希含全部字节）与断点续传
    # （启动时先补算了 .part 已有字节，哈希同样覆盖完整文件）。
    expected_sha = target.get("sha256")
    if expected_sha and digest.hexdigest() != expected_sha:
        partial.unlink(missing_ok=True)
        logger.error(
            "sha256 校验失败：期望 %s，实得 %s",
            expected_sha,
            digest.hexdigest(),
        )
        await _update_status(redis, task_key, {
            "status": DownloadStatus.ERROR,
            "error": "sha256 校验失败，文件可能损坏或源被篡改",
            "phase": "失败",
            "updated_at": time.time(),
        })
        return "integrity_error"

    partial.replace(destination)

    # 让 llama.cpp 重新扫描目录，新模型立刻可用，不必重启容器
    try:
        await llama_cpp.reload_models()
    except Exception:
        logger.warning("llama.cpp 模型列表刷新失败，新模型需手动 reload", exc_info=True)

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
                "phase": "连接下载源",
                "retry_count": retry_count,
                "updated_at": time.time(),
            })

            try:
                outcome = await _run_download(redis, task_key, model_name)
                if outcome == "interrupted":
                    # 走连接级重试：.part 保留着，下一次会自动带 Range 续传
                    raise RuntimeError("下载流提前结束，未收到完成信号")
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
            if outcome in ("http_error", "pull_error", "integrity_error", "cancelled", "gone"):
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
                    # 重新发起下载；.part 里的字节保留着，会自动带 Range 续传
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
                "phase": "连接下载源",
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

        # 半成品由 _run_download 收到取消信号时自行删掉 .part 文件，这里不重复处理。
        # 更不能像旧实现那样删「同名模型」——那会误删此前已下载完成的正式文件。
        return True
    finally:
        await redis.close()
