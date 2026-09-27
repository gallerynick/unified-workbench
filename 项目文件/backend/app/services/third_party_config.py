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
        "temperature": 0.1,
        "max_tokens": 4000,
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


async def get_third_party_config(db: AsyncSession) -> ThirdPartyConfig:
    """获取第三方服务配置"""
    ai_config = await _get_config_value(db, "ai_provider", DEFAULT_AI_CONFIG)
    asr_config = await _get_config_value(db, "asr_config", DEFAULT_ASR_CONFIG)

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
    if ai_config.mode == "local":
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
                                "temperature": ai_config.parameters.get("temperature", 0.7),
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

                    return TestConnectionResponse(
                        success=True,
                        message=f"测速完成：{tokens_per_second:.1f} tokens/s",
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
    """真的加载模型并跑一段音频，而不是只回一句「配置正常」。"""
    from app.services import asr_engine

    local = asr_config.local or {}
    try:
        asr_engine.init_asr_model(
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
        asr_engine.transcribe_audio_array(tone.tobytes())
    except Exception as e:
        return TestConnectionResponse(success=False, message=f"ASR 转录失败：{e}")

    return TestConnectionResponse(
        success=True,
        message="本地 ASR 服务可用（模型已加载，流水线跑通）",
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
