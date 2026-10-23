"""会后处理 Celery 任务。

会议结束后自动执行：转录、纪要生成、状态落库。

与其他 Celery 任务保持一致的写法：同步 task 用 `asyncio.run` 驱动异步实现，
内部用 `async with isolated_session()` 取任务专用独立引擎。
（`isolated_session` 是 `@asynccontextmanager`，不能直接用于同步 `with`。）
"""

from __future__ import annotations

import asyncio
import bisect
import logging
import os
import uuid
from typing import Any

from celery import shared_task
from sqlalchemy import delete, select

from app.core.database import isolated_session
from app.models.meeting_minutes import MeetingMinutes
from app.models.meeting_record import MeetingRecord
from app.models.meeting_transcript_segment import MeetingTranscriptSegment
from app.services.meeting_minutes import generate_minutes
from app.utils.timeutil import now_shanghai

logger = logging.getLogger(__name__)


def _build_minutes_meta(
    meeting: MeetingRecord,
    segments: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """从会议记录提取纪要生成所需的元信息（全字段可缺失）。

    participants 会并入分离出的说话人标签（如"说话人1"），
    作为负责人取值白名单，缺省时仅会议创建者。
    """
    meta: dict[str, Any] = {}
    if meeting.title:
        meta["title"] = meeting.title

    ref_time = meeting.started_at or meeting.ended_at
    if ref_time is not None:
        meta["date"] = ref_time.strftime("%Y-%m-%d")

    participants: list[str] = []
    try:
        owner = meeting.owner
    except Exception:
        owner = None
    if owner is not None:
        name = getattr(owner, "nickname", None) or getattr(owner, "username", None)
        if name:
            participants.append(str(name))

    seen: set[str] = set(participants)
    for seg in segments or []:
        spk = str(seg.get("speaker") or "").strip()
        if spk and spk not in seen:
            seen.add(spk)
            participants.append(spk)
    if participants:
        meta["participants"] = participants

    if meeting.notes:
        meta["notes"] = meeting.notes
    return meta


async def _load_segments_with_speaker(
    db: Any,
    meeting_id: uuid.UUID,
) -> list[dict[str, Any]]:
    """按 seq 读取已入库转录段并附带 speaker 字段。

    说话人分离成功后调用；任一环节失败返回空列表，由调用方回退。
    """
    try:
        result = await db.execute(
            select(MeetingTranscriptSegment)
            .where(MeetingTranscriptSegment.meeting_id == meeting_id)
            .order_by(MeetingTranscriptSegment.seq)
        )
        rows = list(result.scalars().all())
        return [
            {
                "text": seg.text,
                "start_ms": seg.audio_start_ms,
                "end_ms": seg.audio_end_ms,
                "speaker": seg.speaker,
            }
            for seg in rows
            if seg.text
        ]
    except Exception as exc:
        logger.warning("读取带说话人的转录段失败：%s", exc)
        return []


# 说话人分离覆盖率下限：分离检出的语音总时长 / 音频总时长。
# 低于该值说明分离严重漏检（实测出现过 22 秒音频只检出 0.7 秒），
# 此时不能依赖「按说话人轮次转写」，否则内容会几乎全部丢失。
_DIARIZATION_MIN_COVERAGE = 0.2


def _diarization_coverage(
    diarization: list[dict[str, Any]] | None,
    audio_seconds: float,
) -> float:
    """说话人分离的语音覆盖率（0~1）；无法计算时返回 0。"""
    if not diarization or audio_seconds <= 0:
        return 0.0
    total_ms = sum(t["end_time"] - t["start_time"] for t in diarization)
    return min(1.0, total_ms / 1000 / audio_seconds)


# 共尝试 5 次（初始 1 次 + 最多 4 次重试），仍失败则 minutes_status=failed 由前端提示
@shared_task(bind=True, max_retries=4, default_retry_delay=60)
def process_meeting(self, meeting_id: str) -> dict[str, Any]:
    """会后处理任务入口（同步签名，内部转异步执行）。"""
    return asyncio.run(_process_meeting_async(self, meeting_id))


async def _process_meeting_async(self, meeting_id: str) -> dict[str, Any]:
    """会后处理任务主体。

    1. 对音频文件执行批量转录
    2. 生成会议纪要
    3. 保存转录段与纪要，更新会议状态
    """
    meeting_uuid = uuid.UUID(meeting_id)

    try:
        async with isolated_session() as db:
            result = await db.execute(
                select(MeetingRecord).where(MeetingRecord.id == meeting_uuid)
            )
            meeting = result.scalar_one_or_none()

            if not meeting:
                logger.error(f"Meeting {meeting_id} not found")
                return {"status": "error", "message": "Meeting not found"}

            logger.info(f"Starting post-processing for meeting {meeting_id}")

            # 语言白名单
            allowed_languages = None
            try:
                from app.services.third_party_config import get_third_party_config

                params = (await get_third_party_config(db)).asr_config.parameters or {}
                raw_langs = params.get("allowed_languages")
                if isinstance(raw_langs, list) and raw_langs:
                    allowed_languages = [str(x).lower() for x in raw_langs]
            except Exception:
                pass

            async def _set_stage(stage: str | None) -> None:
                """更新处理后处理阶段提示（前端会议页可见）。"""
                if meeting.processing_stage != stage:
                    meeting.processing_stage = stage
                    await db.commit()

            # 阶段 1: 说话人分离（优先，独立子进程跑，避免 ORT 污染）——
            # 用户原则：先区分讲话人，再按讲话人分句。
            diarization_result: list[dict[str, Any]] | None = None
            if meeting.audio_file_path:
                # 声纹模型自检：缺失/不完整时自动下载并校验（首次约 40MB）。
                # 校验不过（下载失败/走不通网络）就明确标记 failed 并跳过分离，
                # 界面会显示「本次未区分说话人」，不再静默降级。
                from app.services.speaker_diarization import ensure_models

                await _set_stage("正在校验声纹模型")
                models_ok, models_err = await asyncio.to_thread(ensure_models)
                if not models_ok:
                    logger.error("声纹模型不可用，跳过说话人分离：%s", models_err)
                    diarization_result = None
                    meeting.diarization_status = "failed"
                    await db.commit()
                else:
                    await _set_stage("正在区分讲话人")
                    # 预期人数已知（>1）时按人数聚类（更准）；空/1 时自动聚类
                    exp = meeting.expected_speakers
                    num_speakers = exp if exp and exp > 1 else None
                    diarization_result = await asyncio.to_thread(
                        _diarize_isolated, meeting.audio_file_path, num_speakers
                    )
                    meeting.diarization_status = (
                        "done" if diarization_result else "failed"
                    )
                    await db.commit()

            # 阶段 2: 转写。
            # **内容优先于标签**：说话人分离可能严重漏检（实测 22 秒音频
            # 只检出 0.7 秒语音），此时若仍按说话人轮次转写，会几乎产不出
            # 任何内容——用户看到的是「会后处理完成但只有实时那一条」。
            # 因此先判断分离覆盖率：太低就退回整段 VAD 转写保内容，
            # 说话人标签留给用户在会议页「指定人数重新区分」。
            await _set_stage("正在转写")
            from app.utils.timeutil import wav_duration_seconds

            audio_seconds = wav_duration_seconds(meeting.audio_file_path) or 0.0
            coverage = _diarization_coverage(diarization_result, audio_seconds)

            if diarization_result and coverage >= _DIARIZATION_MIN_COVERAGE:
                segments_data = _transcribe_by_speakers(
                    meeting, allowed_languages, diarization_result
                )
                replace_existing = False
            else:
                if diarization_result:
                    logger.warning(
                        "说话人分离覆盖率仅 %.0f%%（检出 %.1fs / 音频 %.1fs），"
                        "回退整段转写以保证内容完整",
                        coverage * 100,
                        sum(
                            t["end_time"] - t["start_time"]
                            for t in diarization_result
                        ) / 1000,
                        audio_seconds,
                    )
                    meeting.diarization_status = "failed"
                    await db.commit()
                segments_data = _transcribe_audio(meeting, allowed_languages)
                # 整段转写是完整版本，替换实时残留段，避免新旧内容重复显示
                replace_existing = True

            # 阶段 3: 转录段落库
            await _save_transcript_segments(
                db,
                meeting_uuid,
                segments_data,
                allowed_languages,
                replace_existing=replace_existing,
            )

            # 阶段 4: 生成纪要（输入直接带说话人，无需再匹配）
            await _set_stage("正在生成纪要")
            minutes_input = segments_data
            meeting_meta = _build_minutes_meta(meeting, minutes_input)
            minutes_data, model_used = await generate_minutes(
                minutes_input, meeting_meta=meeting_meta
            )
            await _save_minutes(db, meeting_uuid, minutes_data, model_used)

            # 完成
            meeting.status = "completed"
            meeting.minutes_status = "done"
            meeting.processing_stage = None
            # 时长以实际录音时长为准（中途离开/暂停的空白不计入）
            from app.utils.timeutil import wav_duration_seconds

            audio_duration = wav_duration_seconds(meeting.audio_file_path)
            if audio_duration is not None:
                meeting.duration_seconds = audio_duration
            elif meeting.started_at and meeting.ended_at:
                meeting.duration_seconds = int(
                    (meeting.ended_at - meeting.started_at).total_seconds()
                )

            await db.commit()

            logger.info(
                f"Post-processing completed for meeting {meeting_id}: "
                f"{len(segments_data)} segments, minutes generated"
            )

            return {
                "status": "success",
                "meeting_id": meeting_id,
                "segments_count": len(segments_data),
                "minutes_summary_length": len(minutes_data.get("summary", "")),
            }

    except Exception as e:
        logger.error(f"Post-processing failed for meeting {meeting_id}: {e}")

        async with isolated_session() as db:
            result = await db.execute(
                select(MeetingRecord).where(MeetingRecord.id == meeting_uuid)
            )
            meeting = result.scalar_one_or_none()
            if meeting:
                meeting.minutes_status = "failed"
                meeting.processing_stage = None
                meeting.status = "completed"
                await db.commit()

        # 重试
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=60)

        return {"status": "error", "message": str(e)}


