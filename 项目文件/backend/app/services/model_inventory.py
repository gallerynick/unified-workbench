"""模型清单采集。

把本地 AI（GGUF）与 ModelScope 两个来源的已下载模型汇总成一张清单，
统一给出引擎、用途类型、体积与配置状态。

两类模型的存储形态不同，采集方式也不同：

- **本地 AI 模型**：GGUF 文件平铺在共享目录（后端 /data/gguf，llama.cpp /models），
  直接 stat 就拿到精确字节数，不需要问引擎——磁盘才是「有没有、有多大」的事实来源；
- **ModelScope 模型**：目录名就是仓库 ID，需要与当前 ASR 配置的槽位做连接
  才能判定用途；连不上的是「已下载但未配置」的孤儿缓存。

用途类型（ASR / 标点 / 声纹 / VAD / LLM）是元数据而不是目录位置。
"""

from __future__ import annotations

import asyncio
import logging
import os
import stat
import time
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.schemas.model_inventory import (
    EngineSummary,
    ModelInventory,
    ModelInventoryItem,
    ModelStatus,
)
from app.services import llama_cpp
from app.services.storage_breakdown import _measure_subdir
from app.utils.timeutil import now_shanghai_iso

logger = logging.getLogger(__name__)

ENGINE_NAMES = {"llamacpp": "llama.cpp", "modelscope": "ModelScope"}

# GGUF 模型名 -> 用途。按名称关键词粗分，够用即可，不追求穷举。
# 顺序敏感：先匹配更具体的关键词。
_LOCAL_AI_TYPE_RULES: list[tuple[str, str, str]] = [
    ("whisper", "asr", "语音识别"),
    ("sensevoice", "asr", "语音识别"),
    ("llava", "vision", "视觉理解"),
    ("codellama", "code", "代码生成"),
    ("llama", "llm", "对话生成"),
    ("qwen", "llm", "对话生成"),
    ("glm", "llm", "对话生成"),
    ("mistral", "llm", "对话生成"),
    ("minicpm", "llm", "对话生成"),
]

# ASR 配置的槽位 -> (配置键, 类型 key, 类型展示名, 缺省模型名)。
# 换 SenseVoice 后只需主模型：标点内建、VAD 属场景层、说话人分离走 sherpa-onnx，
# 都不再占用 ModelScope 缓存槽位。
_ASR_SLOTS: list[tuple[str, str, str, str]] = [
    ("model", "asr", "语音识别", "sensevoice"),
]

# 槽位连接失败时按仓库 ID 关键词兜底推断用途，避免把已知模型标成「未分类」。
_KNOWN_ASR_TYPE_RULES: list[tuple[str, str, str]] = [
    ("sensevoice", "asr", "语音识别"),
    ("whisper", "asr", "语音识别"),
    ("ct-transformer", "punc", "标点恢复"),
    ("campplus", "spk", "说话人分离"),
    ("fsmn-vad", "vad", "语音端点检测"),
]


def _classify_local_ai(name: str) -> tuple[str, str]:
    """按模型名推断本地 AI 模型的用途。"""
    base = name.lower()
    for keyword, type_key, label in _LOCAL_AI_TYPE_RULES:
        if keyword in base:
            return type_key, label
    return "llm", "对话生成"


def _infer_asr_type(repo_id: str) -> tuple[str, str]:
    """槽位连接失败时，按仓库 ID 关键词兜底推断 ASR 侧模型的用途。"""
    base = repo_id.lower()
    for keyword, type_key, label in _KNOWN_ASR_TYPE_RULES:
        if keyword in base:
            return type_key, label
    return "unknown", "未分类"


def _asr_slot_dirs(local: dict[str, Any]) -> dict[str, tuple[str, str, str]]:
    """当前 ASR 配置下每个槽位对应的缓存目录名。

    返回 {缓存目录名: (类型 key, 类型展示名, 配置里填的模型名)}。
    """
    from app.services import asr_engine

    out: dict[str, tuple[str, str, str]] = {}
    for config_key, type_key, label, default_name in _ASR_SLOTS:
        name = str((local or {}).get(config_key) or default_name)
        try:
            dir_name = asr_engine.cached_model_dir_name(name)
        except Exception:
            logger.warning("无法解析模型「%s」的仓库 ID", name, exc_info=True)
            continue
        out[dir_name] = (type_key, label, name)
    return out


