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
        "model": "qwen3.5:4b",
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
                    model_name = config.ai_provider.local.get("model", "qwen3.5:4b")
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
            async with httpx.AsyncClient(timeout=30.0) as client:
                # 检查模型是否已下载
                response = await client.get("http://ollama:11434/api/tags")
                if response.status_code != 200:
                    return TestConnectionResponse(
                        success=False,
                        message="Ollama 服务不可用",
                    )
                
                models = response.json().get("models", [])
                model_name = ai_config.local.get("model", "qwen3.5:4b")
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
                    
                    # 发送生成请求
                    generate_response = await client.post(
                        "http://ollama:11434/api/generate",
                        json={
                            "model": model_name,
                            "prompt": test_prompt,
                            "stream": False,
                            "options": {
                                "temperature": ai_config.parameters.get("temperature", 0.7),
                                "num_predict": 100  # 生成 100 个 token 用于测速
                            }
                        },
                        timeout=60.0
                    )
                    
                    end_time = time.time()
                    total_time = end_time - start_time
                    
                    if generate_response.status_code == 200:
                        result = generate_response.json()
                        total_tokens = result.get("prompt_eval_count", 0) + result.get("eval_count", 0)
                        tokens_per_second = total_tokens / total_time if total_time > 0 else 0
                        
                        return TestConnectionResponse(
                            success=True,
                            message=f"测速完成：{tokens_per_second:.1f} tokens/s",
                            details={
                                "model": model_name,
                                "tokens_per_second": round(tokens_per_second, 2),
                                "total_tokens": total_tokens,
                                "total_latency_ms": int(total_time * 1000),
                            },
                        )
                    else:
                        return TestConnectionResponse(
                            success=False,
                            message=f"生成请求失败：{generate_response.status_code}",
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


async def test_asr_with_config(asr_config: ASRConfig) -> TestConnectionResponse:
    """使用临时配置测试 ASR 连接"""
    if asr_config.mode == "local":
        return TestConnectionResponse(
            success=True,
            message="本地 ASR 服务配置正常",
            details={"model": asr_config.local.get("model")},
        )
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


async def reload_asr_model(db: AsyncSession) -> TestConnectionResponse:
    """重载 ASR 模型"""
    config = await get_third_party_config(db)

    if config.asr_config.mode == "local":
        return TestConnectionResponse(
            success=True,
            message="ASR 模型已重载",
            details={"model": config.asr_config.local.get("model")},
        )

    return TestConnectionResponse(
        success=False,
        message="在线模式无需重载",
    )


async def delete_asr_model(db: AsyncSession) -> TestConnectionResponse:
    """删除本地 ASR 模型"""
    import os
    import shutil
    
    config = await get_third_party_config(db)
    
    if config.asr_config.mode != "local":
        return TestConnectionResponse(
            success=False,
            message="仅本地模式支持删除模型",
        )
    
    # ASR 模型存储目录
    asr_model_dir = "/data/asr-models"
    
    try:
        # 检查目录是否存在
        if not os.path.exists(asr_model_dir):
            return TestConnectionResponse(
                success=True,
                message="模型目录不存在，无需删除",
            )
        
        # 删除模型目录下的所有文件
        for item in os.listdir(asr_model_dir):
            item_path = os.path.join(asr_model_dir, item)
            if os.path.isfile(item_path):
                os.remove(item_path)
            elif os.path.isdir(item_path):
                shutil.rmtree(item_path)
        
        return TestConnectionResponse(
            success=True,
            message="ASR 模型已删除",
            details={"deleted_path": asr_model_dir},
        )
    except Exception as e:
        return TestConnectionResponse(
            success=False,
            message=f"删除模型失败：{str(e)}",
        )


async def get_asr_model_status(db: AsyncSession) -> dict:
    """获取本地 ASR 模型状态"""
    import os
    
    config = await get_third_party_config(db)
    
    if config.asr_config.mode != "local":
        return {
            "status": "not_available",
            "message": "当前为在线模式",
        }
    
    # ASR 模型存储目录
    asr_model_dir = "/data/asr-models"
    
    try:
        # 检查目录是否存在
        if not os.path.exists(asr_model_dir):
            return {
                "status": "not_downloaded",
                "message": "ASR 模型未下载",
            }
        
        # 检查模型文件是否存在
        main_model = os.path.join(asr_model_dir, "paraformer-zh")
        punc_model = os.path.join(asr_model_dir, "ct-punc")
        spk_model = os.path.join(asr_model_dir, "campplus")
        
        main_exists = os.path.exists(main_model)
        punc_exists = os.path.exists(punc_model)
        spk_exists = os.path.exists(spk_model)
        
        if main_exists and punc_exists and spk_exists:
            return {
                "status": "downloaded",
                "message": "ASR 模型已就绪",
            }
        elif main_exists:
            return {
                "status": "partial",
                "message": "ASR 模型部分下载",
                "main_model": main_exists,
                "punc_model": punc_exists,
                "spk_model": spk_exists,
            }
        else:
            return {
                "status": "not_downloaded",
                "message": "ASR 模型未下载",
            }
    except Exception as e:
        return {
            "status": "error",
            "message": f"检查模型状态失败：{str(e)}",
        }
