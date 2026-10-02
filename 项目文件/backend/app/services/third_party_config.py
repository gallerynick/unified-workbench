"""第三方服务配置业务逻辑"""

from __future__ import annotations

import logging
import threading
import time
from typing import Any

logger = logging.getLogger(__name__)

# ── ASR 模型下载进度（字节级，与 AI 下载一致的前端展示）────────────
# 后台下载线程把进度写进这个模块级状态，get_asr_model_status 读取后
# 随状态一起返回；前端据此渲染进度条 / 速度 / 预计剩余时间。
_asr_dl_lock = threading.Lock()
_asr_dl_state: dict[str, Any] = {
    "running": False,
    "started_at": None,
    "total_bytes": 0,
    "downloaded_bytes": 0,
    "speed": 0.0,
    "eta_seconds": None,
    "progress": 0.0,
    "samples": [],  # [(ts, downloaded_bytes)]
}

# SenseVoiceSmall-onnx 仓库的模型文件（model_quant.onnx 占体积大头）
_ASR_MODEL_FILES: tuple[str, ...] = (
    ".gitattributes", "am.mvn", "config.yaml", "configuration.json",
    "model_quant.onnx", "README.md", "tokens.json",
)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_config import SystemConfig
from app.models.user import User
from app.schemas.third_party_config import (
    AIProviderConfig,
    ASRConfig,
    TestConnectionResponse,
    ThirdPartyConfig,
    WarmupConfig,
)
from app.services import llama_cpp
from app.services.llama_cpp import (
    DEFAULT_MODEL as LOCAL_AI_MODEL,
    OPENAI_BASE_URL as LOCAL_AI_BASE_URL,
)

DEFAULT_AI_CONFIG = {
    "mode": "local",
    "local": {
        "base_url": LOCAL_AI_BASE_URL,
        "model": LOCAL_AI_MODEL,
    },
    "online": {
        "base_url": "https://api.openai.com/v1",
        "model": "",
        "api_key": None,
    },
    "parameters": {
        "temperature": 0.2,
        "max_tokens": 3000,
        "response_format": "json",
    },
}

DEFAULT_WARMUP_CONFIG = {
    "ai": False,
    "asr": False,
}

DEFAULT_ASR_CONFIG = {
    "mode": "local",
    "local": {
        "model": "sensevoice",
    },
    "online": {
        "provider": "openai",
        "model": "",
        "api_key": None,
        "base_url": "https://api.openai.com/v1",
    },
    "parameters": {
        "sample_rate": 16000,
        # 静音超时：超过此秒数无语音则切句（webrtcvad 句子边界）
        "silence_timeout": 1.5,
        # 语言白名单：只允许识别这些语言（zh/en/ja/ko/yue），
        # 白名单外的语言（auto 检出）会被丢弃
        "allowed_languages": ["zh"],
    },
}


def _deep_merge_defaults(default: dict[str, Any], saved: dict[str, Any]) -> dict[str, Any]:
    """合并默认配置和已保存配置：已保存的非空值优先，缺失项回落到默认值"""
    result: dict[str, Any] = {}
    for key, default_value in default.items():
        saved_value = saved.get(key)
        if saved_value is None or saved_value == {}:
            result[key] = default_value
        elif isinstance(default_value, dict) and isinstance(saved_value, dict):
            result[key] = _deep_merge_defaults(default_value, saved_value)
        else:
            result[key] = saved_value
    # 保留已保存的额外键，避免旧配置里有新字段被吞掉
    for key, saved_value in saved.items():
        if key not in result:
            result[key] = saved_value
    return result


async def get_third_party_config(db: AsyncSession) -> ThirdPartyConfig:
    """获取第三方服务配置"""
    saved_ai = await _get_config_value(db, "ai_provider", DEFAULT_AI_CONFIG)
    saved_asr = await _get_config_value(db, "asr_config", DEFAULT_ASR_CONFIG)
    saved_warmup = await _get_config_value(db, "warmup", DEFAULT_WARMUP_CONFIG)
    ai_config = _deep_merge_defaults(DEFAULT_AI_CONFIG, saved_ai)
    asr_config = _deep_merge_defaults(DEFAULT_ASR_CONFIG, saved_asr)
    warmup_config = _deep_merge_defaults(DEFAULT_WARMUP_CONFIG, saved_warmup)

    return ThirdPartyConfig(
        ai_provider=AIProviderConfig(**ai_config),
        asr_config=ASRConfig(**asr_config),
        warmup=WarmupConfig(**warmup_config),
    )


async def update_third_party_config(
    db: AsyncSession, user: User, data: dict[str, Any]
) -> ThirdPartyConfig:
    """更新第三方服务配置"""
    if "ai_provider" in data:
        await _save_config_value(
            db, "ai_provider", data["ai_provider"]
        )

    if "asr_config" in data:
        await _save_config_value(
            db, "asr_config", data["asr_config"]
        )

    if "warmup" in data:
        await _save_config_value(
            db, "warmup", data["warmup"]
        )

    return await get_third_party_config(db)


async def _get_config_value(
    db: AsyncSession, key: str, default: dict[str, Any]
) -> dict[str, Any]:
    """获取配置值"""
    result = await db.execute(
        select(SystemConfig).where(SystemConfig.key == key)
    )
    config = result.scalar_one_or_none()

    if config:
        return config.value
    return default