def _transcribe_audio(
    meeting: MeetingRecord,
    allowed_languages: list[str] | None = None,
) -> list[dict[str, Any]]:
    """转录音频文件，返回带时间戳的文本段列表。

    SenseVoice ONNX 不输出时间戳，句子边界由 webrtcvad（纯 C，无
    onnxruntime session）提供：先切句，再逐句转写。webrtcvad 与
    SenseVoice 并存不会像两个 ORT session 那样触发 VM 内存 OOM。
    """
    audio_path = meeting.audio_file_path

    if not audio_path or not os.path.exists(audio_path):
        logger.warning("Audio file not found: %s", audio_path)
        return []

    try:
        import soundfile as sf

        from app.services.asr_engine import (
            init_asr_model,
            segment_audio,
            transcribe_audio_array,
        )

        audio, sample_rate = sf.read(audio_path, dtype="float32", always_2d=True)
        audio = audio[:, 0]
        if sample_rate != 16000:
            import librosa

            audio = librosa.resample(audio, orig_sr=sample_rate, target_sr=16000)
            sample_rate = 16000

        # 阶段 1：webrtcvad 切句（无 ORT session）。
        # 离线整段转写没有实时压力，单段上限放大到 30s：SenseVoice 是
        # 上下文敏感模型，实测同一段话整段识别（30s）质量明显优于
        # 硬切成 15s 两段（「验收成功」整段出对、切开全乱）。
        voiced = segment_audio(audio, sample_rate, silence_timeout=0.6, max_duration=30.0)

        # 阶段 2：ASR 逐句转写（SenseVoice ONNX 单 session）
        init_asr_model()
        segments: list[dict[str, Any]] = []
        for start_ms, seg_bytes in voiced:
            text_segments = transcribe_audio_array(
                seg_bytes,
                16000,
                1,
                allowed_languages=allowed_languages,
            )
            seg_dur_ms = int(len(seg_bytes) / 32)  # 16k int16 = 2 bytes/采样
            for seg in text_segments:
                segments.append({
                    "text": seg.get("text", ""),
                    "start_ms": start_ms,
                    "end_ms": start_ms + seg_dur_ms,
                })

        logger.info("Transcribed %d segments from audio", len(segments))
        return segments

    except Exception as e:
        logger.error("Audio transcription failed: %s", e)
        return []