async def _local_ai_items(
    configured_model: str | None,
) -> tuple[list[ModelInventoryItem], list[str]]:
    """采集本地 GGUF 模型。

    体积直接来自文件系统，不再依赖引擎接口——磁盘是事实来源，引擎只是消费方。
    """
    entries = await asyncio.to_thread(llama_cpp.local_model_files)
    configured = (configured_model or "").strip().lower()

    items: list[ModelInventoryItem] = []
    for entry in entries:
        name = str(entry.get("name") or "").strip()
        if not name:
            continue
        type_key, label = _classify_local_ai(name)
        in_use = bool(configured) and name.lower() == configured
        items.append(
            ModelInventoryItem(
                engine="llamacpp",
                type_key=type_key,
                model_type=label,
                name=name,
                bytes=int(entry.get("size_bytes") or 0),
                status="configured" if in_use else "available",
                source="filesystem",
                note=(
                    "当前 AI 提供商配置正在使用该模型"
                    if in_use
                    else "已下载但未在当前配置中引用，可在模型配置中切换"
                ),
            )
        )
    return items, []


def _modelscope_items(
    configured_dirs: dict[str, tuple[str, str, str]],
) -> tuple[list[ModelInventoryItem], list[str]]:
    """遍历 ModelScope 缓存，按槽位连接判定用途与配置状态。"""
    notes: list[str] = []
    models_dir = os.path.join(get_settings().MODELSCOPE_CACHE_PATH, "models")
    items: list[ModelInventoryItem] = []

    if not os.path.isdir(models_dir):
        return items, [f"ModelScope 缓存目录不存在，本次未统计：{models_dir}"]
    try:
        entries = sorted([e for e in os.scandir(models_dir)], key=lambda e: e.name)
    except OSError as exc:
        return items, [f"ModelScope 缓存目录不可访问：{exc}"]

    for entry in entries:
        try:
            st = entry.stat(follow_symlinks=False)
        except OSError:
            notes.append(f"跳过不可读条目：{entry.name}")
            continue
        if not stat.S_ISDIR(st.st_mode):
            continue

        dir_name = entry.name
        # 目录名由 repo_id.replace("/", "--") 得到；只还原第一个分隔符，
        # 避免仓库名本身含 -- 时被误改。
        repo_id = dir_name.replace("--", "/", 1)
        size = _measure_subdir(entry.path)[0]

        status: ModelStatus
        if dir_name in configured_dirs:
            type_key, label, config_name = configured_dirs[dir_name]
            status = "incomplete" if size <= 0 else "configured"
            name, note = config_name, (
                "缓存目录为空，模型未下载完整"
                if size <= 0
                else "当前 ASR 配置正在使用该模型"
            )
        else:
            type_key, label = _infer_asr_type(repo_id)
            status = "incomplete" if size <= 0 else "orphan"
            name = repo_id
            note = "已下载但不属于当前 ASR 配置的槽位，可能是历史缓存，清理前请确认"

        items.append(
            ModelInventoryItem(
                engine="modelscope",
                type_key=type_key,
                model_type=label,
                name=name,
                repo_id=repo_id,
                bytes=size,
                status=status,
                source="filesystem",
                note=note,
            )
        )
    return items, notes


async def build_model_inventory(db: AsyncSession) -> ModelInventory:
    """采集两个引擎的模型清单；任一引擎失败只影响该引擎。"""
    started = time.monotonic()

    from app.services.third_party_config import get_third_party_config

    try:
        config = await get_third_party_config(db)
        ai_local = (config.ai_provider.local or {}) if config.ai_provider else {}
        asr_local = (config.asr_config.local or {}) if config.asr_config else {}
    except Exception:
        logger.warning("读取第三方配置失败，按未配置处理", exc_info=True)
        ai_local, asr_local = {}, {}

    configured_model = str(ai_local.get("model") or "").strip() or None
    configured_dirs = _asr_slot_dirs(asr_local)

    items: list[ModelInventoryItem] = []
    notes: list[str] = []

    try:
        local_items, local_notes = await _local_ai_items(configured_model)
        items.extend(local_items)
        notes.extend(local_notes)
    except Exception:
        logger.warning("本地 AI 模型采集失败", exc_info=True)
        notes.append("本地 AI 模型采集失败，本次未统计")

    # 目录遍历是阻塞 IO，必须放到线程池，否则会卡住事件循环
    try:
        ms_items, ms_notes = await asyncio.to_thread(
            _modelscope_items, configured_dirs
        )
        items.extend(ms_items)
        notes.extend(ms_notes)
    except Exception:
        logger.warning("ModelScope 模型采集失败", exc_info=True)
        notes.append("ModelScope 缓存遍历失败，本次未统计")

    items.sort(key=lambda i: (-i.bytes, i.engine, i.name))

    engines: list[EngineSummary] = []
    for engine in ("llamacpp", "modelscope"):
        subset = [i for i in items if i.engine == engine]
        if not subset:
            continue
        engines.append(
            EngineSummary(
                engine=engine,
                engine_name=ENGINE_NAMES[engine],
                bytes=sum(i.bytes for i in subset),
                count=len(subset),
            )
        )

    return ModelInventory(
        generated_at=now_shanghai_iso(),
        elapsed_ms=int((time.monotonic() - started) * 1000),
        total_bytes=sum(i.bytes for i in items),
        engines=engines,
        items=items,
        notes=notes,
    )
