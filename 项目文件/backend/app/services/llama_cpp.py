"""本地 AI 引擎客户端（llama.cpp server）。

llama.cpp 的 server 以 **router 模式**运行（启动时不带 -m），按请求里的模型名
动态载入/卸载模型实例。它同时暴露两组接口：

- **OpenAI 兼容接口**（/v1/...）：对话、补全、embedding，业务代码走这组
- **管理接口**（根路径）：/health 健康、/models 模型清单与状态、
  /models/load 载入、/models/unload 卸载、/props 模型属性

**本模块只封装「引擎能力」，不含任何业务策略。** 谁该何时载入、内存够不够、
要不要预热，全由调用方决定——这样它才能同时服务于「模型自热备」和
「手动载入」两种场景而不打架。

旧的 Ollama 实现散落在 5 个文件里各写各的 URL，本模块收敛为唯一接入点。
"""

from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# 容器内走 Docker 网络别名。写 localhost 会指向调用方容器自身而连接失败。
HOST = "http://llama-cpp:8080"
OPENAI_BASE_URL = f"{HOST}/v1"

# 默认模型 = GGUF 文件名去掉扩展名，由 router 的 models-dir 扫描发现。
DEFAULT_MODEL = "qwen2.5-3b-instruct-q4_k_m"

# 模型内存占用粗估（MB），用于内存调度。
# 按模型名里的参数量匹配，而不是逐个模型名枚举——换模型时不必再维护对照表。
_MODEL_SIZE_MB: dict[str, int] = {
    "0.5b": 600,
    "1.5b": 1200,
    "1.7b": 1400,
    "3b": 2200,
    "4b": 3000,
    "7b": 4700,
    "8b": 5400,
    "14b": 9000,
}
_DEFAULT_SIZE_MB = 2200


def estimate_model_mb(model_name: str | None) -> int:
    """按模型名里的参数量粗估内存占用（MB）。"""
    name = (model_name or "").lower()
    for key, size in _MODEL_SIZE_MB.items():
        if key in name:
            return size
    return _DEFAULT_SIZE_MB


def status_value(entry: dict[str, Any]) -> str:
    """从 /models 的条目取状态值。

    可能值：loaded（已载入内存）/ loading / unloaded（有文件未载入）/
    sleeping（空闲自动卸载）/ downloading（router 正在拉取，带 progress）
    """
    status = entry.get("status") or {}
    return str(status.get("value") or "unknown")


async def list_models(timeout: float = 10.0) -> list[dict[str, Any]]:
    """列出 router 已知的全部模型（含未载入的）。"""
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(f"{HOST}/models")
        resp.raise_for_status()
        return resp.json().get("data", [])


async def reload_models(timeout: float = 30.0) -> list[dict[str, Any]]:
    """让 router 重新扫描模型目录并返回刷新后的清单。

    模型文件新增/删除后调它，不必重启容器。
    """
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(f"{HOST}/models", params={"reload": "1"})
        resp.raise_for_status()
        return resp.json().get("data", [])


async def load_model(model: str, timeout: float = 600.0) -> bool:
    """显式载入模型。冷启动要读盘，超时给足。

    幂等：已载入时直接成功。llama.cpp 对运行中的模型再发 load 会返回
    400 "model is already running"，但调用方（自热备预热、载入按钮）
    不该因为「本来就已经载入」而看到失败。
    """
    entry = await find_model(model)
    if entry is not None and status_value(entry) == "loaded":
        return True

    if not (entry is not None and status_value(entry) == "loading"):
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(f"{HOST}/models/load", json={"model": model})
            if resp.status_code != 400 or "already running" not in resp.text:
                # 400 + already running 属并发载入，不算失败；其余错误照常抛
                resp.raise_for_status()

    # 载入同样是异步的：接口返回时状态多半还是 loading，等真正就绪再回报
    return await wait_for_status(model, {"loaded"}, timeout=max(timeout, 300.0)) == "loaded"


async def unload_model(model: str, timeout: float = 120.0) -> bool:
    """卸载模型并归还内存，等状态落定后再返回。

    这是旧实现 keep_alive=0 那个副作用式 hack 的显式替代：
    实测卸载后进程内存回落到十几 MB。

    卸载是异步的，不等就会把 loaded 当结果回给前端——用户点了「卸载」，
    界面却仍显示「已就绪」。
    """
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(f"{HOST}/models/unload", json={"model": model})
        resp.raise_for_status()

    await wait_for_status(model, {"unloaded", "sleeping"})
    return True


async def health(timeout: float = 5.0) -> dict[str, Any]:
    """探活。200 且 status=ok 表示已就绪；503 表示模型仍在载入。"""
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(f"{HOST}/health")
        body: dict[str, Any] = {}
        try:
            body = resp.json()
        except Exception:
            pass
        return {"status_code": resp.status_code, **body}


async def find_model(model: str, timeout: float = 10.0) -> dict[str, Any] | None:
    """按模型名查条目；不存在返回 None。"""
    for entry in await list_models(timeout):
        if entry.get("id") == model:
            return entry
    return None


