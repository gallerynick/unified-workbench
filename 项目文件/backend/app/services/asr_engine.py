"""ASR 语音识别引擎。

基于 funasr-onnx 的 SenseVoiceSmall，纯 ONNX 推理，不依赖 torch。

**时间戳不在本模块产生**：SenseVoice ONNX 只返回文本（带富文本标签），
句子边界与时间戳由调用方（场景层，如会议模块）的 VAD 分段决定。
本模块只回答「这段音频说了什么」。

富文本标签（如 <|zh|><|NEUTRAL|><|withitn|>）在输出时剥离；
标点由 textnorm="withitn" 内建，不再需要独立的标点模型。
"""

from __future__ import annotations

import glob
import logging
import os
import re
import shutil
import threading
from typing import Any

# 设置 ModelScope 缓存目录到用户主目录（避免权限问题）
os.environ["HOME"] = "/home/workbench"
os.environ["MODELSCOPE_CACHE"] = "/home/workbench/.modelscope"
os.makedirs(os.environ["MODELSCOPE_CACHE"], exist_ok=True)

logger = logging.getLogger(__name__)

# SenseVoice 模型仓库与缓存目录。
# 配置里填 "sensevoice" 或 "SenseVoiceSmall"，统一映射到 ONNX 仓库。
_SENSEVOICE_REPO = "iic/SenseVoiceSmall-onnx"

# 配置模型名 -> 仓库 ID。只保留实际使用的 SenseVoice ONNX。
_MODEL_REPOS: dict[str, str] = {
    "sensevoice": _SENSEVOICE_REPO,
    "sensevoicesmall": _SENSEVOICE_REPO,
    "sensevoice-onnx": _SENSEVOICE_REPO,
    _SENSEVOICE_REPO: _SENSEVOICE_REPO,
}


def _repo_id_for(name: str) -> str:
    """模型名 -> ModelScope 仓库 ID。未知名称原样返回。"""
    key = (name or "").strip().lower().replace(" ", "")
    return _MODEL_REPOS.get(key, name or _SENSEVOICE_REPO)


def _cache_base() -> str:
    """ModelScope 模型缓存根目录。"""
    cache_root = os.environ.get("MODELSCOPE_CACHE") or "/home/workbench/.modelscope"
    return os.path.join(cache_root, "models")


def _model_cache_dir(name: str) -> str:
    """某个模型在缓存里的目录（仓库 ID 中的 / 替换为 --）。"""
    repo_id = _repo_id_for(name)
    return os.path.join(_cache_base(), repo_id.replace("/", "--"))


def cached_model_dir_name(name: str) -> str:
    """模型名 -> 缓存目录名。供模型清单等外部模块定位缓存目录。"""
    return _repo_id_for(name).replace("/", "--")


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
    """只统计目录第一层的普通文件（不含 example/ 等官方样例数据）。"""
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

    SenseVoice ONNX 以 model_quant.onnx 存在为准。
    """
    snap = _snapshot_dir(cache_dir)
    if not snap:
        return False
    return os.path.isfile(os.path.join(snap, "model_quant.onnx"))


def get_cached_asr_models(names: list[str] | None = None) -> dict[str, Any]:
    """检查模型在缓存里的状态。

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
    """删除一组模型的 ModelScope 缓存目录。"""
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
        try:
            if os.path.isdir(cache_dir) and not os.listdir(cache_dir):
                os.rmdir(cache_dir)
        except OSError:
            pass
        deleted.append(name)
    return {"deleted": deleted, "missing": missing, "freed_mb": round(freed / (1024 * 1024), 1)}


# ── 句子切分（VAD 活性检测）────────────────────────────────────────
# 用 webrtcvad（纯 C，不创建 onnxruntime session）做语音活性判断。
# 选择原因：sherpa-onnx 的 Silero VAD 与 SenseVoice 各自持有一个 ORT
# session，两个 session 并存会让进程的内存 commit 超 VM overcommit 上限
# （本机 Docker VM 8.7GB / CommitLimit 5.5GB），推理时被 OOM 杀掉。
# webrtcvad 零 ORT 开销，与 SenseVoice 并存无此问题。
_webrtc_vad = None


def _get_webrtc_vad():
    """懒加载 webrtcvad 实例（模式 2，平衡灵敏度）。"""
    global _webrtc_vad
    if _webrtc_vad is None:
        import webrtcvad

        _webrtc_vad = webrtcvad.Vad(2)
    return _webrtc_vad


def vad_is_speech(frame: bytes, sample_rate: int = 16000) -> bool:
    """单帧（16-bit PCM mono，10/20/30ms）语音活性判断。"""
    try:
        return _get_webrtc_vad().is_speech(frame, sample_rate)
    except Exception:
        return False


