"""Model warmup maintenance task.

Global warmup guard: when the global switch is enabled, keep the local AI
model and local ASR model loaded. If either one is manually unloaded, the next
beat tick will bring it back up instead of waiting for a process restart.
"""

from __future__ import annotations

import asyncio

from celery import shared_task

from app.core.database import isolated_session
from app.services import asr_engine
from app.services.third_party_config import (
    _prepare_asr_loaded,
    get_memory_info,
    get_third_party_config,
    warmup_ai_model,
)


async def ensure_models_warm() -> None:
    async with isolated_session() as db:
        config = await get_third_party_config(db)

        mem_info = await get_memory_info(db)  # P1：复用会话

        if config.warmup.ai and config.ai_provider.mode == "local" and not mem_info.get("ai_loaded", False):
            await warmup_ai_model(db)

        if config.warmup.asr and config.asr_config.mode == "local" and not asr_engine.is_available():
            # P5：必须用可等待的同步版本——preload_asr_models 的后台任务
            # 在 asyncio.run 返回（事件循环关闭）瞬间就被取消，永远跑不完。
            await _prepare_asr_loaded(config)


@shared_task(name="app.tasks.model_warmup.ensure_models_warm")
def scheduled_model_warmup() -> None:
    asyncio.run(ensure_models_warm())


@shared_task(
    name="app.tasks.model_warmup.ensure_speaker_models_task",
    soft_time_limit=900,
    time_limit=960,
)
def ensure_speaker_models_task() -> dict[str, object]:
    """下载并校验声纹模型（说话人分离用）。

    首次部署约 40MB；已有文件字节数正确时直接跳过。
    单独成任务是为了让「会议页发现模型缺失」时可以一键触发，
    不必让用户自己进容器手工下载。
    """
    from app.services.speaker_diarization import (
        _download_lock,
        ensure_models,
        verify_models,
    )

    if _download_lock["running"]:
        return {"ok": False, "reason": "声纹模型正在下载中"}
    _download_lock["running"] = True
    try:
        _download_lock["message"] = "正在校验声纹模型"
        ok, reason = ensure_models(
            on_progress=lambda text: _download_lock.__setitem__("message", text)
        )
        _download_lock["message"] = "声纹模型就绪" if ok else reason
        if not verify_models()[0]:
            return {"ok": False, "reason": reason}
        return {"ok": True, "reason": ""}
    finally:
        _download_lock["running"] = False
