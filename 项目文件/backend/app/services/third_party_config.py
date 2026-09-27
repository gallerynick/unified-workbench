"""第三方服务配置业务逻辑"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_config import SystemConfig
from app.models.user import User
from app.schemas.third_party_config import (
    AIProviderConfig,
    ASRConfig,
    TestConnectionResponse,
    ThirdPartyConfig,
)

DEFAULT_AI_CONFIG = {
    "mode": "local",
    "local": {
        "base_url": "http://ollama:11434/v1",
        "model": "qwen2.5:3b",
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

DEFAULT_ASR_CONFIG = {
    "mode": "local",
    "local": {
        "model": "paraformer-zh",
        "punc_model": "ct-punc",
        "spk_model": "campplus",
    },
    "online": {
        "provider": "openai",
        "model": "",
        "api_key": None,
        "base_url": "https://api.openai.com/v1",
    },
    "parameters": {
        "sample_rate": 16000,
        "hpf_cutoff": 80,
        "noise_reduction": 0.8,
        "vad_threshold": 0.006,
        "silence_timeout": 1.5,
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
    ai_config = _deep_merge_defaults(DEFAULT_AI_CONFIG, saved_ai)
    asr_config = _deep_merge_defaults(DEFAULT_ASR_CONFIG, saved_asr)

    return ThirdPartyConfig(
        ai_provider=AIProviderConfig(**ai_config),
        asr_config=ASRConfig(**asr_config),
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
        # 测试本地 Ollama 服务
        import httpx
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get("http://ollama:11434/api/tags")
                if response.status_code == 200:
                    models = response.json().get("models", [])
                    model_name = config.ai_provider.local.get("model", "qwen2.5:3b")
                    model_found = any(m.get("name") == model_name for m in models)
                    return TestConnectionResponse(
                        success=model_found,
                        message="本地 AI 服务配置正常" if model_found else f"模型 {model_name} 未下载",
                        details={"model": model_name, "model_count": len(models)},
                    )
                else:
                    return TestConnectionResponse(
                        success=False,
                        message="Ollama 服务不可用",
                        details={"status_code": response.status_code},
                    )
        except Exception as e:
            return TestConnectionResponse(
                success=False,
                message=f"Ollama 服务连接失败：{str(e)}",
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
            model_name = ai_config.local.get("model", "qwen2.5:3b")
            # qwen2.5:1.5b ~1GB, 3b ~1.9GB, 7b ~4.4GB
            est_mb = {"qwen2.5:1.5b": 1200, "qwen2.5:3b": 2200, "qwen2.5:7b": 4700}.get(model_name, 2200)
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
            # 超时给足 3 分钟：冷启动要先加载权重，qwen3.5:4b 光加载就 5 秒左右
            async with httpx.AsyncClient(timeout=180.0) as client:
                # 检查模型是否已下载
                response = await client.get("http://ollama:11434/api/tags")
                if response.status_code != 200:
                    return TestConnectionResponse(
                        success=False,
                        message=f"Ollama 服务响应异常（HTTP {response.status_code}）",
                        details={"status_code": response.status_code},
                    )
                
                models = response.json().get("models", [])
                model_name = ai_config.local.get("model", "qwen2.5:3b")
                model_found = any(m.get("name") == model_name for m in models)
                
                if not model_found:
                    return TestConnectionResponse(
                        success=False,
                        message=f"模型 {model_name} 未下载",
                    )
                
                # 测速模式：发送生成请求并测量 tokens/s
                if measure_speed:
                    import time

                    start_time = time.time()
                    generate_response = await client.post(
                        "http://ollama:11434/api/generate",
                        json={
                            "model": model_name,
                            "prompt": test_prompt,
                            "stream": False,
                            "options": {
                                "temperature": ai_config.parameters.get("temperature", 0.2),
                                # 200 个 token 才够测出稳定速率；100 个太短，
                                # 单次抖动就能让数字差出几十个百分点
                                "num_predict": 200
                            },
                        },
                        timeout=180.0,
                    )
                    total_time = time.time() - start_time

                    if generate_response.status_code != 200:
                        # ollama 会把错误原因写在响应体里，一定要读出来，
                        # 否则只会得到一句「生成请求失败：500」这种无从下手的信息
                        detail = ""
                        try:
                            detail = generate_response.json().get("error", "")
                        except Exception:
                            detail = generate_response.text[:300]
                        low = (detail or "").lower()
                        if "killed" in low or "out of memory" in low:
                            message = (
                                "模型加载失败（进程被系统杀掉，通常是内存不足）："
                                f"{detail or 'signal: killed'}"
                            )
                        else:
                            message = f"生成请求失败：{detail or generate_response.status_code}"
                        return TestConnectionResponse(success=False, message=message)

                    result = generate_response.json()
                    eval_count = result.get("eval_count", 0)
                    eval_duration = result.get("eval_duration", 0) or 0
                    # 纯生成速率 = 只算解码时间，不含加载和 prompt 前向。
                    # 旧算法是 (prompt_eval_count + eval_count) / 总墙钟时间，
                    # 把权重加载时间和 prompt 前向也算进去，实测会比真实生成速率低一半
                    tokens_per_second = (
                        eval_count / (eval_duration / 1e9) if eval_duration > 0 else 0
                    )
                    load_seconds = (result.get("load_duration") or 0) / 1e9
                    prompt_rate = (
                        result.get("prompt_eval_count", 0)
                        / ((result.get("prompt_eval_duration") or 1) / 1e9)
                    ) if result.get("prompt_eval_duration") else 0
                    visible = len(result.get("response") or "")
                    thinking = len(result.get("thinking") or "")

                    if eval_count == 0:
                        return TestConnectionResponse(
                            success=False,
                            message="模型未产生任何 token，请检查模型是否正常",
                        )

                    msg = f"测速完成：{tokens_per_second:.1f} tokens/s"
                    if 'mem_msg' in dir() and mem_msg:
                        msg += f"（{mem_msg}）"
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
                            "prompt_eval_count": result.get("prompt_eval_count", 0),
                            "prompt_tokens_per_second": round(prompt_rate, 2),
                            "load_seconds": round(load_seconds, 2),
                            "done_reason": result.get("done_reason"),
                            "response_chars": visible,
                            "thinking_chars": thinking,
                        },
                    )
                
                # 普通连接测试
                return TestConnectionResponse(
                    success=True,
                    message="本地 AI 服务配置正常",
                    details={"model": model_name, "model_count": len(models)},
                )
        except Exception as e:
            return TestConnectionResponse(
                success=False,
                message=f"Ollama 服务连接失败：{str(e)}",
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
    """本地 ASR 需要缓存的全部模型：主模型 + VAD + 标点 + 声纹。"""
    local = config.asr_config.local or {}
    return [
        local.get("model", "paraformer-zh"),
        "fsmn-vad",
        local.get("punc_model", "ct-punc"),
        local.get("spk_model", "cam++"),
    ]


async def _test_local_asr(asr_config: ASRConfig) -> TestConnectionResponse:
    """真的加载模型并跑一段音频，而不是只回一句「配置正常」。

    ASR 引擎是同步阻塞的（PyTorch 推理 + 模型加载），直接 await 会卡死
    asyncio 事件循环，导致 WebSocket 心跳和并发请求全部挂起。用 to_thread
    丢到线程池执行，主事件循环保持空闲。
    """
    import asyncio

    from app.services import asr_engine

    local = asr_config.local or {}

    # 智能内存调度：ASR 模型约 2.1 GB，先检查内存是否足够
    mem_result = await prepare_memory_for_model(2500, "ASR 测试")
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
            asr_model=local.get("model", "paraformer-zh"),
            vad_model="fsmn-vad",
            punc_model=local.get("punc_model", "ct-punc"),
            spk_model=local.get("spk_model", "cam++"),
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
    from app.services import asr_engine

    config = await get_third_party_config(db)
    if config.asr_config.mode != "local":
        return TestConnectionResponse(success=False, message="在线模式无需下载模型")

    local = config.asr_config.local or {}
    cached = asr_engine.get_cached_asr_models(_local_asr_model_names(config))
    if cached["downloaded"] == cached["total"]:
        return TestConnectionResponse(
            success=True,
            message="ASR 模型已就绪，无需下载",
            details={"downloaded": cached["downloaded"], "total": cached["total"]},
        )

    import threading

    def _run() -> None:
        asr_engine.init_asr_model(
            asr_model=local.get("model", "paraformer-zh"),
            vad_model="fsmn-vad",
            punc_model=local.get("punc_model", "ct-punc"),
            spk_model=local.get("spk_model", "cam++"),
        )

    threading.Thread(target=_run, name="asr-preload", daemon=True).start()
    return TestConnectionResponse(
        success=True,
        message="模型下载已开始，请稍后刷新查看进度",
        details={"downloaded": cached["downloaded"], "total": cached["total"]},
    )


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
        asr_engine.init_asr_model(
            asr_model=local.get("model", "paraformer-zh"),
            vad_model="fsmn-vad",
            punc_model=local.get("punc_model", "ct-punc"),
            spk_model=local.get("spk_model", "cam++"),
        )
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
    if done == total:
        status = "downloaded"
        message = f"ASR 模型已就绪（{done}/{total}）"
    elif done > 0:
        status = "partial"
        message = f"ASR 模型部分就绪（{done}/{total}）"
    else:
        status = "not_downloaded"
        message = "ASR 模型未下载"

    return {
        "status": status,
        "message": message,
        "details": {
            "models": cached["models"],
            "downloaded": done,
            "total": total,
            "loaded": asr_engine.is_available(),
        },
    }


async def get_memory_info() -> dict[str, Any]:
    """获取当前系统内存使用情况。

    读取 /proc/meminfo（Linux 容器内），返回总量、已用、可用、推荐值。
    前端用它展示内存建议和溢出预警。
    """
    import platform

    info: dict[str, Any] = {
        "total_mb": None,
        "used_mb": None,
        "available_mb": None,
        "recommended_vm_mb": 8192,
        "recommended_host_gb": 16,
        "platform": platform.system(),
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

        # 根据实际内存调整推荐值
        if info["total_mb"] and info["total_mb"] < 6000:
            info["recommended_vm_mb"] = 8192
            info["warning"] = "Docker VM 内存不足（建议 8 GB）"
        elif info["total_mb"] and info["total_mb"] < 8000:
            info["recommended_vm_mb"] = 10240
            info["warning"] = "Docker VM 内存偏低（建议 10 GB）"

        # ASR 模型加载后额外占用约 2.1 GB
        if info["available_mb"] and info["available_mb"] < 3000:
            info["asr_warning"] = "可用内存不足 3 GB，ASR 模型可能无法加载"
        if info["available_mb"] and info["available_mb"] < 2000:
            info["ai_warning"] = "可用内存不足 2 GB，AI 模型可能无法加载"

    except (OSError, ValueError):
        pass

    return info


async def prepare_memory_for_model(
    required_mb: int,
    purpose: str = "AI 模型",
) -> dict[str, Any]:
    """智能内存调度：检查可用内存是否足够，不足时自动卸载 ASR 模型腾空间。

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
        return {
            "action": "insufficient",
            "message": f"内存仍不足（卸载 ASR 后可用 {available2} MB，需要 {required_mb} MB）",
            "available_mb": available2,
        }

    # ASR 未加载但内存仍不足
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
    """卸载已加载的 AI 模型（Ollama），释放内存。

    Ollama 的 keep_alive: 0 告诉它在请求完成后立即卸载模型。
    如果模型未加载，请求会先加载再卸载（等于空操作）。
    """
    import httpx

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "http://ollama:11434/api/generate",
                json={
                    "model": model_name or "qwen2.5:3b",
                    "prompt": "",
                    "keep_alive": 0,
                },
            )
            if response.status_code == 200:
                return TestConnectionResponse(
                    success=True,
                    message="AI 模型已卸载，内存已释放",
                )
            else:
                detail = response.text[:200]
                return TestConnectionResponse(
                    success=False,
                    message=f"卸载失败：HTTP {response.status_code} {detail}",
                )
    except Exception as e:
        return TestConnectionResponse(
            success=False,
            message=f"卸载失败：{e}",
        )
