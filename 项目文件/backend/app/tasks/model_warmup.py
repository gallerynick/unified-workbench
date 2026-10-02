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
    get_memory_info,
    get_third_party_config,
    preload_asr_models,
    warmup_ai_model,
)


async def ensure_models_warm() -> None:
    async with isolated_session() as db:
        config = await get_third_party_config(db)

        mem_info = await get_memory_info()

        if config.warmup.ai and config.ai_provider.mode == "local" and not mem_info.get("ai_loaded", False):
            await warmup_ai_model(db)

        if config.warmup.asr and config.asr_config.mode == "local" and not asr_engine.is_available():
            await preload_asr_models(db)


@shared_task(name="app.tasks.model_warmup.ensure_models_warm")
def scheduled_model_warmup() -> None:
    asyncio.run(ensure_models_warm())