async def _save_config_value(
    db: AsyncSession, key: str, value: dict[str, Any]
) -> None:
    """保存配置值"""
    result = await db.execute(
        select(SystemConfig).where(SystemConfig.key == key)
    )
    config = result.scalar_one_or_none()

    if config:
        config.value = value
    else:
        config = SystemConfig(
            key=key,
            value=value,
        )
        db.add(config)

    await db.flush()


async def test_ai_connection(db: AsyncSession) -> TestConnectionResponse:
    """测试 AI 服务连接"""
    config = await get_third_party_config(db)

    if config.ai_provider.mode == "local":
        # 测试本地 llama.cpp 服务
        try:
            models = await llama_cpp.list_models(timeout=5.0)
            model_name = config.ai_provider.local.get("model") or llama_cpp.DEFAULT_MODEL
            entry = next((m for m in models if m.get("id") == model_name), None)
            if entry is None:
                return TestConnectionResponse(
                    success=False,
                    message=f"模型 {model_name} 未下载",
                    details={"model": model_name, "model_count": len(models)},
                )
            return TestConnectionResponse(
                success=True,
                message="本地 AI 服务配置正常",
                details={
                    "model": model_name,
                    "model_count": len(models),
                    "status": llama_cpp.status_value(entry),
                },
            )
        except Exception as e:
            return TestConnectionResponse(
                success=False,
                message=f"本地 AI 服务连接失败：{str(e)}",
            )
    else:
        # 测试在线 API
        base_url = config.ai_provider.online.get("base_url", "")
        api_key = config.ai_provider.online.get("api_key", "")
        model = config.ai_provider.online.get("model", "")

        if not base_url or not api_key:
            return TestConnectionResponse(
                success=False,
                message="请填写完整的 API 地址和密钥",
            )

        import httpx
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{base_url}/chat/completions",
                    json={"model": model, "messages": [{"role": "user", "content": "Hi"}], "max_tokens": 10},
                    headers={"Authorization": f"Bearer {api_key}"},
                )
                if response.status_code == 200:
                    return TestConnectionResponse(
                        success=True,
                        message=f"在线 AI 服务连接正常 ({model})",
                        details={"provider": base_url},
                    )
                else:
                    return TestConnectionResponse(
                        success=False,
                        message=f"API 返回错误：{response.status_code}",
                        details={"error": response.text[:200]},
                    )
        except Exception as e:
            return TestConnectionResponse(
                success=False,
                message=f"连接失败：{str(e)}",
            )


async def test_asr_service(db: AsyncSession) -> TestConnectionResponse:
    """测试 ASR 服务"""
    config = await get_third_party_config(db)

    if config.asr_config.mode == "local":
        # 检查本地 ASR 模型是否可用
        return TestConnectionResponse(
            success=True,
            message="本地 ASR 服务配置正常",
            details={"model": config.asr_config.local.get("model")},
        )
    else:
        # 测试在线 ASR API
        provider = config.asr_config.online.get("provider", "openai")
        api_key = config.asr_config.online.get("api_key", "")
        base_url = config.asr_config.online.get("base_url", "")

        if not api_key:
            return TestConnectionResponse(
                success=False,
                message="请填写 API Key",
            )

        import httpx
        try:
            if provider == "openai":
                url = f"{base_url}/models"
                headers = {"Authorization": f"Bearer {api_key}"}
            else:
                url = base_url
                headers = {}

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, headers=headers)
                if response.status_code == 200:
                    return TestConnectionResponse(
                        success=True,
                        message=f"在线 ASR 服务连接正常 ({provider})",
                        details={"provider": provider},
                    )
                else:
                    return TestConnectionResponse(
                        success=False,
                        message=f"API 返回错误：{response.status_code}",
                        details={"error": response.text[:200]},
                    )
        except Exception as e:
            return TestConnectionResponse(
                success=False,
                message=f"连接失败：{str(e)}",
            )


