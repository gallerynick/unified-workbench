"""会议纪要生成器。

调用本地 AI 引擎（llama.cpp 的 OpenAI 兼容接口），从转录文本生成结构化会议纪要。
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any

import httpx

from app.services.llama_cpp import DEFAULT_MODEL as LOCAL_AI_MODEL, OPENAI_BASE_URL as LOCAL_AI_BASE_URL

logger = logging.getLogger(__name__)

DEFAULT_MODEL = LOCAL_AI_MODEL

MINUTES_SYSTEM_PROMPT = """你是一个专业的会议纪要助手。你的任务是根据会议转录内容，
生成结构化的会议纪要。

你必须严格按照以下 JSON 格式输出，不要添加任何额外内容：

{
  "summary": "会议总结（200-500字，概括会议目的、主要讨论内容和结论）",
  "key_points": [
    "要点1：关键决策或重要信息",
    "要点2：关键决策或重要信息"
  ],
  "todos": [
    {
      "content": "待办事项描述",
      "source_quote": "会议中对应的原文引用"
    }
  ]
}

规则：
1. summary 必须涵盖：会议主题、参与讨论的核心话题、达成的结论
2. key_points 列出 3-10 个最重要的决策和信息，每条不超过 100 字
3. todos 列出所有明确的待办事项，必须附带原文引用
4. 如果会议中没有明确的待办事项，todos 返回空数组 []
5. 如果会议内容过短或无实质内容，summary 说明"本次会议内容较少，无实质性讨论"
6. 所有文字使用简体中文
7. 不要编造会议中没有的内容
8. 严格输出 JSON，不要包含 markdown 代码块标记
"""


def _fallback_minutes(segments: list[dict[str, str]]) -> dict[str, Any]:
    """LLM 不可用时的降级方案。"""
    all_text = " ".join(seg.get("text", "") for seg in segments)

    summary = (
        f"本次会议共记录 {len(segments)} 条转录内容，总计约 {len(all_text)} 字。"
        "由于 AI 服务暂不可用，以下为基于转录内容的概要。"
    )

    key_points = []
    todos = []

    decision_keywords = ["决定", "确认", "同意", "结论", "最终"]
    for seg in segments:
        text = seg.get("text", "")
        for kw in decision_keywords:
            if kw in text:
                key_points.append(text[:100])
                break

    todo_keywords = ["需要", "负责", "完成", "跟进", "待办", "任务", "下周", "明天"]
    for seg in segments:
        text = seg.get("text", "")
        for kw in todo_keywords:
            if kw in text:
                todos.append({
                    "content": text[:100],
                    "source_quote": text[:200],
                })
                break

    if not key_points:
        key_points.append("本次会议内容较少，未提取到关键决策")

    return {
        "summary": summary,
        "key_points": key_points,
        "todos": todos[:20],
    }


def _validate_minutes(minutes: dict[str, Any]) -> dict[str, Any]:
    """校验并规范化纪要结构。"""
    result = {
        "summary": "",
        "key_points": [],
        "todos": [],
    }

    summary = minutes.get("summary", "")
    if isinstance(summary, str) and summary.strip():
        result["summary"] = summary.strip()
    else:
        result["summary"] = "会议纪要生成异常，请稍后重试"

    key_points = minutes.get("key_points", [])
    if isinstance(key_points, list):
        result["key_points"] = [
            str(kp).strip() for kp in key_points if isinstance(kp, str) and kp.strip()
        ][:20]

    todos = minutes.get("todos", [])
    if isinstance(todos, list):
        for todo in todos[:20]:
            if isinstance(todo, dict):
                content = todo.get("content", "")
                quote = todo.get("source_quote", "")
                if content and isinstance(content, str):
                    result["todos"].append({
                        "content": content.strip(),
                        "source_quote": str(quote).strip() if quote else "",
                    })

    return result


def _extract_json(text: str) -> dict[str, Any] | None:
    """从 LLM 输出中提取 JSON 对象。"""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    code_block_match = re.search(r'```(?:json)?\s*(.*?)\s*```', text)
    if code_block_match:
        try:
            return json.loads(code_block_match.group(1).strip())
        except json.JSONDecodeError:
            pass

    brace_start = text.find("{")
    brace_end = text.rfind("}")
    if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
        try:
            return json.loads(text[brace_start : brace_end + 1])
        except json.JSONDecodeError:
            pass

    return None


async def generate_minutes(
    segments: list[dict[str, str]],
    model_name: str | None = None,
    max_retries: int = 3,
) -> tuple[dict[str, Any], str]:
    """生成会议纪要。"""
    # 走 Docker 网络别名直连 llama.cpp 容器；localhost 会指向 backend 容器自身而连接失败
    model = model_name or DEFAULT_MODEL

    transcript_text = "\n".join(
        f"[{seg.get('start_ms', 0) / 1000:.1f}s] {seg.get('text', '')}"
        for seg in segments
    )

    if not transcript_text.strip():
        return {
            "summary": "本次会议无转录内容",
            "key_points": [],
            "todos": [],
        }, model

    prompt = (
        MINUTES_SYSTEM_PROMPT
        + "\n\n以下是会议转录内容：\n\n"
        + transcript_text
        + "\n\n请生成会议纪要："
    )

    last_error: Exception | None = None
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{LOCAL_AI_BASE_URL}/chat/completions",
                    json={
                        "model": model,
                        "messages": [
                            {"role": "user", "content": prompt},
                        ],
                        "stream": False,
                        "temperature": 0.3,
                        "top_p": 0.9,
                    },
                )
                response.raise_for_status()
                data = response.json()

                response_text = data["choices"][0]["message"]["content"]
                if not response_text:
                    raise ValueError("LLM returned empty response")

                minutes = _extract_json(response_text)
                if minutes is None:
                    raise ValueError(f"Failed to parse JSON: {response_text[:200]}")

                validated = _validate_minutes(minutes)
                return validated, model

        except Exception as e:
            last_error = e
            logger.warning(f"Minutes attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2)

    logger.error(f"All retries failed, using fallback. Last error: {last_error}")
    fallback = _fallback_minutes(segments)
    return fallback, f"{model} (fallback)"


def generate_minutes_sync(
    segments: list[dict[str, str]],
    model_name: str | None = None,
) -> tuple[dict[str, Any], str]:
    """同步版本（供 Celery 任务使用）。"""
    return asyncio.run(generate_minutes(segments, model_name))