async def _save_transcript_segments(
    db: Any,
    meeting_id: uuid.UUID,
    segments: list[dict[str, Any]],
    allowed_languages: list[str] | None = None,
    replace_existing: bool = False,
) -> None:
    """保存转录段：会后转录为权威，清除实时无说话人的旧段（async）。

    实时转录先写库（speaker=NULL），会后完整重转录带说话人。
    会后转写成功（带说话人）时清除该会议全部旧段并写入新段：
    实时 NULL 段是新版本的子集，带 speaker 的旧段只可能来自上一次会后转写，
    保留会出现「说话人1~29」新旧编号混存。
    说话人分离失败（新段均无 speaker）时不清除实时段，避免转录内容全丢。
    """
    # 清除历史遗留的脏段：
    # 1) speaker NULL 的实时段——会后转录是带说话人的权威版本，
    #    NULL 段会导致「说话人」与「说话人N」并存；
    #    仅当本次会后转写确实带说话人时清除；若说话人分离失败
    #    （segments 均无 speaker），则保留实时 NULL 段，避免转录内容全部丢失。
    # 2) 含日文假名的段（无论 speaker 是否有值）——白名单不含日语时，
    #    历史遗留的日语段必须一并清除，保证重跑自动清理。
    has_speaker_today = any(
        seg.get("speaker") for seg in segments
    )
    # replace_existing：本次是「整段转写」的完整版本（回退路径），
    # 即便新段没有说话人也要替换旧段——否则实时残留段会和新内容重复显示。
    if replace_existing:
        has_speaker_today = True
    if has_speaker_today:
        # 会后转写带说话人时，删除该会议**全部**旧段：
        # 实时段（speaker=NULL）是新版本的子集，而带 speaker 的旧段必然来自
        # 上一次会后转写（重跑/改了聚类参数）——不删会和本次的「说话人N」
        # 编号交叉，出现「说话人1~29」这种新旧混存的错觉。
        await db.execute(
            delete(MeetingTranscriptSegment)
            .where(MeetingTranscriptSegment.meeting_id == meeting_id)
        )

    # 白名单不含日语时，清历史日语段（含平假名/片假名）
    ja_not_allowed = not allowed_languages or "ja" not in (allowed_languages or [])
    if ja_not_allowed:
        await db.execute(
            delete(MeetingTranscriptSegment)
            .where(
                MeetingTranscriptSegment.meeting_id == meeting_id,
                MeetingTranscriptSegment.text.regexp_match("[぀-ヿ]"),
            )
        )

    # 读取已有转录段
    existing_result = await db.execute(
        select(MeetingTranscriptSegment)
        .where(MeetingTranscriptSegment.meeting_id == meeting_id)
        .order_by(MeetingTranscriptSegment.seq)
    )
    existing = list(existing_result.scalars().all())
    # 已有段索引：文本规范化后按起始时间戳排序，便于区间内查重
    # 同一句在实时/会后转录中因 VAD 边界差异，时间戳可能偏移数百毫秒，
    # 因此「文本相同 && 时间戳相差 <= 1000ms」视为同一句，避免重复插入。
    existing_by_text: dict[str, list[int]] = {}
    for seg in existing:
        text = (seg.text or "").strip()
        existing_by_text.setdefault(text, []).append(seg.audio_start_ms)
    for timestamps in existing_by_text.values():
        timestamps.sort()

    next_seq = max((seg.seq for seg in existing), default=-1) + 1

    for seg in segments:
        start_ms = int(seg.get("start_ms", 0) or 0)
        text = str(seg.get("text", "") or "").strip()
        if not text:
            continue
        ts_list = existing_by_text.get(text)
        if ts_list is not None:
            idx = bisect.bisect_left(ts_list, start_ms)
            near = (
                (idx < len(ts_list) and abs(ts_list[idx] - start_ms) <= 1000)
                or (idx > 0 and abs(ts_list[idx - 1] - start_ms) <= 1000)
            )
            if near:
                continue  # 与已有段同文本且时间接近：视为同一句
            # 记录新段时间戳，供后续同句继续判重
            bisect.insort(ts_list, start_ms)
        else:
            existing_by_text[text] = [start_ms]
        db.add(
            MeetingTranscriptSegment(
                id=uuid.uuid4(),
                meeting_id=meeting_id,
                seq=next_seq,
                text=text,
                audio_start_ms=start_ms,
                audio_end_ms=seg.get("end_ms"),
                speaker=seg.get("speaker"),
            )
        )
        next_seq += 1


