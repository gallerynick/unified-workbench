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

# prompt 版本号：每次修改提示词必须递增，便于对照评估与回归
PROMPT_VERSION = "v5"

# 无实质内容的句子：纯标点 / 单个字符 / 语气词填充。命中即视为噪声，不进 prompt。
# 说明：短会议只要有 1 句可读内容就必须如实概括，决不能退回模板文案。
_NOISE_FILLERS = {
    "嗯", "呃", "啊", "哦", "噢", "诶", "哎", "哈", "嗯嗯", "呃呃",
    "对对", "对对对", "是是", "是的", "好", "好的", "好吧", "行", "行吧",
    "yeah", "yes", "ok", "okay", "hmm", "emm", "um", "ah", "oh",
}

_STRIP_CHARS = " 	\n\r。．.！!？?，,；;：:\"'“”‘’（）()【】[]「」『』—…、"


def _is_substantive(text: str) -> bool:
    """判断一段转录文本是否有可读内容。

    无实质：空、纯标点、单个字符、纯语气词填充。
    有实质：至少含一个中文/英文有效词（长度 >= 2 的有效字符，
    且不是纯语气词）。宁多勿少——只有认定全部无实质时才走兜底。
    """
    if not text:
        return False
    stripped = text.strip(_STRIP_CHARS).strip().lower()
    if not stripped:
        return False
    if len(stripped) < 2:
        return False
    return stripped not in _NOISE_FILLERS


MINUTES_SYSTEM_PROMPT = """你是一个专业的会议纪要助手。你的任务是根据会议转录内容，
生成结构化的会议纪要。

你必须严格按照以下 JSON 格式输出，不要添加任何额外内容、不要输出 markdown 代码块：

{
  "summary": "会议总结（300-500字，概括会议目的、主要讨论内容和结论）",
  "key_points": [
    "要点1：关键决策或重要信息",
    "要点2：关键决策或重要信息"
  ],
  "todos": [
    {
      "content": "待办事项描述",
      "source_quote": "待办对应的原文句子（必须逐字来自转录原文）"
    }
  ]
}

规则：
1. summary 必须如实、充分地概括转录中实际讨论的内容（讨论了什么、涉及哪些方面、
   有代表性的观点、逐步推进的过程、结论或倾向）。【重要】会议标题只是这场会议的
   名字/标识，绝不等于会议主题；严禁写出"本次会议主题为{标题}"之类表述。会议主题
   必须从转录内容本身提炼，转录里没说的话不要当成主题。宁可多写讨论到的点，
   也不要因为内容零散就草率断言"未形成其他明确结论"。
2. key_points 列出转录中出现的所有重要信息与讨论点（3-12 条；宁可多列，不要漏），
   每条不超过 100 字，优先采用原文关键句或紧贴原文的表达。
3. todos 只提取明确的待办（有执行的意图、负责人或时间要求），每条必须附 source_quote，
   且 source_quote 必须逐字抄自转录原文；找不到对应原文就不写这条待办
4. 如果会议中没有明确的待办事项，todos 返回空数组 []
5. 会议内容少但不是没有：只要转录中存在可读内容（哪怕只有一句），
   summary 就必须如实概括这次会议的事实，禁止使用"本次会议内容较少，无实质性讨论"
   之类模板文案；内容少时 summary 可简短（20-50字），重点写清楚会议实际说了什么。
6. 所有文字使用简体中文
7. 不要编造会议中没有的内容，不要改写原文语义，不要补充外部知识
8. 时间表达（如"下周三""月底""11月5号"）只照抄原文说法，不要自行推算具体日期
9. 参与人信息仅用于辅助理解发言归属，不要凭空添加未出现的人员
10. 严格输出 JSON，不要包含 markdown 代码块标记，不要在 JSON 前后输出任何其他文字

示例（仅作输出格式参考，不要照抄内容）：
转录：[0.0s] 说话人1: 我们确定下周启动新版本上线，负责人是张三。
输出：{"summary":"会议确定下周启动新版本上线，并指定张三负责推进。","key_points":["决定下周启动新版本上线"],"todos":[{"content":"张三负责推进新版本上线排期","source_quote":"我们确定下周启动新版本上线，负责人是张三"}]}

示例（标题≠主题，内容要尽量展开）：
会议标题：wdwd
转录：[0.0s] 说话人1: 我们测一下功能。大家提议做一个汽车 App 来管理车位。
[0.2s] 说话人2: 另外提到高考志愿填报系统也可以做。
输出：{"summary":"会议中讨论了多个创业方向：一是做一个管理小区车位的信息化 App，方便业主实时查看空余车位、规划路线；二是提到高考志愿填报信息系统。会议还以测试功能和方案讨论为主推进。","key_points":["讨论小区车位信息化管理 App 的方向","提到高考志愿填报信息系统的可行性"],"todos":[]}
"""