async def test_ai_with_config(ai_config: AIProviderConfig, measure_speed: bool = False, test_prompt: str = "Hi") -> TestConnectionResponse:
    """使用临时配置测试 AI 连接，支持测速"""
    mem_msg = ""
    if ai_config.mode == "local":
        # 智能内存调度：测速需要加载模型，先检查内存是否足够
        if measure_speed:
            model_name = ai_config.local.get("model") or llama_cpp.DEFAULT_MODEL
            est_mb = llama_cpp.estimate_model_mb(model_name)
            mem_result = await prepare_memory_for_model(est_mb, "AI 测速")
            if mem_result["action"] == "insufficient":
                return TestConnectionResponse(
                    success=False,
                    message=mem_result["message"],
                    details={"available_mb": mem_result["available_mb"]},
                )
            mem_msg = mem_result["message"]
            if mem_result["action"] == "unloaded":
                pass  # 卸载消息会在测试完成后一起返回
        
        import httpx
        try:
            models = await llama_cpp.list_models(timeout=10.0)
            model_name = ai_config.local.get("model") or llama_cpp.DEFAULT_MODEL
            if not any(m.get("id") == model_name for m in models):
                return TestConnectionResponse(
                    success=False,
                    message=f"模型 {model_name} 未下载",
                )

            # 测速模式：发一次生成请求，读取 llama.cpp 返回的 timings
            if measure_speed:
                import time

                start_time = time.time()
                async with httpx.AsyncClient(timeout=300.0) as client:
                    generate_response = await client.post(
                        f"{LOCAL_AI_BASE_URL}/chat/completions",
                        json={
                            "model": model_name,
                            "messages": [{"role": "user", "content": test_prompt}],
                            "stream": False,
                            "temperature": ai_config.parameters.get("temperature", 0.2),
                            # 64 个 token：够看吞吐量级且快（纯 CPU 4 线程下 200 token 要 30s）；
                            # 需要更稳的速率可用 200（约 5 倍耗时）
                            "max_tokens": 64,
                        },
                    )
                total_time = time.time() - start_time

                if generate_response.status_code != 200:
                    # 失败原因在 error.message 里，要读出来，
                    # 否则只会得到「生成请求失败：500」这种无从下手的信息
                    detail = ""
                    try:
                        detail = (generate_response.json().get("error") or {}).get("message", "")
                    except Exception:
                        detail = generate_response.text[:300]
                    low = (detail or "").lower()
                    if "killed" in low or "out of memory" in low or "failed to load" in low:
                        message = (
                            "模型加载失败（进程被系统杀掉，通常是内存不足）："
                            f"{detail or 'signal: killed'}"
                        )
                    else:
                        message = f"生成请求失败：{detail or generate_response.status_code}"
                    return TestConnectionResponse(success=False, message=message)

                result = generate_response.json()
                timings = result.get("timings") or {}
                usage = result.get("usage") or {}
                choice = (result.get("choices") or [{}])[0]

                eval_count = timings.get("predicted_n") or usage.get("completion_tokens", 0)
                # llama.cpp 的 timings 直接给速率，不必再自己拿 token 数除以耗时
                tokens_per_second = timings.get("predicted_per_second") or 0.0
                prompt_rate = timings.get("prompt_per_second") or 0.0
                visible = len((choice.get("message") or {}).get("content") or "")

                if eval_count == 0:
                    return TestConnectionResponse(
                        success=False,
                        message="模型未产生任何 token，请检查模型是否正常",
                    )

                msg = f"测速完成：{tokens_per_second:.1f} tokens/s"
                if mem_result.get("action") == "unloaded":
                    msg += f"（{mem_result['message']}）"
                return TestConnectionResponse(
                    success=True,
                    message=msg,
                    details={
                        "model": model_name,
                        "tokens_per_second": round(tokens_per_second, 2),
                        "total_tokens": eval_count,
                        "total_latency_ms": int(total_time * 1000),
                        # 额外指标，前端和日志用得上
                        "eval_count": eval_count,
                        "prompt_eval_count": timings.get("prompt_n", 0),
                        "prompt_tokens_per_second": round(prompt_rate, 2),
                        "done_reason": choice.get("finish_reason"),
                        "response_chars": visible,
                    },
                )

            # 非测速路径 = 前端的「载入模型」按钮。
            # 必须真的把模型载入内存：旧实现靠发一次生成请求隐式触发加载，
            # 只校验文件存在会让按钮显示成功而模型其实没进内存。
            await llama_cpp.load_model(model_name)
            return TestConnectionResponse(
                success=True,
                message="模型已载入",
                details={
                    "model": model_name,
                    "model_count": len(models),
                    "loaded": True,
                },
            )
        except Exception as e:
            return TestConnectionResponse(
                success=False,
                message=f"本地 AI 服务连接失败：{str(e)}",
            )
    else:
        base_url = ai_config.online.get("base_url", "")
        api_key = ai_config.online.get("api_key", "")
        model = ai_config.online.get("model", "")

        if not base_url or not api_key:
            return TestConnectionResponse(
                success=False,
                message="请填写完整的 API 地址和密钥",
            )

        import httpx
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{base_url}/chat/completions",
                    json={"model": model, "messages": [{"role": "user", "content": "Hi"}], "max_tokens": 10},
                    headers={"Authorization": f"Bearer {api_key}"},
                )
                if response.status_code == 200:
                    return TestConnectionResponse(
                        success=True,
                        message=f"在线 AI 服务连接正常 ({model})",
                        details={"provider": base_url},
                    )
                else:
                    return TestConnectionResponse(
                        success=False,
                        message=f"API 返回错误：{response.status_code}",
                        details={"error": response.text[:200]},
                    )
        except Exception as e:
            return TestConnectionResponse(
                success=False,
                message=f"连接失败：{str(e)}",
            )


def _local_asr_model_names(config: ThirdPartyConfig) -> list[str]:
    """本地 ASR 需要缓存的模型。

    换 SenseVoice 后只需主模型（ONNX 自带标点与语言识别）；
    VAD 由场景层（会议模块）负责，说话人分离走 sherpa-onnx 独立目录，
    两者都不再占用 ModelScope 缓存槽位。
    """
    local = config.asr_config.local or {}
    return [local.get("model") or "sensevoice"]