async def _save_minutes(
    db: Any,
    meeting_id: uuid.UUID,
    minutes_data: dict[str, Any],
    model_used: str,
) -> None:
    """保存纪要到数据库（async：db 是 AsyncSession，execute 必须 await）。"""
    # 检查是否已有纪要
    result = await db.execute(
        select(MeetingMinutes).where(MeetingMinutes.meeting_id == meeting_id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        # 更新现有记录
        existing.summary = minutes_data.get("summary", "")
        existing.key_points = minutes_data.get("key_points", [])
        existing.todos = minutes_data.get("todos", [])
        existing.model_used = model_used
        existing.generated_at = now_shanghai()
    else:
        # 创建新记录
        db.add(
            MeetingMinutes(
                id=uuid.uuid4(),
                meeting_id=meeting_id,
                summary=minutes_data.get("summary", ""),
                key_points=minutes_data.get("key_points", []),
                todos=minutes_data.get("todos", []),
                model_used=model_used,
                generated_at=now_shanghai(),
            )
        )


def _diarize_isolated(
    audio_file_path: str,
    num_speakers: int | None = None,
) -> list[dict[str, Any]] | None:
    """独立子进程跑说话人分离（干净解释器）。

    同进程加载过 SenseVoice 的 onnxruntime 后，pyannote 分割会卡死（ORT 进程级
    状态污染，shutdown session 也不够）——必须用独立进程，父进程的 SenseVoice
    完全不受影响。
    """
    import json
    import subprocess
    import sys

    snippet = (
        "from app.services.speaker_diarization import diarize_speakers;"
        "import json,sys;"
        "n=int(sys.argv[2]) if sys.argv[2] else None;"
        "print(json.dumps(diarize_speakers(sys.argv[1], num_speakers=n)))"
    )
    try:
        # 说话人分离是 CPU 密集任务：35 分钟音频实测约 293s，1 小时会议约 8-10 分钟。
        # 旧值 240s 会把长会议的子进程直接杀掉 → 全部转录变「说话人?」。
        # 30 分钟上限足以覆盖 1 小时会议，同时远低于 Celery 任务 1 小时时限。
        proc = subprocess.run(
            [sys.executable, "-c", snippet, audio_file_path, str(num_speakers or "")],
            capture_output=True,
            text=True,
            timeout=1800,
            cwd="/app",
            env={**os.environ, "PYTHONPATH": "/app", "MODELSCOPE_CACHE": "/home/workbench/.modelscope"},
        )
        if proc.returncode != 0:
            logger.error("说话人分离子进程失败：%s", proc.stderr[-300:])
            return None
        # M11：stdout 可能混入 sherpa/onnxruntime 的 warning 行——
        # 不再假设「最后一行就是 JSON」，倒序扫描找首个可解析的 JSON 行。
        # 注意空结果 json.dumps([]) 打印为 "[]"，须同时接受数组形态。
        out_lines = [ln for ln in proc.stdout.strip().splitlines() if ln.strip()]
        for ln in reversed(out_lines):
            first = ln.lstrip()[0:1]
            if first in ("{", "["):
                try:
                    return json.loads(ln)
                except json.JSONDecodeError:
                    continue
        logger.error("说话人分离子进程输出无 JSON：%s", proc.stdout[-300:])
        return None
    except Exception as exc:
        logger.error("说话人分离子进程异常：%s", exc)
        return None


def _transcribe_by_speakers(
    meeting: MeetingRecord,
    allowed_languages: list[str] | None,
    diarization: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """按说话人段转写：**先区分说话人，再分句**。

    对每个说话人轮次取对应音频段：短段整段转写（一句），长段用 webrtcvad 细分
    后再逐句转写。句子直接带上说话人标签，句子边界以完整音频的说话人轮次为准
    （实时 VAD 的分句错误不再传导到最终结果）。
    """
    import os

    import numpy as np
    import soundfile as sf

    from app.services import asr_engine

    audio_path = meeting.audio_file_path
    if not audio_path or not os.path.exists(audio_path):
        logger.warning("音频不存在：%s", audio_path)
        return []

    audio, sample_rate = sf.read(audio_path, dtype="float32", always_2d=True)
    audio = audio[:, 0]
    if sample_rate != 16000:
        import librosa

        audio = librosa.resample(audio, orig_sr=sample_rate, target_sr=16000)
        sample_rate = 16000

    asr_engine.init_asr_model()

    # spk 编号到「说话人N」的连续映射（sherpa 聚类编号可能不连续）
    spk_names = {}
    spk_i = 0
    for d in sorted(diarization, key=lambda x: x["start_time"]):
        spk = int(d["spk"])
        if spk not in spk_names:
            spk_i += 1
            spk_names[spk] = f"说话人{spk_i}"

    segments: list[dict[str, Any]] = []
    for d in sorted(diarization, key=lambda x: x["start_time"]):
        start_ms = max(0, int(d["start_time"]))
        end_ms = int(d["end_time"])
        spk = int(d["spk"])
        si = min(int(start_ms / 1000 * sample_rate), len(audio))
        ei = min(int(end_ms / 1000 * sample_rate), len(audio))
        if ei <= si:
            continue
        chunk = audio[si:ei]
        dur = (ei - si) / sample_rate
        if dur < 0.3:
            continue

        if dur <= 15:
            blocks = [(start_ms, (chunk * 32768).astype(np.int16).tobytes(), int(dur * 1000))]
        else:
            # 长轮次：webrtcvad 细分（说话人优先 → 轮次内再分句）
            voiced = asr_engine.segment_audio(chunk, sample_rate, silence_timeout=0.6, max_duration=30.0)
            blocks = [(start_ms + off, b, len(b) // 32) for off, b in voiced]

        for bstart, bbytes, bdur_ms in blocks:
            texts = asr_engine.transcribe_audio_array(
                bbytes,
                16000,
                1,
                allowed_languages=allowed_languages,
            )
            for seg in texts:
                segments.append({
                    "text": seg["text"],
                    "start_ms": bstart,
                    "end_ms": bstart + bdur_ms,
                    "speaker": spk_names[spk],
                })
    return segments


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def regenerate_minutes_task(self, meeting_id: str) -> dict[str, Any]:
    """手动重新生成纪要：用现有转录段（含说话人名）重新调用模型生成。

    异步执行，避免请求线程阻塞在模型推理上（本地 3B 一次生成 30~120s）。
    不重跑转写/说话人分离，保留用户改过的说话人名。
    """
    return asyncio.run(_regenerate_minutes_async(self, meeting_id))


async def _regenerate_minutes_async(self, meeting_id: str) -> dict[str, Any]:
    meeting_uuid = uuid.UUID(meeting_id)
    try:
        async with isolated_session() as db:
            result = await db.execute(
                select(MeetingRecord).where(MeetingRecord.id == meeting_uuid)
            )
            meeting = result.scalar_one_or_none()
            if not meeting:
                logger.error(f"Meeting {meeting_id} not found for regenerate")
                return {"status": "error", "message": "Meeting not found"}

            logger.info(f"Regenerating minutes for meeting {meeting_id}")

            # 读取现有转录段（带说话人）
            seg_result = await db.execute(
                select(MeetingTranscriptSegment)
                .where(MeetingTranscriptSegment.meeting_id == meeting_uuid)
                .order_by(MeetingTranscriptSegment.seq)
            )
            segs = list(seg_result.scalars().all())
            minutes_input = [
                {
                    "text": s.text,
                    "start_ms": s.audio_start_ms,
                    "end_ms": s.audio_end_ms,
                    "speaker": s.speaker,
                }
                for s in segs
                if s.text
            ]

            meeting_meta = _build_minutes_meta(meeting, minutes_input)
            minutes_data, model_used = await generate_minutes(
                minutes_input, meeting_meta=meeting_meta
            )
            await _save_minutes(db, meeting_uuid, minutes_data, model_used)

            meeting.minutes_status = "done"
            meeting.status = "completed"
            meeting.processing_stage = None
            await db.commit()

            logger.info(
                f"Minutes regenerated for meeting {meeting_id}: "
                f"summary_len={len(minutes_data.get('summary', ''))}"
            )
            return {
                "status": "success",
                "meeting_id": meeting_id,
                "minutes_summary_length": len(minutes_data.get("summary", "")),
            }
    except Exception as e:
        logger.error(f"Minutes regeneration failed for meeting {meeting_id}: {e}")
        async with isolated_session() as db:
            result = await db.execute(
                select(MeetingRecord).where(MeetingRecord.id == meeting_uuid)
            )
            meeting = result.scalar_one_or_none()
            if meeting:
                meeting.minutes_status = "failed"
                meeting.status = "completed"
                meeting.processing_stage = None
                await db.commit()
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=30)
        return {"status": "error", "message": str(e)}