# ── 长会议分块总结（map-reduce）──────────────────────────────────────────
# 背景：llama.cpp ctx 仅 8192 token，长会议转录（如 2 小时 8000+ 字，含行前缀
# 可能 1 万+ token）会被截断，模型只能看到部分内容 → 总结极短。
# 策略：超过 _CHUNK_THRESHOLD_CHARS 时按时间顺序切成若干块，每块单独提炼
# 要点，最后把所有块的要点汇总成整场纪要。短会议仍走原有单次调用（零回归）。
_CHUNK_THRESHOLD_CHARS = 2800
_CHUNK_CHARS = 2200

CHUNK_MAP_PROMPT = """你是一个会议纪要助手。下面是一段会议转录（整场会议的其中一部分），
请提炼这段内容的概要要点。

严格按以下 JSON 输出，不要输出任何其他内容：
{
  "summary": "这一段讨论的内容概要（100-200字，说清讨论了什么、涉及哪些方面）",
  "key_points": ["要点1", "要点2"]
}

规则：
1. 只根据这段转录内容，不编造没有的内容
2. key_points 列出这段里所有重要的决策、信息、讨论点（2-6 条，每条不超过 100 字）
3. 使用简体中文，严格输出 JSON，不要包含 markdown 代码块标记
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


def _strip_thinking(text: str) -> str:
    """剥离 Qwen3 混合思考模型的思考块（防御性，Qwen2.x 无思考块不受影响）。

    Qwen3 默认把思考内容放在英文双引号包裹的块里（如 "让我先想想..."），
    回答在闭合引号之后。不剥离的话，思考块里若含 JSON 示例会被 _extract_json
    的「找花括号」误当成纪要 JSON，导致思考/回答搞混。
    """
    if text.startswith('"'):
        idx = text.rfind('"')
        if 0 < idx < len(text) - 1:
            rest = text[idx + 1 :].lstrip("\n\r ")
            if rest:
                return rest
    return text


def _extract_json(text: str) -> dict[str, Any] | None:
    """从 LLM 输出中提取 JSON 对象。"""
    text = _strip_thinking(text)
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


def _format_transcript_line(seg: dict[str, Any]) -> str:
    """把一条转录段格式化为 prompt 行。

    带说话人时形如 "[12.3s] 说话人1: 文本"，为归属判断提供锚点；
    无说话人时保持 v2 原有格式 "[12.3s] 文本"，保证向后兼容。
    """
    timestamp = "[" + str(round((seg.get("start_ms", 0) or 0) / 1000.0, 1)) + "s]"
    text = str(seg.get("text", "")).strip()
    speaker = str(seg.get("speaker") or "").strip()
    if not text:
        return ""
    if speaker:
        return timestamp + " " + speaker + ": " + text
    return timestamp + " " + text


def _build_meta_context(meeting_meta: dict[str, Any] | None) -> str:
    """把会议元信息拼成 prompt 上下文。

    元信息是日期解析锚点与参与人白名单，缺了会漏，多了会干扰；
    - 会议标题 / 日期 / 参与人：有则必填，无则跳过
    - 会议笔记：可选项，截断到 200 字
    """
    if not meeting_meta:
        return ""
    parts: list[str] = []
    title = (meeting_meta.get("title") or "").strip()
    if title:
        parts.append(f"会议标题：{title}")
    date = (meeting_meta.get("date") or "").strip()
    if date:
        parts.append(f"会议日期：{date}")
    participants = meeting_meta.get("participants") or []
    participants = [str(p).strip() for p in participants if str(p).strip()]
    if participants:
        parts.append("参与人：" + "、".join(participants))
    notes = (meeting_meta.get("notes") or "").strip()
    if notes:
        parts.append("会议笔记：" + notes[:200])
    return "\n".join(parts)


async def generate_minutes(
    segments: list[dict[str, str]],
    model_name: str | None = None,
    max_retries: int = 3,
    meeting_meta: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], str]:
    """生成会议纪要。

    调用方若要产出带会议上下文的纪要，需传入 meeting_meta：
    {"title": str, "date": "YYYY-MM-DD", "participants": [str], "notes": str}
    输出 schema 与 v1 完全一致（summary/key_points/todos），不破坏既有调用方。
    """
    # 走 Docker 网络别名直连 llama.cpp 容器；localhost 会指向 backend 容器自身而连接失败
    model = model_name or DEFAULT_MODEL

    # 过滤无实质内容的噪声句（纯标点/单字符/纯语气词），只留可读内容进 prompt
    substantive_segments = [
        seg for seg in segments if _is_substantive(str(seg.get("text", "")))
    ]

    if not substantive_segments:
        # 没有一句可读内容：不调模型，直接返回确定性兜底（永不空屏、零成本）
        return {
            "summary": "本次会议内容较少，无实质性讨论",
            "key_points": [],
            "todos": [],
        }, model

    transcript_text = "\n".join(
        _format_transcript_line(seg) for seg in substantive_segments
    )

    if not transcript_text.strip():
        return {
            "summary": "本次会议无转录内容",
            "key_points": [],
            "todos": [],
        }, model

    meta_context = _build_meta_context(meeting_meta)

    # 长会议分块总结（map-reduce）：避免超出模型上下文被截断导致总结过短
    if len(transcript_text) > _CHUNK_THRESHOLD_CHARS:
        return await _generate_minutes_chunked(
            substantive_segments, model, meta_context, max_retries
        )

    # —— 短会议：原有单次调用（行为不变）——
    # 请求结构对齐 llama.cpp 前缀缓存：
    # 固定逐字节部分（系统提示词 + 固定模板）放**最前**且不夹变化内容；
    # 一切易变内容（转录正文、会议元信息）放**尾部**。
    # 只要固定前缀不变，多会议请求复用同一前缀的 KV，prefill 大幅下降。
    block_list: list[str] = [MINUTES_SYSTEM_PROMPT]
    block_list.append("以下是会议转录内容：")
    if transcript_text:
        block_list.append(transcript_text)
    if meta_context:
        block_list.append(meta_context)
    block_list.append("请生成会议纪要：")
    prompt = "\n\n".join(block_list)

    last_error: Exception | None = None
    for attempt in range(max_retries):
        try:
            response_text = await _call_llm(prompt, model)
            minutes = _extract_json(response_text)
            if minutes is None:
                raise ValueError(f"Failed to parse JSON: {response_text[:200]}")

            validated = _validate_minutes(minutes)
            return validated, f"{model} ({PROMPT_VERSION})"

        except Exception as e:
            last_error = e
            logger.warning(f"Minutes attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2)

    logger.error(f"All retries failed, using fallback. Last error: {last_error}")
    fallback = _fallback_minutes(segments)
    return fallback, f"{model} (fallback)"


async def _call_llm(prompt: str, model: str) -> str:
    """调用本地模型一次，返回原始文本；失败抛异常。"""
    async with httpx.AsyncClient(timeout=120.0) as client:
        request_body = {
            "model": model,
            "messages": [
                {"role": "user", "content": prompt},
            ],
            "stream": False,
            "temperature": 0.3,
            "top_p": 0.9,
        }
        # Qwen3 混合思考模型默认先输出思考块再回答：结构化纪要场景必须
        # 关闭思考（chat template 的 enable_thinking=false），否则思考内容
        # 会混进 JSON 导致解析失败/污染纪要。Qwen2.x 无此开关，不传。
        if "qwen3" in str(model).lower():
            request_body["chat_template_kwargs"] = {"enable_thinking": False}
        response = await client.post(
            f"{LOCAL_AI_BASE_URL}/chat/completions",
            json=request_body,
        )
        response.raise_for_status()
        data = response.json()
        response_text = data["choices"][0]["message"]["content"]
        if not response_text:
            raise ValueError("LLM returned empty response")
        return response_text


def _split_into_chunks(lines: list[str], max_chars: int = _CHUNK_CHARS) -> list[list[str]]:
    """按行把转录切块，每块不超过 max_chars 字符（不切断单行）。"""
    chunks: list[list[str]] = []
    cur: list[str] = []
    cur_len = 0
    for line in lines:
        if cur and cur_len + len(line) + 1 > max_chars:
            chunks.append(cur)
            cur = []
            cur_len = 0
        cur.append(line)
        cur_len += len(line) + 1
    if cur:
        chunks.append(cur)
    return chunks


async def _generate_minutes_chunked(
    segments: list[dict[str, Any]],
    model: str,
    meta_context: str,
    max_retries: int,
) -> tuple[dict[str, Any], str]:
    """长会议分块总结：逐块提炼要点 → 汇总生成整场纪要。

    - map：每块调用一次模型，产出该块 summary/key_points；
    - reduce：把所有块的要点交给模型合并成完整纪要；
    - 容错：单块失败跳过；reduce 失败时用程序合并（不空屏、不劣化）。
    """
    lines = [line for line in (
        _format_transcript_line(seg) for seg in segments
    ) if line]
    chunks = _split_into_chunks(lines)

    logger.info(
        "Long meeting chunked minutes: %d chars, %d chunks",
        sum(len(l) for l in lines),
        len(chunks),
    )

    chunk_results: list[dict[str, Any]] = []
    total = len(chunks)
    for idx, chunk_lines in enumerate(chunks):
        chunk_text = "\n".join(chunk_lines)
        # 分段传入时附带额外提示词：明确这是整场会议的第几部分、
        # 前后还有哪些部分，帮助模型理解该段的上下文定位。
        part_hint = (
            f"（这是整场会议转录的第 {idx + 1}/{total} 部分"
            + ("，前面还有内容，可能是会议中途。" if idx > 0 else "，是会议的开头。")
            + ("后面还有后续内容。" if idx < total - 1 else "，是会议的结尾。")
            + "请只提炼这一部分的内容，不要编造其他部分的信息。）"
        )
        prompt = (
            CHUNK_MAP_PROMPT
            + "\n\n" + part_hint
            + "\n\n会议转录片段：\n\n"
            + chunk_text
            + "\n\n请输出 JSON："
        )
        raw = None
        for attempt in range(2):
            try:
                raw = await _call_llm(prompt, model)
                break
            except Exception as e:
                logger.warning(f"Chunk {idx + 1}/{len(chunks)} attempt failed: {e}")
                if attempt < 1:
                    await asyncio.sleep(2)
        if not raw:
            logger.warning(f"Chunk {idx + 1} failed, skipped")
            continue
        parsed = _extract_json(raw)
        if parsed is None:
            logger.warning(f"Chunk {idx + 1} JSON parse failed, skipped")
            continue
        chunk_results.append(_validate_minutes(parsed))

    if not chunk_results:
        logger.error("All chunks failed, falling back to single-shot summary")
        # 回退单次调用（可能被截断，但好过空屏）
        transcript_text = "\n".join(lines)
        prompt = (
            MINUTES_SYSTEM_PROMPT
            + "\n\n以下是会议转录内容：\n\n"
            + transcript_text
            + ("\n\n" + meta_context if meta_context else "")
            + "\n\n请生成会议纪要："
        )
        for attempt in range(max_retries):
            try:
                response_text = await _call_llm(prompt, model)
                minutes = _extract_json(response_text)
                if minutes is not None:
                    return _validate_minutes(minutes), f"{model} ({PROMPT_VERSION})"
            except Exception as e:
                logger.warning(f"Fallback attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2)
        return _fallback_minutes(segments), f"{model} (fallback)"

    # —— reduce：合并所有块要点生成整场纪要 ——
    merged_lines: list[str] = []
    for i, r in enumerate(chunk_results):
        merged_lines.append(f"【第{i + 1}段】" + (r.get("summary") or ""))
        for kp in r.get("key_points") or []:
            merged_lines.append("- " + str(kp))
    merged_text = "\n".join(merged_lines)

    reduce_prompt = (
        MINUTES_SYSTEM_PROMPT
        + "\n\n以下是整场会议各段落（按时间顺序）的要点摘要：\n\n"
        + merged_text
        + ("\n\n" + meta_context if meta_context else "")
        + "\n\n请合并以上内容，生成整场会议的完整纪要。"
        + "要求：summary 至少 300 字（300-600 字），必须覆盖上述所有段落讨论的内容，"
        + "不要遗漏任何一段的要点："
    )
    reduced: dict[str, Any] | None = None
    for attempt in range(2):
        try:
            response_text = await _call_llm(reduce_prompt, model)
            minutes = _extract_json(response_text)
            if minutes is not None:
                reduced = _validate_minutes(minutes)
                break
        except Exception as e:
            logger.warning(f"Reduce attempt {attempt + 1} failed: {e}")
            if attempt < 1:
                await asyncio.sleep(2)

    # 程序合并各块结果（保证信息完整，不因模型压缩而丢失内容）
    chunk_summary_parts = [
        (r.get("summary") or "").strip()
        for r in chunk_results
        if (r.get("summary") or "").strip()
    ]
    merged_key_points: list[str] = []
    seen: set[str] = set()
    for r in chunk_results:
        for kp in r.get("key_points") or []:
            kp_s = str(kp).strip()
            if kp_s and kp_s not in seen:
                seen.add(kp_s)
                merged_key_points.append(kp_s)
    merged_todos: list[dict[str, str]] = []
    for r in chunk_results:
        for td in r.get("todos") or []:
            if isinstance(td, dict) and td.get("content"):
                merged_todos.append(td)

    if reduced is None:
        # reduce 完全失败：用各块拼接
        logger.warning("Reduce failed, merging chunk results programmatically")
        return {
            "summary": "；".join(chunk_summary_parts) or "（长会议分块总结）",
            "key_points": merged_key_points,
            "todos": merged_todos,
        }, f"{model} ({PROMPT_VERSION})"

    # reduce 成功但 summary 过短（3B 模型压缩过度）：保留客观内容量
    if len(reduced["summary"]) < 200 and chunk_summary_parts:
        # 用 reduce 总起句 + 各段摘要拼接，保证覆盖所有段落
        reduced["summary"] = (
            reduced["summary"].rstrip("。；; ") + "。"
            + "；".join(chunk_summary_parts)
        )
    # 要点合并去重（补充各块要点，防止 reduce 遗漏）
    for kp in merged_key_points:
        if kp not in reduced["key_points"]:
            reduced["key_points"].append(kp)
    # 待办补充
    existing_todo_contents = {
        str(td.get("content", "")).strip() for td in reduced["todos"]
    }
    for td in merged_todos:
        if str(td.get("content", "")).strip() not in existing_todo_contents:
            reduced["todos"].append(td)
    return reduced, f"{model} ({PROMPT_VERSION})"


def generate_minutes_sync(
    segments: list[dict[str, str]],
    model_name: str | None = None,
    meeting_meta: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], str]:
    """同步版本（供 Celery 任务使用）。"""
    return asyncio.run(generate_minutes(segments, model_name, meeting_meta=meeting_meta))
