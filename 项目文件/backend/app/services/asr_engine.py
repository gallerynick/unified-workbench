"""ASR 引擎服务 - 使用 FunASR Paraformer"""

import os
import tempfile
from typing import Any

import numpy as np

_asr_model = None


def init_asr_model(model_name: str = "paraformer-zh", punc_model_name: str = "ct-punc"):
    """初始化 ASR 模型"""
    global _asr_model
    
    if _asr_model is None:
        from funasr import AutoModel
        
        _asr_model = AutoModel(
            model=model_name,
            punc_model=punc_model_name,
            vad_model="fsmn-vad",
            disable_update=True,
        )
    
    return _asr_model


def transcribe_audio(audio_path: str) -> list[dict[str, Any]]:
    """转录音频文件，返回句子列表"""
    model = init_asr_model()
    
    result = model.inference(
        input=audio_path,
        batch_size_s=300,
        merge_vad=True,
        merge_vad_time_s=30,
    )
    
    segments = []
    if result and result[0].get("sentence_info"):
        for sentence in result[0]["sentence_info"]:
            segments.append({
                "text": sentence.get("text", ""),
                "start_time": sentence.get("start", 0),
                "end_time": sentence.get("end", 0),
                "spk": sentence.get("spk", None),
            })
    
    return segments


def transcribe_audio_array(audio_array: np.ndarray, sample_rate: int = 16000) -> list[dict[str, Any]]:
    """转录音频数组，返回句子列表"""
    import soundfile as sf
    
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        sf.write(f.name, audio_array, sample_rate)
        tmp_path = f.name
    
    try:
        return transcribe_audio(tmp_path)
    finally:
        os.unlink(tmp_path)