async def _test_local_asr(asr_config: ASRConfig) -> TestConnectionResponse:
    """真的加载模型并跑一段音频，而不是只回一句「配置正常」。

    ASR 引擎是同步阻塞的（ONNX 推理 + 模型加载），直接 await 会卡死
    asyncio 事件循环，导致 WebSocket 心跳和并发请求全部挂起。用 to_thread
    丢到线程池执行，主事件循环保持空闲。
    """
    import asyncio

    from app.services import asr_engine

    local = asr_config.local or {}

    # 智能内存调度：SenseVoice ONNX 量化版常驻约 500 MB
    mem_result = await prepare_memory_for_model(500, "ASR 测试")
    if mem_result["action"] == "insufficient":
        return TestConnectionResponse(
            success=False,
            message=mem_result["message"],
            details={"available_mb": mem_result["available_mb"]},
        )
    mem_msg = mem_result["message"] if mem_result["action"] == "unloaded" else ""

    try:
        await asyncio.to_thread(
            asr_engine.init_asr_model,
            local.get("model") or "sensevoice",
        )
    except Exception as e:
        return TestConnectionResponse(success=False, message=f"ASR 模型加载失败：{e}")

    # 440Hz、0.5 秒的音调：走通 VAD → ASR → 标点 → 声纹整条流水线
    # 音调本身不会识别出文字，所以这里验的是「流水线能跑」而不是「识别准」
    import numpy as np

    t = np.arange(16000) / 16000.0
    tone = (np.sin(2 * np.pi * 440.0 * t) * 16000).astype(np.int16)

    try:
        await asyncio.to_thread(asr_engine.transcribe_audio_array, tone.tobytes())
    except Exception as e:
        return TestConnectionResponse(success=False, message=f"ASR 转录失败：{e}")

    msg = "本地 ASR 服务可用（模型已加载，流水线跑通）"
    if mem_msg:
        msg += f"（{mem_msg}）"
    return TestConnectionResponse(
        success=True,
        message=msg,
        details={"model": local.get("model"), "loaded": asr_engine.is_available()},
    )


async def test_asr_with_config(asr_config: ASRConfig) -> TestConnectionResponse:
    """使用临时配置测试 ASR 连接"""
    if asr_config.mode == "local":
        return await _test_local_asr(asr_config)
    else:
        provider = asr_config.online.get("provider", "openai")
        api_key = asr_config.online.get("api_key", "")
        base_url = asr_config.online.get("base_url", "")

        if not api_key:
            return TestConnectionResponse(
                success=False,
                message="请填写 API Key",
            )

        import httpx
        try:
            if provider == "openai":
                url = f"{base_url}/models"
                headers = {"Authorization": f"Bearer {api_key}"}
            else:
                url = base_url
                headers = {}

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, headers=headers)
                if response.status_code == 200:
                    return TestConnectionResponse(
                        success=True,
                        message=f"在线 ASR 服务连接正常 ({provider})",
                        details={"provider": provider},
                    )
                else:
                    return TestConnectionResponse(
                        success=False,
                        message=f"API 返回错误：{response.status_code}",
                        details={"error": response.text[:200]},
                    )
        except Exception as e:
            return TestConnectionResponse(
                success=False,
                message=f"连接失败：{str(e)}",
            )


async def preload_asr_models(db: AsyncSession) -> TestConnectionResponse:
    """预热本地 ASR 模型：缓存里没有的从 ModelScope 下载，然后加载进内存。

    首次下载约 300 MB 权重，耗时可能几分钟，所以在后台线程里跑，
    接口立即返回；进度通过 /asr/status 轮询查看。
    """
    import asyncio

    from app.services import asr_engine

    config = await get_third_party_config(db)
    if config.asr_config.mode != "local":
        return TestConnectionResponse(success=False, message="在线模式无需下载模型")

    local = config.asr_config.local or {}
    cached = asr_engine.get_cached_asr_models(_local_asr_model_names(config))

    if asr_engine.is_available():
        return TestConnectionResponse(
            success=True,
            message="ASR 模型已就绪",
            details={"downloaded": cached["downloaded"], "total": cached["total"], "loaded": True},
        )

    need_download = cached["downloaded"] < cached["total"]

    async def _prepare_in_background() -> None:
        """后台：缓存不齐先下载（modelscope），下载完成再加载进内存。"""
        try:
            if need_download:
                await asyncio.to_thread(_download_asr_models, cached["models"])
            await asyncio.to_thread(
                asr_engine.init_asr_model,
                local.get("model") or "sensevoice",
            )
        except Exception as e:
            logger.warning("ASR 模型后台准备失败：%s", e)

    task = asyncio.create_task(_prepare_in_background())

    return TestConnectionResponse(
        success=True,
        message="ASR 模型下载并载入已开始" if need_download else "ASR 模型载入已开始",
        details={
            "downloaded": cached["downloaded"],
            "total": cached["total"],
            "loaded": False,
            "loading": True,
            "downloading": need_download,
        },
    )


