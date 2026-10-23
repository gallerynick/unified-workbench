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

import numpy as np
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

_diarization: dict[int, Any] = {}
_import_error: str | None = None


def _get_diarization(num_speakers: int | None = None, threshold: float = 0.5):
    """惰性初始化 sherpa-onnx 说话人分离器；失败时缓存错误信息。

    num_speakers 已知时传给聚类（num_clusters=N），分得更准；
    threshold 为聚类相似度阈值（越大越容易合并，簇越少）。
    不同参数组合各自缓存实例（数量有限）。
    """
    global _diarization, _import_error
    key = (
        num_speakers if num_speakers and num_speakers > 0 else 0,
        round(threshold, 2),
    )
    if key in _diarization:
        return _diarization[key]
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
            num_clusters=key[0] if key[0] > 0 else -1,  # 已知人数用固定 N，否则自动
            threshold=threshold,
        ),
        min_duration_on=0.3,
        min_duration_off=0.5,
    )
    if not config.validate():
        _import_error = "说话人分离配置校验失败"
        raise RuntimeError(_import_error)

    _diarization[key] = sherpa_onnx.OfflineSpeakerDiarization(config)
    logger.info(
        "sherpa-onnx 说话人分离器已初始化（num_speakers=%s, threshold=%.2f）",
        key[0] or "auto",
        threshold,
    )
    return _diarization[key]


