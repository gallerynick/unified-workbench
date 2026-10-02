"""第三方服务配置 Pydantic 模型"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class WarmupConfig(BaseModel):
    """模型自热备配置"""

    ai: bool = False
    asr: bool = False


class AIProviderConfig(BaseModel):
    """AI 提供商配置"""

    mode: Literal["local", "online"] = "local"
    local: dict[str, Any] = {}
    online: dict[str, Any] = {}
    parameters: dict[str, Any] = {
        "temperature": 0.1,
        "max_tokens": 4000,
        "response_format": "json",
    }


class ASRConfig(BaseModel):
    """语音识别配置"""

    mode: Literal["local", "online"] = "local"
    local: dict[str, Any] = {}
    online: dict[str, Any] = {}
    parameters: dict[str, Any] = {
        "sample_rate": 16000,
        "hpf_cutoff": 80,
        "noise_reduction": 0.8,
        "vad_threshold": 0.006,
        "silence_timeout": 1.5,
        "allowed_languages": ["zh"],
    }


class ThirdPartyConfig(BaseModel):
    """第三方服务配置"""

    ai_provider: AIProviderConfig
    asr_config: ASRConfig
    warmup: WarmupConfig = Field(default_factory=WarmupConfig)


class ThirdPartyConfigUpdate(BaseModel):
    """更新第三方服务配置请求"""

    ai_provider: AIProviderConfig | None = None
    asr_config: ASRConfig | None = None
    warmup: WarmupConfig | None = None


class TestConnectionResponse(BaseModel):
    """测试连接响应"""

    success: bool
    message: str
    details: dict[str, Any] | None = None