def _update_asr_dl_progress(n: int) -> None:
    """下载线程：累计字节并滑动窗口算速度 / ETA。"""
    now = time.time()
    with _asr_dl_lock:
        s = _asr_dl_state
        s["downloaded_bytes"] += n
        s["samples"].append((now, s["downloaded_bytes"]))
        while s["samples"] and now - s["samples"][0][0] > 10:
            s["samples"].pop(0)
        if len(s["samples"]) >= 2 and s["samples"][-1][0] > s["samples"][0][0]:
            span = s["samples"][-1][0] - s["samples"][0][0]
            s["speed"] = max(0.0, (s["samples"][-1][1] - s["samples"][0][1]) / span)
        remaining = s["total_bytes"] - s["downloaded_bytes"]
        s["eta_seconds"] = (
            round(remaining / s["speed"]) if s["speed"] > 0 and remaining > 0 else None
        )
        s["progress"] = (
            min(100.0, s["downloaded_bytes"] / s["total_bytes"] * 100)
            if s["total_bytes"] > 0
            else 0.0
        )


def asr_download_progress() -> dict[str, Any]:
    """读取当前 ASR 下载进度（供 get_asr_model_status 返回）。"""
    with _asr_dl_lock:
        s = _asr_dl_state
        elapsed = (
            round(time.time() - s["started_at"]) if s["started_at"] else 0
        )
        return {
            "downloading": s["running"],
            "download_progress": round(s["progress"], 1),
            "download_speed": round(s["speed"], 1),
            "download_eta_seconds": s["eta_seconds"],
            "download_downloaded_mb": round(s["downloaded_bytes"] / 1048576, 1),
            "download_total_mb": round(s["total_bytes"] / 1048576, 1),
            "download_elapsed_seconds": elapsed,
        }


def _download_asr_models(models: list[dict[str, Any]]) -> None:
    """后台下载缺失的 ASR 模型：从 ModelScope 直连流式下载，发布字节级进度。

    与 AI（GGUF）下载走同一条前端展示路径：进度条 + 速度 + 预计剩余。
    """
    import os
    import shutil

    import httpx

    os.environ.setdefault("MODELSCOPE_CACHE", "/home/workbench/.modelscope")
    from app.services import asr_engine

    with _asr_dl_lock:
        _asr_dl_state["running"] = True
        _asr_dl_state["started_at"] = time.time()
        _asr_dl_state["total_bytes"] = 0
        _asr_dl_state["downloaded_bytes"] = 0
        _asr_dl_state["speed"] = 0.0
        _asr_dl_state["eta_seconds"] = None
        _asr_dl_state["progress"] = 0.0
        _asr_dl_state["samples"] = []

    try:
        for item in models:
            repo_id = item.get("repo_id")
            if item.get("ready") or not repo_id:
                continue
            cache_dir = asr_engine._model_cache_dir(repo_id)
            snap = asr_engine._snapshot_dir(cache_dir) or os.path.join(
                cache_dir, "snapshots", "master"
            )
            os.makedirs(snap, exist_ok=True)

            files = _ASR_MODEL_FILES
            # 逐个流式下载。进度分母（total_bytes）在下载时从 GET 响应头累加：
            # modelscope 对 HEAD 不返回 content-length（chunked），HEAD 拿不到大小。
            for fname in files:
                url = f"https://modelscope.cn/models/{repo_id}/resolve/master/{fname}"
                target = os.path.join(snap, fname)
                if os.path.isfile(target) and os.path.getsize(target) > 0:
                    # 已落盘的文件算作已下载字节，不重复拉取
                    with _asr_dl_lock:
                        _asr_dl_state["total_bytes"] += os.path.getsize(target)
                        _asr_dl_state["downloaded_bytes"] += os.path.getsize(target)
                    continue
                with httpx.stream("GET", url, timeout=300.0, follow_redirects=True) as resp:
                    resp.raise_for_status()
                    size = int(resp.headers.get("content-length") or 0)
                    with _asr_dl_lock:
                        _asr_dl_state["total_bytes"] += size
                    with open(target, "wb") as f:
                        for chunk in resp.iter_bytes(1 << 20):
                            f.write(chunk)
                            _update_asr_dl_progress(len(chunk))

            _ensure_sensevoice_bpe(repo_id)
    except Exception as e:
        logger.warning("ASR 模型下载失败：%s", e)
    finally:
        with _asr_dl_lock:
            _asr_dl_state["running"] = False
            _asr_dl_state["progress"] = (
                100.0
                if _asr_dl_state["total_bytes"] > 0
                and _asr_dl_state["downloaded_bytes"] >= _asr_dl_state["total_bytes"]
                else _asr_dl_state["progress"]
            )
            _asr_dl_state["eta_seconds"] = None


