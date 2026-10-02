"""说话人分离服务 - sherpa-onnx 声纹分离（纯 ONNX，免预录）。

用两个 ONNX 模型实现无监督说话人分离：
- pyannote 分割模型：检测语音段（谁在什么时候说话）
- 3D-Speaker 嵌入模型：为每个语音段提取声纹向量
- 聚类：把相似声纹聚成一类 → 说话人编号（speaker_0/1/2…）

**不需要提前录声纹**：整段音频听完，当场把不同的人聚成几类。
**只回答「有几个人、哪段是谁」，不回答「这是张三」**——名字需另行映射。
"""

from __future__ import annotations

import logging
import os
from typing import Any

import soundfile as sf

logger = logging.getLogger(__name__)

# 模型目录：放在 ModelScope 命名卷内（后端容器已挂载），随部署持久。
_MODEL_DIR = "/home/workbench/.modelscope/sherpa"

_SEGMENTATION_MODEL = os.path.join(
    _MODEL_DIR, "sherpa-onnx-pyannote-segmentation-3-0", "model.int8.onnx"
)
_EMBEDDING_MODEL = os.path.join(
    _MODEL_DIR, "3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx"
)

_diarization = None
_import_error: str | None = None


def _get_diarization():
    """惰性初始化 sherpa-onnx 说话人分离器；失败时缓存错误信息。"""
    global _diarization, _import_error
    if _diarization is not None:
        return _diarization
    if _import_error is not None:
        raise RuntimeError(_import_error)

    try:
        import sherpa_onnx
    except Exception as exc:  # pragma: no cover
        _import_error = f"sherpa-onnx 不可用：{exc}"
        raise RuntimeError(_import_error)

    if not (os.path.isfile(_SEGMENTATION_MODEL) and os.path.isfile(_EMBEDDING_MODEL)):
        _import_error = "声纹模型不完整，请检查 sherpa 模型目录"
        raise RuntimeError(_import_error)

    config = sherpa_onnx.OfflineSpeakerDiarizationConfig(
        segmentation=sherpa_onnx.OfflineSpeakerSegmentationModelConfig(
            pyannote=sherpa_onnx.OfflineSpeakerSegmentationPyannoteModelConfig(
                model=_SEGMENTATION_MODEL,
                window_shift_ratio=0.1,
            ),
        ),
        embedding=sherpa_onnx.SpeakerEmbeddingExtractorConfig(
            model=_EMBEDDING_MODEL,
        ),
        clustering=sherpa_onnx.FastClusteringConfig(
            num_clusters=-1,  # 自动聚类，不预设人数
            threshold=0.5,
        ),
        min_duration_on=0.3,
        min_duration_off=0.5,
    )
    if not config.validate():
        _import_error = "说话人分离配置校验失败"
        raise RuntimeError(_import_error)

    _diarization = sherpa_onnx.OfflineSpeakerDiarization(config)
    logger.info("sherpa-onnx 说话人分离器已初始化")
    return _diarization


def diarize_speakers(audio_path: str) -> list[dict[str, Any]]:
    """对音频做说话人分离，返回带时间戳的说话人段。

    Args:
        audio_path: WAV 音频文件路径

    Returns:
        [{start_time, end_time, spk}]，spk 为 0 起始的说话人编号。
        text 由 ASR 段提供，这里不包含。
    """
    try:
        audio, sample_rate = sf.read(audio_path, dtype="float32", always_2d=True)
    except Exception as exc:
        logger.error("读取音频失败：%s", exc)
        return []

    audio = audio[:, 0]  # 只用第一个声道

    try:
        sd = _get_diarization()
        if sample_rate != sd.sample_rate:
            import librosa

            audio = librosa.resample(
                audio, orig_sr=sample_rate, target_sr=sd.sample_rate
            )
            sample_rate = sd.sample_rate
        result = sd.process(audio).sort_by_start_time()
    except Exception as exc:
        logger.error("说话人分离失败：%s", exc)
        return []

    segments = []
    for item in result:
        # 时间戳统一为毫秒（与转录段 audio_start_ms / audio_end_ms 一致），
        # 供 _match_speaker 按重叠度匹配说话人
        segments.append({
            "start_time": float(item.start) * 1000,
            "end_time": float(item.end) * 1000,
            "spk": int(item.speaker),
        })
    return segments
