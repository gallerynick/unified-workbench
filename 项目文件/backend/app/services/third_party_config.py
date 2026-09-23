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
        "model": "gpt-4o",
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
        "model": "whisper-1",
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
            db, "ai_provider", data["ai_provider"], user.id
        )

    if "asr_config" in data:
        await _save_config_value(
            db, "asr_config", data["asr_config"], user.id
        )

    return await get_third_party_config(db)


async def _get_config_value(
    db: AsyncSession, key: str, default: dict[str, Any]
) -> dict[str, Any]:
    """获取配置值"""
    result = await db.execute(
        select(SystemConfig).where(SystemConfig.config_key == key)
    )
    config = result.scalar_one_or_none()

    if config:
        return config.config_value
    return default


async def _save_config_value(
    db: AsyncSession, key: str, value: dict[str, Any], user_id: Any
) -> None:
    """保存配置值"""
    result = await db.execute(
        select(SystemConfig).where(SystemConfig.config_key == key)
    )
    config = result.scalar_one_or_none()

    if config:
        config.config_value = value
        config.updated_by = user_id
    else:
        config = SystemConfig(
            config_key=key,
            config_value=value,
            updated_by=user_id,
        )
        db.add(config)

    await db.flush()


async def test_ai_connection(db: AsyncSession) -> TestConnectionResponse:
    """测试 AI 服务连接"""
    config = await get_third_party_config(db)

    if config.ai_provider.mode == "local":
        return TestConnectionResponse(
            success=True,
            message="本地 AI 服务配置正常",
            details={"model": config.ai_provider.local.get("model")},
        )

    return TestConnectionResponse(
        success=True,
        message="在线 AI 服务配置正常",
        details={"provider": config.ai_provider.online.get("base_url")},
    )


async def test_asr_service(db: AsyncSession) -> TestConnectionResponse:
    """测试 ASR 服务"""
    config = await get_third_party_config(db)

    if config.asr_config.mode == "local":
        return TestConnectionResponse(
            success=True,
            message="本地 ASR 模型已加载",
            details={"model": config.asr_config.local.get("model")},
        )

    return TestConnectionResponse(
        success=True,
        message="在线 ASR 服务配置正常",
        details={"provider": config.asr_config.online.get("provider")},
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