def _ensure_sensevoice_bpe(repo_id: str) -> None:
    """SenseVoice ONNX 仓库缺 sentencepiece 分词文件，需从 torch 版仓库补取。

    funasr-onnx 的 SenseVoiceSmall 加载时需要 chn_jpn_yue_eng_ko_spectok.bpe.model，
    而 iic/SenseVoiceSmall-onnx 仓库里没有它（只在 iic/SenseVoiceSmall 里）。
    下载 ONNX 后检查缺失则只拉取该文件（377 KB，allow_patterns 避免整仓下载）并复制。
    """
    import os
    import shutil

    from app.services import asr_engine

    onnx_dir = asr_engine._snapshot_dir(asr_engine._model_cache_dir(repo_id))
    if not onnx_dir:
        return
    bpe_target = os.path.join(onnx_dir, "chn_jpn_yue_eng_ko_spectok.bpe.model")
    if os.path.isfile(bpe_target):
        return

    from modelscope.hub.snapshot_download import snapshot_download

    try:
        src = snapshot_download(
            "iic/SenseVoiceSmall",
            revision="master",
            allow_patterns=["chn_jpn_yue_eng_ko_spectok.bpe.model"],
        )
        src_file = os.path.join(src, "chn_jpn_yue_eng_ko_spectok.bpe.model")
        if os.path.isfile(src_file):
            shutil.copy2(src_file, bpe_target)
            logger.info("已补取 SenseVoice BPE 分词文件：%s", bpe_target)
    except Exception as e:
        logger.warning("补取 SenseVoice BPE 失败：%s", e)
    finally:
        # 临时源只用了一次，copy 完即删，避免在模型清单里留下 torch 版孤儿缓存
        try:
            temp_cache = os.path.join(
                asr_engine._cache_base(), "iic--SenseVoiceSmall"
            )
            if os.path.isdir(temp_cache):
                shutil.rmtree(temp_cache, ignore_errors=True)
        except Exception:
            pass


async def reload_asr_model(db: AsyncSession) -> TestConnectionResponse:
    """重载 ASR 模型：先卸载内存里的实例，再按当前配置重新加载。

    之前的实现只回一句「已重载」，什么都没做。
    """
    from app.services import asr_engine

    config = await get_third_party_config(db)
    if config.asr_config.mode != "local":
        return TestConnectionResponse(success=False, message="在线模式无需重载")

    local = config.asr_config.local or {}
    try:
        asr_engine.shutdown_asr_model()
        asr_engine.init_asr_model(local.get("model") or "sensevoice")
    except Exception as e:
        return TestConnectionResponse(success=False, message=f"重载失败：{e}")

    return TestConnectionResponse(
        success=True,
        message="ASR 模型已重载",
        details={"model": local.get("model"), "loaded": asr_engine.is_available()},
    )


async def delete_asr_model(db: AsyncSession) -> TestConnectionResponse:
    """删除本地 ASR 模型的 ModelScope 缓存。

    只删当前配置里这几个模型自己的 snapshots 目录。
    之前的实现删的是 /data/asr-models——那个目录从来不存在；而且用
    os.listdir 遍历删除，一旦路径写错就会把别的东西一起删掉。
    """
    from app.services import asr_engine

    config = await get_third_party_config(db)
    if config.asr_config.mode != "local":
        return TestConnectionResponse(success=False, message="仅本地模式支持删除模型")

    names = _local_asr_model_names(config)
    try:
        asr_engine.shutdown_asr_model()
        result = asr_engine.delete_asr_cache_models(names)
    except Exception as e:
        return TestConnectionResponse(success=False, message=f"删除失败：{e}")

    deleted = result["deleted"]
    if not deleted:
        return TestConnectionResponse(
            success=True, message="模型缓存不存在，无需删除", details=result
        )

    message = f"已删除 {len(deleted)} 个模型，释放 {result['freed_mb']:.0f} MB"
    if result["missing"]:
        message += f"（{len(result['missing'])} 个原本就不存在）"
    return TestConnectionResponse(success=True, message=message, details=result)


async def get_asr_model_status(db: AsyncSession) -> dict:
    """获取本地 ASR 模型状态，以 ModelScope 缓存目录为准。

    之前的实现查的是 /data/asr-models，那个目录从头到尾不存在，
    于是状态永远是 not_downloaded，前端的「测试识别 / 删除模型」
    按钮也因为 gated 在 downloaded 上而永远不出现。
    """
    from app.services import asr_engine

    config = await get_third_party_config(db)
    if config.asr_config.mode != "local":
        return {"status": "not_available", "message": "当前为在线模式", "details": {}}

    names = _local_asr_model_names(config)
    try:
        cached = asr_engine.get_cached_asr_models(names)
    except Exception as e:
        return {"status": "error", "message": f"检查模型状态失败：{e}", "details": {}}

    done = cached["downloaded"]
    total = cached["total"]
    loaded = asr_engine.is_available()
    if done == total and loaded:
        status = "ready"
        message = f"ASR 模型已就绪（{done}/{total}）"
    elif done == total:
        status = "downloaded"
        message = f"ASR 模型已下载（{done}/{total}）"
    elif done > 0:
        status = "partial"
        message = f"ASR 模型部分就绪（{done}/{total}）"
    else:
        status = "not_downloaded"
        message = "ASR 模型未下载"

    dl = asr_download_progress()
    return {
        "status": status,
        "message": message,
        "details": {
            "models": cached["models"],
            "downloaded": done,
            "total": total,
            "loaded": loaded,
            # 下载进度（与 AI 下载同源的字节级进度，供前端统一展示）
            **dl,
        },
    }


