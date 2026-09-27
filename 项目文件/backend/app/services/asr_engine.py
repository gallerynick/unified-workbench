"""ASR 语音识别引擎。

封装 FunASR，提供实时转录和批量转录能力。
"""

from __future__ import annotations

import glob
import logging
import os
import shutil
import threading
from typing import Any

# 设置 ModelScope 缓存目录到用户主目录（避免权限问题）
os.environ["HOME"] = "/home/workbench"
os.environ["MODELSCOPE_CACHE"] = "/home/workbench/.modelscope"
os.makedirs(os.environ["MODELSCOPE_CACHE"], exist_ok=True)

logger = logging.getLogger(__name__)

# 配置的模型名 → ModelScope 仓库 ID。
# FunASR 的别名表在 funasr.download.name_maps_from_hub.name_maps_ms 里，
# 这里只做「用户填写的名称」到「官方别名」的归一化，真正的别名解析交给 FunASR。
# campplus / cam 是配置里出现过但不在官方别名表里的写法。
ASR_ALIASES: dict[str, str] = {
    "campplus": "cam++",
    "cam": "cam++",
    "cam_plus": "cam++",
}


def _modelspec_alias(name: str) -> str:
    """把配置里填写的模型名归一化成 FunASR 认识的别名；不在别名表里则原样返回。"""
    key = (name or "").strip().lower()
    if not key:
        return name
    if key in ASR_ALIASES:
        return ASR_ALIASES[key]
    return ASR_ALIASES.get(key.replace(" ", ""), name)


def _repo_id_for(name: str) -> str:
    """解析出 ModelScope 仓库 ID。

    优先查 FunASR 自带的别名表（权威来源，随 FunASR 版本演进），
    查不到就把原值当作仓库 ID 直接使用。
    """
    alias = _modelspec_alias(name)
    try:
        from funasr.download.name_maps_from_hub import name_maps_ms
        if alias in name_maps_ms:
            return name_maps_ms[alias]
        if name in name_maps_ms:
            return name_maps_ms[name]
    except Exception as exc:  # pragma: no cover - 仅在 FunASR 缺失时触发
        logger.warning("无法读取 FunASR 别名表：%s", exc)
    return alias


def _cache_base() -> str:
    """ModelScope 模型缓存根目录。"""
    cache_root = os.environ.get("MODELSCOPE_CACHE") or "/home/workbench/.modelscope"
    return os.path.join(cache_root, "models")


def _model_cache_dir(name: str) -> str:
    """某个模型在缓存里的目录（例如 models/iic--speech_seaco_...）。"""
    repo_id = _repo_id_for(name)
    return os.path.join(_cache_base(), repo_id.replace("/", "--"))


def _snapshot_dir(cache_dir: str) -> str:
    """找到缓存目录下的 snapshots/<revision> 目录；没有则返回空串。"""
    base = os.path.join(cache_dir, "snapshots")
    for entry in sorted(glob.glob(os.path.join(base, "*"))):
        if os.path.isdir(entry):
            return entry
    return ""


def _dir_size_bytes(path: str) -> int:
    total = 0
    for root, _dirs, files in os.walk(path):
        for fname in files:
            fp = os.path.join(root, fname)
            try:
                total += os.path.getsize(fp)
            except OSError:
                pass
    return total


def _top_level_size_bytes(path: str) -> int:
    """只统计目录第一层的普通文件。

    展示用的体积用这个：snapshot 目录里的 example/ 和 fig/ 是官方样例数据，
    动辄几百 MB，算进去会把 ct-punc 这种小模型报成 1GB+。
    真正删除时才是整个目录，那个用 _dir_size_bytes。
    """
    total = 0
    try:
        entries = os.listdir(path)
    except OSError:
        return 0
    for fname in entries:
        fp = os.path.join(path, fname)
        if os.path.isfile(fp):
            try:
                total += os.path.getsize(fp)
            except OSError:
                pass
    return total


def _model_ready(cache_dir: str) -> bool:
    """判断模型是否已完整下载。

    以 snapshot 目录里的 config.yaml 为准：四个模型的快照根目录都有它，
    而 model.pt 在 campplus 上叫 campplus_cn_common.bin，不能作为统一判据。
    """
    snap = _snapshot_dir(cache_dir)
    if not snap:
        return False
    cfg = os.path.join(snap, "config.yaml")
    return os.path.isfile(cfg) and os.path.getsize(cfg) > 0


def get_cached_asr_models(names: list[str] | None = None) -> dict[str, Any]:
    """检查一组模型在 ModelScope 缓存里的状态。

    返回 {"models": [{"name", "repo_id", "ready", "size_mb"}], "downloaded", "total"}。
    这是「模型管理」面板判断按钮是否可用的唯一数据源。
    """
    items: list[dict[str, Any]] = []
    for name in names or []:
        cache_dir = _model_cache_dir(name)
        snap = _snapshot_dir(cache_dir)
        ready = _model_ready(cache_dir)
        items.append({
            "name": name,
            "repo_id": _repo_id_for(name),
            "ready": ready,
            "size_mb": round(_top_level_size_bytes(snap) / (1024 * 1024), 1) if ready else 0.0,
        })
    return {
        "models": items,
        "downloaded": sum(1 for i in items if i["ready"]),
        "total": len(items),
    }


def delete_asr_cache_models(names: list[str]) -> dict[str, Any]:
    """删除一组模型的 ModelScope 缓存目录。

    只删这几个模型自己的 snapshots 目录，不碰 credentials / .lock 等公共内容。
    返回 {"deleted": [...], "missing": [...], "freed_mb": float}。
    """
    deleted: list[str] = []
    missing: list[str] = []
    freed = 0
    for name in names:
        cache_dir = _model_cache_dir(name)
        if not os.path.isdir(cache_dir):
            missing.append(name)
            continue
        snap = _snapshot_dir(cache_dir)
        target = snap or cache_dir
        freed += _dir_size_bytes(target)
        shutil.rmtree(target, ignore_errors=True)
        # 空壳目录也一并清掉
        try:
            if os.path.isdir(cache_dir) and not os.listdir(cache_dir):
                os.rmdir(cache_dir)
        except OSError:
            pass
        deleted.append(name)
    return {"deleted": deleted, "missing": missing, "freed_mb": round(freed / (1024 * 1024), 1)}


def shutdown_asr_model() -> None:
    """卸载已加载的模型实例，供「重载模型」使用。下次转录会重新加载。"""
    global _asr_model, _model_initialized
    with _model_lock:
        _asr_model = None
        _model_initialized = False
        logger.info("ASR model unloaded")

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

            # 配置里可能填 campplus 这类不在官方别名表里的写法，先归一化，
            # 否则 FunASR 会把它当成仓库 ID 直接去下载并失败
            asr_model = _modelspec_alias(asr_model)
            vad_model = _modelspec_alias(vad_model)
            punc_model = _modelspec_alias(punc_model)
            spk_model = _modelspec_alias(spk_model)

            logger.info(
                "Loading ASR models: asr=%s, vad=%s, punc=%s, spk=%s",
                asr_model,
                vad_model,
                punc_model,
                spk_model,
            )
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