async def wait_for_status(
    model: str, wanted: set[str], timeout: float = 8.0
) -> str:
    """轮询等待模型状态进入目标集合，返回最终观测到的状态。

    llama.cpp 的 load / unload 都是**异步**的：接口返回 success 的那一刻，
    状态可能仍是 loading / loaded。直接把它回给前端会显示错状态
    （例如点了「卸载」，界面却还写着「已就绪」）。
    """
    deadline = time.monotonic() + timeout
    observed = "unknown"
    while True:
        entry = await find_model(model)
        if entry is None:
            return "missing"
        observed = status_value(entry)
        if observed in wanted or time.monotonic() >= deadline:
            return observed
        await asyncio.sleep(0.25)


# ── 模型资产（GGUF 文件）────────────────────────────────────────────
#
# 后端与 llama-cpp 共用同一个宿主目录 data/gguf：
#   后端挂载为 /data/gguf（负责写入：下载、删除）
#   llama-cpp 挂载为 /models（只读扫描，router 模式按文件名发现模型）
# 两边必须指向同一份字节，否则会出现「后端说下载完了，llama.cpp 看不到」。

MODELS_DIR = "/data/gguf"

# 可下载模型目录。key 即 llama.cpp 侧的模型 id（GGUF 文件名去掉扩展名）。
# 只在需要「下载」时才用到 repo/file，已落盘的模型不依赖本表。
MODEL_CATALOG: dict[str, dict[str, str]] = {
    "qwen2.5-1.5b-instruct-q4_k_m": {
        "label": "Qwen2.5-1.5B Instruct（Q4_K_M，最省内存）",
        "repo": "Qwen/Qwen2.5-1.5B-Instruct-GGUF",
        "file": "qwen2.5-1.5b-instruct-q4_k_m.gguf",
        "sha256": "6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e",
    },
    "qwen2.5-3b-instruct-q4_k_m": {
        "label": "Qwen2.5-3B Instruct（Q4_K_M，默认）",
        "repo": "Qwen/Qwen2.5-3B-Instruct-GGUF",
        "file": "qwen2.5-3b-instruct-q4_k_m.gguf",
        "sha256": "626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d",
    },
    # Ollama 时代的旧模型名 → GGUF 目录名。兼容遗留配置与前端旧缓存：
    # 用户数据库或浏览器还存着 qwen2.5:3b 时，下载/载入也能正确落到 GGUF。
    # 7B 因分片未入目录，别名保留但下载会报「不在目录」。
    "_OLD_ALIASES": {
        "qwen2.5:1.5b": "qwen2.5-1.5b-instruct-q4_k_m",
        "qwen2.5:3b": "qwen2.5-3b-instruct-q4_k_m",
        "qwen2.5:7b": "qwen2.5-7b-instruct-q4_k_m",
        "qwen3:1.7b": "qwen2.5-1.5b-instruct-q4_k_m",
        "qwen3.5:4b": "qwen2.5-3b-instruct-q4_k_m",
    },
    # 注意：qwen2.5-7b-instruct-q4_k_m 是**分片文件**（00001-of-00002），
    # 当前下载器与 llama.cpp 的 models-dir 均按单文件处理，分片需子目录结构，
    # 故暂不列入可下载目录。需要 7B 时：手动把两个分片放进 data/gguf/<name>/ 子目录即可。
}

# 下载源，按顺序尝试。国内网络下镜像往往比主站快，所以两个都留着。
DOWNLOAD_ORIGINS: tuple[str, ...] = ("https://huggingface.co", "https://hf-mirror.com")


def local_model_files() -> list[dict[str, Any]]:
    """扫描本地 GGUF 文件（后端视角）。

    目录不存在时返回空列表而不是抛错：首次部署、目录被清空都属正常状态，
    调用方据此显示「无已下载模型」即可。
    """
    directory = Path(MODELS_DIR)
    if not directory.is_dir():
        return []
    out: list[dict[str, Any]] = []
    for path in sorted(directory.glob("*.gguf")):
        try:
            size_bytes = path.stat().st_size
        except OSError:
            continue
        out.append({
            "name": path.stem,
            "file": path.name,
            "size_bytes": size_bytes,
            "size_mb": round(size_bytes / 1048576, 1),
        })
    return out


def model_file_path(model: str) -> Path:
    """模型名 → GGUF 文件绝对路径。"""
    return Path(MODELS_DIR) / f"{model}.gguf"


def _canonical_model_name(model: str) -> str:
    """旧模型名（Ollama 别名）归一化到 GGUF 目录名；未知则原样返回。"""
    return MODEL_CATALOG["_OLD_ALIASES"].get(model, model)


def resolve_download_target(model: str) -> dict[str, Any] | None:
    """把模型名解析成可下载目标；不在目录里返回 None。

    先做旧名（qwen2.5:3b 等）→ GGUF 目录名归一化，再查目录。
    """
    canonical = _canonical_model_name(model)
    entry = MODEL_CATALOG.get(canonical)
    if entry is None:
        return None
    suffix = f"{entry['repo']}/resolve/main/{entry['file']}"
    return {
        "model": canonical,
        "file": entry["file"],
        "label": entry["label"],
        "sha256": entry.get("sha256"),
        "urls": [f"{origin}/{suffix}" for origin in DOWNLOAD_ORIGINS],
    }