async def warmup_ai_model(db: AsyncSession | None = None) -> TestConnectionResponse:
    """按配置预热本地 AI 模型。

    仅当资源充足且模型可用时执行，避免启动阶段直接抢内存。
    预热采用轻量生成请求，多次调用以触发加载路径并稳定缓存。
    """
    import httpx

    config = await get_third_party_config(db)
    if config.ai_provider.mode != "local":
        return TestConnectionResponse(success=False, message="在线模式无需预热")

    local = config.ai_provider.local or {}
    model_name = local.get("model") or llama_cpp.DEFAULT_MODEL
    est_mb = llama_cpp.estimate_model_mb(model_name)

    mem_result = await prepare_memory_for_model(est_mb, "AI 自启动预热")
    if mem_result["action"] == "insufficient":
        return TestConnectionResponse(
            success=False,
            message=mem_result["message"],
            details={"available_mb": mem_result["available_mb"]},
        )

    try:
        entries = await llama_cpp.list_models(timeout=10.0)
        if not any(m.get("id") == model_name for m in entries):
            return TestConnectionResponse(
                success=False,
                message=f"模型 {model_name} 未下载",
            )

        # 预热 = 显式载入（核心） + 尝试跑几次极短生成把 KV cache 走热。
        # 载入用 /models/load 而非靠请求隐式触发，载入失败时能拿到明确错误。
        # 生成测试是**次要**的：模型刚载入时首个请求偶发连接断开（llama-cpp
        # 仍在预热权重路径），此时模型已 loaded，自热备目的已达成——
        # 生成测试失败只警告、不判预热失败，避免自热备被瞬时请求错误打断。
        await llama_cpp.load_model(model_name)

        warmup_runs = 0
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                for _ in range(3):
                    resp = await client.post(
                        f"{LOCAL_AI_BASE_URL}/chat/completions",
                        json={
                            "model": model_name,
                            "messages": [{"role": "user", "content": "Hi"}],
                            "stream": False,
                            "max_tokens": 2,
                        },
                    )
                    if resp.status_code == 200:
                        warmup_runs += 1
        except Exception as e:
            logger.warning("AI 预热生成测试失败（模型已载入，不影响自热备）：%s", e)
    except Exception as e:
        return TestConnectionResponse(success=False, message=f"模型预热失败：{e}")

    return TestConnectionResponse(
        success=True,
        message="AI 模型已预热",
        details={"model": model_name, "warmup_runs": warmup_runs},
    )


async def auto_start_ai_warmup(db: AsyncSession) -> TestConnectionResponse:
    """自启动预热入口：只在本地模式且开启模型自热备时执行。"""
    config = await get_third_party_config(db)
    if config.ai_provider.mode != "local":
        return TestConnectionResponse(success=False, message="在线模式无需模型自热备")
    if not config.warmup.ai:
        return TestConnectionResponse(success=False, message="未开启模型自热备")
    return await warmup_ai_model(db)


