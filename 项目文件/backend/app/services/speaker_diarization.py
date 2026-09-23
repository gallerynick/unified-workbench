"""说话人分离服务 - 使用 CAM++"""

from __future__ import annotations

from typing import Any

_spk_model = None


def init_spk_model(model_name: str = "cam++"):
    """初始化说话人分离模型"""
    global _spk_model
    
    if _spk_model is None:
        from funasr import AutoModel
        
        _spk_model = AutoModel(
            model=model_name,
            vad_model="fsmn-vad",
            disable_update=True,
        )
    
    return _spk_model


def diarize_speakers(audio_path: str) -> list[dict[str, Any]]:
    """对音频进行说话人分离"""
    model = init_spk_model()
    
    result = model.inference(
        input=audio_path,
        batch_size_s=300,
        merge_vad=True,
    )
    
    segments = []
    if result and result[0].get("sentence_info"):
        for sentence in result[0]["sentence_info"]:
            segments.append({
                "text": sentence.get("text", ""),
                "start_time": sentence.get("start", 0),
                "end_time": sentence.get("end", 0),
                "spk": sentence.get("spk", 0),
            })
    
    return segments