def diarize_speakers(
    audio_path: str,
    num_speakers: int | None = None,
) -> list[dict[str, Any]]:
    """对音频做说话人分离，返回带时间戳的说话人段。

    Args:
        audio_path: WAV 音频文件路径
        num_speakers: 已知说话人人数时传入（聚类按 N 分，更准）；None 自动聚类

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

    # 音量归一化：不同说话人离麦克风距离不同会导致声纹提取不稳定——
    # 远场/小声说话的短句声纹会漂移到与大声说话人相近的向量空间，
    # 聚类时全合并成 1 个簇（实测：说话人1 max_amp=32767、说话人2 只有 6416）。
    # 归一化到 -3dB 峰值后再提取声纹，让小声说话也能被正确区分。
    peak = float(np.max(np.abs(audio)))
    if peak > 0:
        audio = audio * (0.7 / peak)

    # 聚类阈值：sherpa 的 threshold 越大越容易合并（簇越少）。
    # 实测调参记录：
    #  · 2 人 136s 对谈：0.5→9 簇（过度分裂）、0.95→3 簇
    #  · 2 人 30s 近/远场对谈：0.5~0.9 能分出两人，0.95 把远场
    #    说话人误并到近场（单麦克风下远场声纹更弱，阈值过高会吞掉）
    # 取 0.8：两侧都能正确分出人，过度分裂由碎片归并兜底。
    threshold = 0.5 if num_speakers else 0.8

    try:
        sd = _get_diarization(num_speakers, threshold)
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

    segments = [
        {
            "start_time": float(item.start) * 1000,
            "end_time": float(item.end) * 1000,
            "spk": int(item.speaker),
        }
        for item in result
    ]

    return _merge_fragment_speakers(segments)


# 碎片簇归并：总时长过短的说话人簇不是真实的人——同一个人的短句
# （如应答「嗯」「对」）声纹不稳定，聚类时会漂成独立小簇（实测 2 人
# 对谈出现 1.1s 的第三「人」）。把碎片簇并入时间上最接近的主簇。
_FRAGMENT_SPEAKER_SECONDS = 30.0


def _merge_fragment_speakers(
    segments: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """把总时长 < _FRAGMENT_SPEAKER_SECONDS 的簇并入最近的主簇。

    归并策略：取该碎片簇的全部段，逐段找时间上（按段中点）最近的
    "主簇段"，把 spk 改成那条段的 spk。主簇 = 总时长达标的簇。
    全部都是碎片时（极短音频）原样返回，避免无意义合并。
    """
    if not segments:
        return segments

    # segments 的时间戳是毫秒（见 diarize_speakers 的换算）
    totals: dict[int, float] = {}
    for seg in segments:
        totals[seg["spk"]] = (
            totals.get(seg["spk"], 0.0) + (seg["end_time"] - seg["start_time"])
        )
    # 碎片判定用相对值：时长 < 最大簇的 15% 或 <3 秒（取严格者）。
    # 绝对值阈值（如 30s）在短会议里会把正常说话人也判成碎片全合并成 1 人；
    # 相对值让短会议的两个主簇（各 7-10s）保留，只合并真正碎的声纹漂移。
    max_dur = max(totals.values()) if totals else 0.0
    fragment_limit_ms = max(0, min(max_dur * 0.15, _FRAGMENT_SPEAKER_SECONDS * 1000))
    fragments = {spk for spk, d in totals.items() if d < fragment_limit_ms}
    if not fragments or len(totals) - len(fragments) < 1:
        return segments

    main_segs = [s for s in segments if s["spk"] not in fragments]

    def _nearest_main_spk(mid_ms: float) -> int:
        best = main_segs[0]["spk"]
        best_dist = float("inf")
        for s in main_segs:
            dist = abs((s["start_time"] + s["end_time"]) / 2 - mid_ms)
            if dist < best_dist:
                best_dist = dist
                best = s["spk"]
        return best

    merged: list[dict[str, Any]] = []
    for seg in segments:
        if seg["spk"] in fragments:
            mid = (seg["start_time"] + seg["end_time"]) / 2
            seg = {**seg, "spk": _nearest_main_spk(mid)}
        merged.append(seg)
    # spk 编号可能出现空洞（如 0,2,4），不影响上层：_transcribe_by_speakers
    # 会做「spk → 说话人N」的连续重编号
    return merged


# ---------------------------------------------------------------------------
# 模型自举：校验 + 缺失时下载（首次部署约 40MB，之后命中校验直接跳过）
# ---------------------------------------------------------------------------
# 之前模型靠手工放进命名卷，缺失时只有一句 RuntimeError 进日志、界面上什么都
# 看不到——用户只能自己去翻日志再手工下载。这里把「校验 → 下载 → 再校验」做成
# 代码，并通过 on_progress 把状态推到会议处理阶段（前端可见）。
_MODEL_SPECS: list[dict[str, Any]] = [
    {
        "path": _SEGMENTATION_MODEL,
        "url": (
            "https://huggingface.co/csukuangfj/"
            "sherpa-onnx-pyannote-segmentation-3-0/resolve/main/model.int8.onnx"
        ),
        "size": 1540506,
        "label": "说话人分割模型",
    },
    {
        "path": _EMBEDDING_MODEL,
        "url": (
            "https://github.com/k2-fsa/sherpa-onnx/releases/download/"
            "speaker-recongition-models/"
            "3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx"
        ),
        "size": 39593761,
        "label": "声纹嵌入模型",
    },
]


def _file_matches(spec: dict[str, Any]) -> bool:
    """按字节数校验（上游未提供 sha256，content-length 与实际字节数一致）。"""
    path = spec["path"]
    try:
        return os.path.isfile(path) and os.path.getsize(path) == spec["size"]
    except OSError:
        return False


def _download(spec: dict[str, Any], on_progress=None) -> None:
    """下载到 .part 再原子改名：中断不会留下「看起来存在但内容不全」的文件。"""
    import urllib.request

    path = spec["path"]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    part = path + ".part"
    label = spec["label"]
    logger.info("开始下载%s：%s", label, spec["url"])
    if on_progress:
        on_progress(f"正在下载{label}")
    req = urllib.request.Request(spec["url"], headers={"User-Agent": "unified-workbench"})
    with urllib.request.urlopen(req, timeout=120) as resp, open(part, "wb") as fh:
        expected = int(resp.headers.get("Content-Length") or spec["size"])
        done = 0
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            fh.write(chunk)
            done += len(chunk)
            if expected and done % (8 << 20) < (1 << 20):
                logger.info("%s 下载中：%.1f/%.1f MB", label, done / 1048576, expected / 1048576)
    size = os.path.getsize(part)
    if size != spec["size"]:
        os.remove(part)
        raise RuntimeError(f"{label}下载不完整（{size} != {spec['size']} 字节）")
    os.replace(part, path)
    logger.info("%s下载完成并校验通过：%s（%d 字节）", label, path, size)


def verify_models() -> tuple[bool, str]:
    """校验模型文件是否齐全且字节数正确；不触发下载。"""
    bad = [s["label"] for s in _MODEL_SPECS if not _file_matches(s)]
    if bad:
        return False, "、".join(bad) + "缺失或不完整"
    return True, ""


def ensure_models(on_progress=None) -> tuple[bool, str]:
    """确保声纹模型可用：先校验，缺了就下载再校验，最后试建一次分离器。

    Returns:
        (是否可用, 失败原因或空串)
    """
    for spec in _MODEL_SPECS:
        if _file_matches(spec):
            continue
        try:
            _download(spec, on_progress=on_progress)
        except Exception as exc:
            logger.error("%s下载失败：%s", spec["label"], exc)
            return False, f"{spec['label']}下载失败：{exc}"

    ok, msg = verify_models()
    if not ok:
        return False, msg

    try:
        # 试建分离器：能建出来且 validate 通过，才说明模型真的能被 onnxruntime 加载
        _get_diarization(None, 0.95)
    except Exception as exc:
        logger.error("声纹模型加载失败：%s", exc)
        return False, f"声纹模型加载失败：{exc}"
    return True, ""



_download_lock: dict[str, Any] = {"running": False, "message": ""}


def model_status() -> dict[str, Any]:
    """声纹模型状态（供前端展示「为什么没区分说话人」并提供一键下载）。"""
    models = []
    for spec in _MODEL_SPECS:
        path = spec["path"]
        try:
            actual = os.path.getsize(path) if os.path.isfile(path) else 0
        except OSError:
            actual = 0
        models.append(
            {
                "label": spec["label"],
                "path": path,
                "present": actual == spec["size"],
                "bytes": actual,
                "expected_bytes": spec["size"],
            }
        )
    ok, msg = verify_models()
    return {
        "available": ok,
        "reason": "" if ok else msg,
        "downloading": bool(_download_lock["running"]),
        "message": str(_download_lock["message"] or ""),
        "models": models,
    }


def ensure_models_downloading(on_progress=None) -> tuple[bool, str]:
    """带重入保护的 ensure_models：同一时刻只允许一个下载在跑。"""
    if _download_lock["running"]:
        return False, "声纹模型正在下载中"
    _download_lock["running"] = True
    _download_lock["message"] = "正在校验声纹模型"

    def _progress(text: str) -> None:
        _download_lock["message"] = text
        if on_progress:
            on_progress(text)

    try:
        ok, msg = ensure_models(on_progress=_progress)
        _download_lock["message"] = "声纹模型就绪" if ok else msg
        return ok, msg
    finally:
        _download_lock["running"] = False

