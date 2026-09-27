"""ASR 语音识别引擎。

封装 FunASR，提供实时转录和批量转录能力。
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Any

# 设置 ModelScope 缓存目录到用户主目录（避免权限问题）
os.environ["HOME"] = "/home/workbench"
os.environ["MODELSCOPE_CACHE"] = "/home/workbench/.modelscope"
os.makedirs(os.environ["MODELSCOPE_CACHE"], exist_ok=True)

logger = logging.getLogger(__name__)

# 全局模型实例（线程安全）
_asr_model: Any = None
_model_lock = threading.Lock()
_model_initialized = False


def init_asr_model(
    asr_model: str = "paraformer-zh",
    vad_model: str = "fsmn-vad",
    punc_model: str = "ct-punc",
    spk_model: str = "cam++",
) -> None:
    """初始化 ASR 模型（惰性加载，线程安全）。

    使用 Paraformer-zh + ct-punc + CAM++ 组合：
    - paraformer-zh: 中文语音识别主模型
    - fsmn-vad: 语音端点检测
    - ct-punc: 标点符号恢复
    - cam++: 说话人嵌入/分离
    """
    global _asr_model, _model_initialized
    if _model_initialized:
        return

    with _model_lock:
        if _model_initialized:
            return
        try:
            from funasr import AutoModel

            logger.info(f"Loading ASR models: asr={asr_model}, vad={vad_model}, punc={punc_model}, spk={spk_model}")
            _asr_model = AutoModel(
                model=asr_model,
                vad_model=vad_model,
                punc_model=punc_model,
                spk_model=spk_model,
                device="cpu",
            )
            _model_initialized = True
            logger.info("ASR model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load ASR model: {e}")
            raise


def transcribe_audio_array(
    audio_data: bytes,
    sample_rate: int = 16000,
    channels: int = 1,
) -> list[dict[str, Any]]:
    """转录音频数据，返回带时间戳的文本段。

    Args:
        audio_data: WAV PCM 原始数据（16-bit signed, mono）
        sample_rate: 采样率
        channels: 声道数

    Returns:
        转录结果列表，每项包含 text, start_ms, end_ms
    """
    global _asr_model

    if not _model_initialized:
        init_asr_model()

    if _asr_model is None:
        logger.warning("ASR model not available, returning empty result")
        return []

    try:
        import numpy as np

        # 确保是 numpy float32 数组
        audio_np = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0

        # 执行转录（Paraformer-zh + ct-punc + CAM++ 使用 generate 方法）
        result = _asr_model.generate(audio_np, batch_size_s=300)

        segments = []
        if result and len(result) > 0:
            for item in result:
                text = item.get("text", "").strip()
                if text:
                    segments.append({
                        "text": text,
                        "start_ms": int(item.get("start", 0)),
                        "end_ms": int(item.get("end", 0)),
                    })

        return segments

    except Exception as e:
        logger.error(f"ASR transcription failed: {e}")
        return []


def is_available() -> bool:
    """检查 ASR 是否可用。"""
    return _model_initialized and _asr_model is not None