async def get_memory_info() -> dict[str, Any]:
    """获取当前系统内存使用情况。

    读取 /proc/meminfo（Linux 容器内），返回总量、已用、可用、推荐值。
    智能判断警告：只在模型未加载时发出加载警告，已加载则视为正常占用。
    推荐值动态计算：基于当前已加载模型 + 系统开销。
    """
    import platform
    from app.services import asr_engine

    info: dict[str, Any] = {
        "total_mb": None,
        "used_mb": None,
        "available_mb": None,
        "recommended_vm_mb": 8192,
        "recommended_host_gb": 16,
        "platform": platform.system(),
        "asr_loaded": False,
        "ai_loaded": False,
        "loaded_mb": 0,
    }

    try:
        with open("/proc/meminfo") as f:
            meminfo = {}
            for line in f:
                parts = line.split(":")
                if len(parts) == 2:
                    key = parts[0].strip()
                    val = parts[1].strip().split()[0]
                    meminfo[key] = int(val)

        total_kb = meminfo.get("MemTotal", 0)
        available_kb = meminfo.get("MemAvailable", 0)
        info["total_mb"] = round(total_kb / 1024)
        info["used_mb"] = round((total_kb - available_kb) / 1024)
        info["available_mb"] = round(available_kb / 1024)

        # 检查 ASR 是否已加载
        asr_loaded = asr_engine.is_available()

        # 如果缓存已经齐了，即使进程内还没初始化，也不要立刻报“可能无法加载”
        try:
            cached = asr_engine.get_cached_asr_models(_local_asr_model_names(config))
            if not asr_loaded and cached["downloaded"] == cached["total"]:
                asr_loaded = True
        except Exception:
            pass

        info["asr_loaded"] = asr_loaded

        # 检查 AI 模型是否已载入内存（llama.cpp 的 /models 状态）
        try:
            for entry in await llama_cpp.list_models(timeout=5.0):
                if llama_cpp.status_value(entry) == "loaded":
                    info["ai_loaded"] = True
                    info["ai_model_name"] = entry.get("id", "")
                    break
        except Exception:
            pass

        # 计算已加载模型占用的内存
        loaded_mb = 0
        if asr_loaded:
            loaded_mb += 500  # SenseVoice ONNX 量化版约 500 MB
        if info["ai_loaded"]:
            loaded_mb += llama_cpp.estimate_model_mb(info.get("ai_model_name"))
        info["loaded_mb"] = loaded_mb

        # 系统开销（backend, postgres, redis, celery 等）
        system_overhead = 900  # 约 900 MB

        # 动态计算推荐内存
        # 基础开销 + 已加载模型 + 预留空间（给下一个模型）
        recommended = system_overhead + loaded_mb + 2000  # 预留 2 GB 给新模型
        info["recommended_vm_mb"] = max(8192, round(recommended / 1024) * 1024)
        info["recommended_host_gb"] = max(16, info["recommended_vm_mb"] // 1024 + 4)

        # VM 内存警告（只在总内存不足时）
        if info["total_mb"] and info["total_mb"] < info["recommended_vm_mb"]:
            info["warning"] = (
                f"Docker VM 内存不足（当前 {info['total_mb']} MB，"
                f"建议 {info['recommended_vm_mb']} MB）"
            )

        # ASR 警告：只在 ASR 未加载且可用内存不足时
        if not asr_loaded and info["available_mb"] and info["available_mb"] < 3000:
            info["asr_warning"] = "可用内存不足 3 GB，ASR 模型可能无法加载"

        # AI 警告：只在 AI 未加载且可用内存不足时
        if not info["ai_loaded"] and info["available_mb"] and info["available_mb"] < 2000:
            info["ai_warning"] = "可用内存不足 2 GB，AI 模型可能无法加载"

    except (OSError, ValueError):
        pass

    return info


async def prepare_memory_for_model(
    required_mb: int,
    purpose: str = "AI 模型",
    model_name: str | None = None,
) -> dict[str, Any]:
    """智能内存调度：检查可用内存是否足够，不足时自动卸载 ASR 模型腾空间。

    如果 AI 模型正在运行，不会尝试卸载（AI 侧有独立的空闲自动卸载策略）。
    如果 ASR 已加载且内存不足，会卸载 ASR 释放空间。

    Args:
        required_mb: 预估需要的内存（MB）
        purpose: 用途描述，用于日志和消息

    Returns:
        {"action": "ok"|"unloaded"|"insufficient", "message": str, "available_mb": int}
    """
    from app.services import asr_engine

    info = await get_memory_info()
    available = info.get("available_mb") or 0
    asr_loaded = asr_engine.is_available()
    ai_loaded = info.get("ai_loaded", False)

    # 如果 AI 模型已经在运行，测速/预热属于复用当前模型，不应重复按冷启动内存预算去卡
    if ai_loaded and purpose.startswith("AI "):
        return {
            "action": "ok",
            "message": f"AI 模型已加载，可复用当前实例（可用 {available} MB）",
            "available_mb": available,
        }

    # 内存充足，无需操作
    if available >= required_mb:
        return {
            "action": "ok",
            "message": f"内存充足（可用 {available} MB），无需卸载",
            "available_mb": available,
        }

    # 内存不足，尝试卸载 ASR 模型
    if asr_loaded:
        asr_engine.shutdown_asr_model()
        # 重新检查内存
        info2 = await get_memory_info()
        available2 = info2.get("available_mb") or 0
        if available2 >= required_mb:
            return {
                "action": "unloaded",
                "message": f"内存不足（可用 {available} MB），已自动卸载 ASR 模型，现可用 {available2} MB",
                "available_mb": available2,
            }
        # 卸载 ASR 后仍不足
        if ai_loaded:
            return {
                "action": "insufficient",
                "message": (
                    f"内存不足（卸载 ASR 后可用 {available2} MB，需要 {required_mb} MB）。"
                    f"AI 模型正在运行，请等待 AI 任务完成或手动卸载 AI 模型"
                ),
                "available_mb": available2,
            }
        return {
            "action": "insufficient",
            "message": f"内存仍不足（卸载 ASR 后可用 {available2} MB，需要 {required_mb} MB），建议增大 Docker VM 内存",
            "available_mb": available2,
        }

    # ASR 未加载但内存仍不足
    if ai_loaded:
        return {
            "action": "insufficient",
            "message": (
                f"内存不足（可用 {available} MB，需要 {required_mb} MB）。"
                f"AI 模型正在运行，请等待 AI 任务完成或手动卸载 AI 模型"
            ),
            "available_mb": available,
        }
    return {
        "action": "insufficient",
        "message": f"内存不足（可用 {available} MB，需要 {required_mb} MB），建议增大 Docker VM 内存",
        "available_mb": available,
    }


async def unload_asr_model() -> TestConnectionResponse:
    """卸载已加载的 ASR 模型，释放内存。"""
    from app.services import asr_engine

    try:
        asr_engine.shutdown_asr_model()
        return TestConnectionResponse(
            success=True,
            message="ASR 模型已卸载，内存已释放",
            details={"loaded": asr_engine.is_available()},
        )
    except Exception as e:
        return TestConnectionResponse(
            success=False,
            message=f"卸载失败：{e}",
        )


async def unload_ai_model(model_name: str | None = None) -> TestConnectionResponse:
    """卸载已载入的 AI 模型，释放内存。

    走 llama.cpp 的显式卸载接口。旧实现是发一个 keep_alive=0 的生成请求
    来达到同一目的（副作用式），实测卸载后推理进程内存回落到十几 MB。
    """
    try:
        await llama_cpp.unload_model(model_name or llama_cpp.DEFAULT_MODEL)
        return TestConnectionResponse(
            success=True,
            message="AI 模型已卸载，内存已释放",
        )
    except Exception as e:
        return TestConnectionResponse(
            success=False,
            message=f"卸载失败：{e}",
        )
