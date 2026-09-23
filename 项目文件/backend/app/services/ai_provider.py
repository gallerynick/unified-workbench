"""AI 提供商客户端 - OpenAI 兼容接口"""

from __future__ import annotations

import json
import uuid
from typing import Any

import httpx

from app.schemas.third_party_config import AIProviderConfig

MINUTES_PROMPT = """请根据以下会议转录内容生成会议纪要，以 JSON 格式输出。

要求：
1. summary: 会议总结（200字以内）
2. key_points: 关键要点列表（5-8条）
3. todos: 待办事项列表，每项包含 content 和 source_quote

转录内容：
{transcript}

请输出 JSON：
"""


async def generate_minutes(transcript: str, meeting_id: uuid.UUID) -> dict[str, Any]:
    """生成会议纪要"""
    from app.services.third_party_config import get_third_party_config
    
    # 获取配置
    db = None  # 简化，实际应该从数据库获取配置
    config = {
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
    
    return await _call_ai(config, transcript)


async def _call_ai(config: dict[str, Any], transcript: str) -> dict[str, Any]:
    """调用 AI 服务"""
    mode = config.get("mode", "local")
    
    if mode == "local":
        base_url = config["local"].get("base_url", "http://ollama:11434/v1")
        model = config["local"].get("model", "qwen3.5:4b")
        api_key = None
    else:
        base_url = config["online"].get("base_url", "https://api.openai.com/v1")
        model = config["online"].get("model", "gpt-4o")
        api_key = config["online"].get("api_key")
    
    parameters = config.get("parameters", {})
    
    # 构建请求
    headers = {
        "Content-Type": "application/json",
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    
    prompt = MINUTES_PROMPT.format(transcript=transcript)
    
    payload = {
        "model": model,
        "messages": [
            {"role": "user", "content": prompt},
        ],
        "temperature": parameters.get("temperature", 0.1),
        "max_tokens": parameters.get("max_tokens", 4000),
    }
    
    if parameters.get("response_format") == "json":
        payload["response_format"] = {"type": "json_object"}
    
    # 发送请求
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        result = response.json()
    
    # 解析响应
    content = result["choices"][0]["message"]["content"]
    
    try:
        minutes = json.loads(content)
        minutes["model_used"] = model
        return minutes
    except json.JSONDecodeError:
        # 如果解析失败，返回默认格式
        return {
            "summary": content[:200] if len(content) > 200 else content,
            "key_points": [],
            "todos": [],
            "model_used": model,
        }