def segment_audio(
    audio,
    sample_rate: int = 16000,
    silence_timeout: float = 0.6,
    min_duration: float = 0.3,
) -> list[tuple[int, bytes]]:
    """整段切句：把音频切成语音句段。

    Args:
        audio: float32 单声道波形（numpy 数组）
        sample_rate: 采样率（16000）
        silence_timeout: 句内静音超过该秒数则切句
        min_duration: 短于该秒数的段丢弃（噪声）

    Returns:
        [(start_ms, pcm_int16_bytes)]，按时间顺序。
    """
    import numpy as np

    pcm = (audio * 32768).astype(np.int16)
    frame_ms = 20
    frame_len = sample_rate * frame_ms // 1000  # 320 samples @16k
    segments: list[tuple[int, bytes]] = []

    cur_start_ms: int | None = None
    cur = bytearray()
    silence = 0.0

    for i in range(0, len(pcm) - frame_len + 1, frame_len):
        frame = pcm[i : i + frame_len].tobytes()
        start_ms = i * 1000 // sample_rate
        if vad_is_speech(frame, sample_rate):
            if cur_start_ms is None:
                cur_start_ms = start_ms
            cur.extend(frame)
            silence = 0.0
        elif cur_start_ms is not None:
            cur.extend(frame)
            silence += frame_ms / 1000
            if silence >= silence_timeout:
                seg_dur = len(cur) // 2 / sample_rate
                if seg_dur >= min_duration:
                    segments.append((cur_start_ms, bytes(cur)))
                cur_start_ms = None
                cur = bytearray()
                silence = 0.0

    if cur_start_ms is not None:
        seg_dur = len(cur) // 2 / sample_rate
        if seg_dur >= min_duration:
            segments.append((cur_start_ms, bytes(cur)))

    return segments


def is_available() -> bool:
    """ASR 模型是否已载入内存。"""
    return _model_initialized and _asr_model is not None


def shutdown_asr_model() -> None:
    """卸载已加载的模型实例。下次转录会重新加载。"""
    global _asr_model, _model_initialized
    with _model_lock:
        _asr_model = None
        _model_initialized = False
        logger.info("ASR model unloaded")


# 全局模型实例（线程安全）
_asr_model: Any = None
_model_lock = threading.Lock()
_model_initialized = False


def init_asr_model(asr_model: str = "sensevoice") -> None:
    """初始化 SenseVoice ONNX 模型（惰性加载，线程安全）。"""
    global _asr_model, _model_initialized
    if _model_initialized:
        return

    with _model_lock:
        if _model_initialized:
            return
        try:
            from funasr_onnx import SenseVoiceSmall

            cache_dir = _model_cache_dir(asr_model)
            snap = _snapshot_dir(cache_dir)
            if not snap:
                raise FileNotFoundError(
                    f"模型缓存不完整：{cache_dir}（缺少 model_quant.onnx）"
                )

            logger.info("Loading SenseVoice ONNX from %s", snap)
            _asr_model = SenseVoiceSmall(
                snap,
                quantize=True,
                intra_op_num_threads=2,
            )
            _model_initialized = True
            logger.info("ASR model loaded successfully")
        except Exception as e:
            logger.error("Failed to load ASR model: %s", e)
            raise


# 富文本标签清洗：<|zh|> 以及被意外插入空格的形态 < | zh | > 都剥掉。
_TAG_RE = re.compile(r"<\s*\|[^>]*?\|\s*>")

# SenseVoice 语言标签（含被插入空格的形态）
_LANG_TAG_RE = re.compile(r"<\s*\|\s*(zh|en|ja|ko|yue)\s*\|\s*>", re.IGNORECASE)

# 语言白名单可选项 → SenseVoice 语言参数
SUPPORTED_LANGUAGES = ("zh", "en", "ja", "ko", "yue", "auto")


def _clean_rich_text(text: str) -> str:
    """剥离 SenseVoice 富文本标签（<|zh|>、<|withitn|> 等），返回纯文本。"""
    return _TAG_RE.sub("", text).strip()


def _detect_language(raw_text: str) -> str | None:
    """从富文本中提取语言标签（auto 模式输出 <|zh|> 等），没有则 None。"""
    m = _LANG_TAG_RE.search(raw_text)
    return m.group(1).lower() if m else None


def transcribe_audio_array(
    audio_data: bytes,
    sample_rate: int = 16000,
    channels: int = 1,
    language: str = "auto",
    allowed_languages: list[str] | None = None,
) -> list[dict[str, Any]]:
    """转录音频（PCM int16），返回文本段。

    Args:
        audio_data: WAV PCM 原始数据（16-bit signed, mono）
        sample_rate: 采样率（应为 16000）
        channels: 声道数（应为 1）
        language: 语言提示，auto / zh / en / ja / ko / yue
        allowed_languages: 语言白名单（zh/en/ja/ko/yue）。auto 检测出
            白名单外的语言时丢弃该段；为 None 或空则不限制。

    Returns:
        转录结果列表，每项含 text。**不含时间戳**——句子边界与时间戳
        由调用方（场景层）的 VAD 分段决定。
    """
    global _asr_model

    if not _model_initialized:
        init_asr_model()

    if _asr_model is None:
        logger.warning("ASR model not available, returning empty result")
        return []

    try:
        import numpy as np

        audio_np = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0

        # SenseVoice ONNX 推理：withitn 启用内建标点（ITN）
        raw = _asr_model(audio_np, language=language, textnorm="withitn")

        segments = []
        for item in raw:
            raw_text = str(item)
            # 语言白名单过滤：auto 模式带语言标签，检出白名单外语言则丢弃
            if allowed_languages:
                detected = _detect_language(raw_text)
                if detected and detected not in allowed_languages:
                    continue
            text = _clean_rich_text(raw_text)
            if text:
                segments.append({"text": text})

        return segments
    except Exception as e:
        logger.error("ASR transcription failed: %s", e)
        return []
