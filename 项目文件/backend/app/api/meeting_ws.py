"""会议音频流 WebSocket 端点。

接收前端发送的音频块，进行实时转录，并返回转录结果。
支持音频文件写入、暂停/恢复、结束会议时的文件保存。
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import struct
import threading
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from app.core.config import get_settings
from app.core.database import get_session_factory
from app.models.meeting_record import MeetingRecord
from app.models.user import User
from app.services.meeting_record import get_meeting_record

# 尝试导入 ASR 相关依赖
try:
    import numpy as np

    from app.services.asr_engine import (
        init_asr_model,
        is_available as asr_is_available,
        transcribe_audio_array,
        vad_is_speech,
    )
    ASR_AVAILABLE = True
except ImportError as e:
    np = None
    init_asr_model = None
    asr_is_available = lambda: False
    transcribe_audio_array = None
    vad_is_speech = lambda frame, sr=16000: False
    ASR_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning(f"ASR dependencies not available: {e}")

logger = logging.getLogger(__name__)

def _log_ws_send_error(fut: asyncio.Future) -> None:
    """后台线程发送 WebSocket 消息的结果回调。

    run_coroutine_threadsafe 返回的 Future 若无人取结果，异常会被静默丢弃，
    表现为「转录成功了但前端收不到片段」且无任何日志。这里统一兜底记录。
    """
    try:
        exc = fut.exception()
    except asyncio.CancelledError:
        return
    if exc is not None:
        logger.error(f"WebSocket 消息发送失败: {exc}")




def _send_transcript_segment(
    websocket: WebSocket,
    loop: asyncio.AbstractEventLoop,
    seq: int,
    text: str,
    start_ms: int,
    end_ms: int | None,
) -> None:
    """在后台线程里把一句转录片段送回 WebSocket。

    单独抽出是为了避免在深层嵌套的转录回调里内联构造消息，也避免行宽超限。
    """
    future = asyncio.run_coroutine_threadsafe(
        websocket.send_json({
            "type": "transcript_segment",
            "data": {
                "seq": seq,
                "text": text,
                "audio_start_ms": start_ms,
                "audio_end_ms": end_ms,
                "speaker": None,
            },
        }),
        loop,
    )
    future.add_done_callback(_log_ws_send_error)
# 会议 WebSocket 连接跟踪（防止多人同时进入）
_ws_connections: dict[uuid.UUID, set[uuid.UUID]] = {}  # meeting_id -> set of user_ids
_ws_lock = threading.Lock()
_ws_owner_connections: dict[uuid.UUID, dict[uuid.UUID, uuid.UUID]] = {}  # meeting_id -> {user_id: connection_id}
_ws_active_sockets: dict[uuid.UUID, dict[uuid.UUID, WebSocket]] = {}  # meeting_id -> {connection_id: websocket}

# ── 句子切分（VAD 活性检测）────────────────────────────────────
# 用 webrtcvad（纯 C，无 onnxruntime session）逐帧判断语音活性：
# sherpa-onnx 的 Silero VAD 与 SenseVoice 各持一个 ORT session，
# 并存会让进程内存 commit 超 Docker VM overcommit 上限被 OOM 杀掉。
# webrtcvad 零 ORT 开销，与 SenseVoice 并存安全。

router = APIRouter()

# 音频配置
SAMPLE_RATE = 16000
SAMPLE_WIDTH = 2  # 16-bit = 2 bytes
CHANNELS = 1
AUDIO_DIR = "/data/files/meetings/audio"

# 确保音频目录存在
os.makedirs(AUDIO_DIR, exist_ok=True)


def create_wav_header(num_samples: int) -> bytes:
    """创建 WAV 文件头 (44 字节)。"""
    byte_rate = SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH
    block_align = CHANNELS * SAMPLE_WIDTH
    data_size = num_samples * block_align

    header = b"RIFF"
    header += struct.pack("<I", 36 + data_size)  # RIFF chunk size
    header += b"WAVE"
    header += b"fmt "
    header += struct.pack("<I", 16)  # fmt chunk size
    header += struct.pack("<H", 1)  # PCM format
    header += struct.pack("<H", CHANNELS)
    header += struct.pack("<I", SAMPLE_RATE)
    header += struct.pack("<I", byte_rate)
    header += struct.pack("<H", block_align)
    header += struct.pack("<H", 16)  # bits per sample
    header += b"data"
    header += struct.pack("<I", data_size)

    return header


def update_wav_header(file_path: str, num_samples: int) -> None:
    """更新 WAV 文件头中的大小信息。"""
    block_align = CHANNELS * SAMPLE_WIDTH
    data_size = num_samples * block_align

    with open(file_path, "r+b") as f:
        # 更新 RIFF chunk size (offset 4)
        f.seek(4)
        f.write(struct.pack("<I", 36 + data_size))
        # 更新 data chunk size (offset 40)
        f.seek(40)
        f.write(struct.pack("<I", data_size))


async def validate_token(token: str) -> uuid.UUID | None:
    """验证 JWT token 并返回 user_id"""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None


@router.websocket("/ws/meetings/{meeting_id}")
async def meeting_audio_ws(
    websocket: WebSocket,
    meeting_id: uuid.UUID,
    token: str = None,
) -> None:
    """会议音频流 WebSocket 端点。

    接收音频块，进行实时转录，返回转录结果。
    支持暂停/恢复/结束，音频自动保存到文件。
    """
    await websocket.accept()
    logger.info(f"WebSocket connected for meeting {meeting_id}")

    # 从 query string 解析 token
    if not token:
        token = websocket.url.query
        if token.startswith("token="):
            token = token[6:]
        else:
            token = None

    # 验证 token
    user_id = await validate_token(token) if token else None
    if not user_id:
        await websocket.send_json({
            "type": "error",
            "data": {"message": "无效的访问令牌"}
        })
        await websocket.close(code=4001, reason="Invalid token")
        return

    # 获取数据库会话
    factory = get_session_factory()

    # 验证会议状态（先验证再添加连接跟踪，避免提前返回时残留连接）
    async with factory() as db:
        meeting = await get_meeting_record(db, meeting_id, User(id=user_id))
        if not meeting:
            await websocket.send_json({
                "type": "error",
                "data": {"message": "会议不存在"}
            })
            await websocket.close(code=4004, reason="Meeting not found")
            return

        if meeting.status not in ("recording", "paused"):
            await websocket.send_json({
                "type": "error",
                "data": {"message": f"会议状态为 {meeting.status}，无法连接"}
            })
            await websocket.close(code=4002, reason="Meeting not recording")
            return

    # 检查是否已有其他用户连接（验证通过后才添加）
    connection_id = uuid.uuid4()
    with _ws_lock:
        other_users = set(_ws_connections.get(meeting_id, set())) - {user_id}
        if other_users:
            await websocket.send_json({
                "type": "error",
                "data": {"message": "会议中已有其他用户正在录音，无法加入"}
            })
            await websocket.close(code=4005, reason="Meeting already occupied")
            return

        previous_connection_id = _ws_owner_connections.get(meeting_id, {}).get(user_id)
        if previous_connection_id and previous_connection_id != connection_id:
            previous_ws = _ws_active_sockets.get(meeting_id, {}).get(previous_connection_id)
            if previous_ws is not None:
                try:
                    await previous_ws.close(code=1000, reason="replaced_by_new_connection")
                except Exception:
                    pass
                _ws_active_sockets.get(meeting_id, {}).pop(previous_connection_id, None)
            _ws_owner_connections.get(meeting_id, {}).pop(user_id, None)

        _ws_connections.setdefault(meeting_id, set()).add(user_id)
        _ws_owner_connections.setdefault(meeting_id, {})[user_id] = connection_id
        _ws_active_sockets.setdefault(meeting_id, {})[connection_id] = websocket

    # 初始化音频文件
    audio_file_path = os.path.join(AUDIO_DIR, f"{meeting_id}.wav")
    num_samples = 0  # 累计采样点
    is_paused = False

    # 如果已有音频文件（恢复场景），读取现有文件大小
    if os.path.exists(audio_file_path):
        file_size = os.path.getsize(audio_file_path)
        if file_size >= 44:
            num_samples = (file_size - 44) // (SAMPLE_WIDTH * CHANNELS)
            logger.info(f"Resuming audio file: {audio_file_path}, existing samples: {num_samples}")
    else:
        # 创建新 WAV 文件
        with open(audio_file_path, "wb") as f:
            f.write(create_wav_header(0))
        logger.info(f"Created new audio file: {audio_file_path}")

    # 更新数据库中的音频文件路径
    async with factory() as db:
        async def update_audio_path():
            result = await db.execute(
                __import__("sqlalchemy").select(MeetingRecord)
                .where(MeetingRecord.id == meeting_id)
            )
            meeting = result.scalar_one_or_none()
            if meeting:
                meeting.audio_file_path = audio_file_path
                await db.commit()

        await update_audio_path()

    # 初始化 ASR 模型（如果可用，失败不阻断连接）
    asr_loading = False
    pending_audio: list[bytes] = []
    asr_ready = asyncio.Event()

    if ASR_AVAILABLE:
        async def load_asr_model():
            try:
                await asyncio.to_thread(init_asr_model)
                asr_ready.set()
            except Exception as e:
                logger.error(f"Failed to init ASR model: {e}")
                await websocket.send_json({
                    "type": "warning",
                    "data": {"message": "语音识别模型载入失败，将仅接收音频数据"}
                })

        if asr_is_available():
            # 模型已在内存：直接就绪，不打扰用户
            asr_ready.set()
        else:
            asr_loading = True
            await websocket.send_json({
                "type": "warning",
                "data": {"message": "语音识别模型载入中，音频正在先缓存"}
            })
            asyncio.create_task(load_asr_model())
    else:
        asr_ready.set()
        await websocket.send_json({
            "type": "warning",
            "data": {"message": "语音识别服务不可用，将仅接收音频数据"}
        })

    # 音频缓冲（用于 ASR 转录）
    speech_buffer: list[bytes] = []  # 语音缓冲
    has_speech = False  # 是否有语音
    silence_timer = 0.0  # 静音计时器（秒）
    is_processing = False  # 是否正在处理转录
    buffer_lock = threading.Lock()  # 缓冲锁

    # 配置参数：从 ASR 配置读取（此前硬编码，设置页改了没效果）
    silence_timeout = 1.5
    min_speech_duration = 0.3
    allowed_languages: list[str] | None = None
    try:
        async with factory() as cfg_db:
            from app.services.third_party_config import get_third_party_config
            params = (await get_third_party_config(cfg_db)).asr_config.parameters or {}
            silence_timeout = float(params.get("silence_timeout", 1.5))
            min_speech_duration = float(params.get("min_speech_duration", 0.3))
            raw_langs = params.get("allowed_languages")
            if isinstance(raw_langs, list) and raw_langs:
                allowed_languages = [str(x).lower() for x in raw_langs]
    except Exception:
        pass

    total_duration = num_samples / SAMPLE_RATE  # 累计时长 (秒)
    segment_count = 0  # 已转录句子数
    buffer_offset_ms = 0  # 当前缓冲区的起始时间偏移（毫秒）

    # 捕获事件循环（用于后台线程发送 WebSocket 消息）
    loop = asyncio.get_running_loop()

    logger.info(
        f"WebSocket ready for meeting {meeting_id}, paused={is_paused}, "
        f"duration={total_duration:.1f}s"
    )

    try:
        while True:
            # 接收消息
            raw_message = await websocket.receive_text()
            try:
                message = json.loads(raw_message)
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "data": {"message": "无效的消息格式"}
                })
                continue

            msg_type = message.get("type")

            # 处理音频块
            if msg_type == "audio_chunk":
                if is_paused:
                    continue  # 暂停时不写入音频

                audio_base64 = message.get("data", {}).get("audio")
                if not audio_base64:
                    continue

                try:
                    audio_bytes = base64.b64decode(audio_base64)

                    # 写入文件
                    with open(audio_file_path, "ab") as f:
                        f.write(audio_bytes)

                    # 更新采样点计数
                    chunk_samples = len(audio_bytes) // (SAMPLE_WIDTH * CHANNELS)
                    num_samples += chunk_samples

                    # 如果模型还在载入，先把音频囤积起来，待模型就绪后再识别
                    if ASR_AVAILABLE and not asr_ready.is_set():
                        pending_audio.append(audio_bytes)
                        continue

                    # 计算时长
                    duration = chunk_samples / SAMPLE_RATE
                    total_duration += duration

                    # 如果模型已经就绪，先回放刚才囤积的音频，保证顺序不乱
                    if ASR_AVAILABLE and asr_ready.is_set() and pending_audio:
                        with buffer_lock:
                            has_speech = True
                            speech_buffer.extend(pending_audio)
                            pending_audio.clear()
                            silence_timer = 0.0

                    # 语音活性检测：webrtcvad 逐帧判断（20ms/帧，纯 C 无 ORT
                    # session，与 SenseVoice 并存不会触发 VM 内存 OOM）
                    if ASR_AVAILABLE and np is not None:
                        frame_len = SAMPLE_RATE * 20 // 1000  # 20ms = 320 采样
                        frame_bytes = frame_len * SAMPLE_WIDTH  # int16
                        pos = 0
                        while pos + frame_bytes <= len(audio_bytes):
                            frame = audio_bytes[pos : pos + frame_bytes]
                            is_speech = vad_is_speech(frame, SAMPLE_RATE)
                            with buffer_lock:
                                if is_speech:
                                    has_speech = True
                                    speech_buffer.append(frame)
                                    silence_timer = 0.0
                                elif has_speech:
                                    speech_buffer.append(frame)
                                    silence_timer += 0.02
                                    # 静音超时切句（无条件触发，串句修复：
                                    # 识别期间新音频进入下一句，不再被并进上一句）
                                    if silence_timer >= silence_timeout:
                                        speech_audio = b"".join(speech_buffer)
                                        denom = SAMPLE_WIDTH * CHANNELS * SAMPLE_RATE
                                        speech_duration = len(speech_audio) // denom
                                        speech_buffer.clear()
                                        has_speech = False
                                        silence_timer = 0.0
                                        if speech_duration >= min_speech_duration:
                                            def transcribe_async(
                                                speech_audio=speech_audio,
                                                speech_duration=speech_duration,
                                            ):
                                                # 外层协程局部变量，必须 nonlocal
                                                nonlocal is_processing, segment_count, buffer_offset_ms
                                                is_processing = True
                                                try:
                                                    segments = transcribe_audio_array(
                                                        speech_audio,
                                                        SAMPLE_RATE,
                                                        allowed_languages=allowed_languages,
                                                    )
                                                    if segments:
                                                        segment_duration_ms = int(
                                                            speech_duration * 1000
                                                        )
                                                        for seg in segments:
                                                            segment_count += 1
                                                            _send_transcript_segment(
                                                                websocket,
                                                                loop,
                                                                segment_count,
                                                                seg.get("text", ""),
                                                                buffer_offset_ms,
                                                                buffer_offset_ms + segment_duration_ms,
                                                            )
                                                        buffer_offset_ms += segment_duration_ms
                                                finally:
                                                    is_processing = False

                                            worker = threading.Thread(
                                                target=transcribe_async, daemon=True
                                            )
                                            worker.start()
                            pos += frame_bytes



                    # 发送状态更新
                    await websocket.send_json({
                        "type": "status_update",
                        "data": {
                            "status": "recording",
                            "duration_seconds": int(round(total_duration)),
                        }
                    })

                except Exception as e:
                    logger.error(f"Audio processing error: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": f"音频处理失败: {str(e)}"}
                    })

            # 处理暂停消息
            elif msg_type == "pause":
                is_paused = True
                logger.info(f"Meeting {meeting_id} paused via WebSocket")
                await websocket.send_json({
                    "type": "status_update",
                    "data": {
                        "status": "paused",
                        "duration_seconds": int(round(total_duration)),
                    }
                })

            # 处理恢复消息
            elif msg_type == "resume":
                is_paused = False
                logger.info(f"Meeting {meeting_id} resumed via WebSocket")
                await websocket.send_json({
                    "type": "status_update",
                    "data": {
                        "status": "recording",
                        "duration_seconds": int(round(total_duration)),
                    }
                })

            # 处理结束消息
            elif msg_type == "end":
                logger.info(f"Meeting {meeting_id} ended via WebSocket")
                # 更新 WAV 文件头
                try:
                    update_wav_header(audio_file_path, num_samples)
                    logger.info(
                        f"Finalized audio file: {audio_file_path}, "
                        f"total samples: {num_samples}"
                    )
                except Exception as e:
                    logger.error(f"Failed to finalize audio file: {e}")
                await websocket.send_json({
                    "type": "status_update",
                    "data": {
                        "status": "processing",
                        "duration_seconds": int(round(total_duration)),
                    }
                })
                # 结束确认后主动收尾，避免客户端延迟关闭期间继续写入音频
                break

            # 处理心跳
            elif msg_type == "ping":
                await websocket.send_text("pong")

            else:
                logger.warning(f"Unknown message type: {msg_type}")

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for meeting {meeting_id}")
        # 断开连接时保存音频文件并更新会议状态
        try:
            update_wav_header(audio_file_path, num_samples)
            logger.info(
                f"Saved audio file on disconnect: {audio_file_path}, "
                f"samples: {num_samples}"
            )
        except Exception as e:
            logger.error(f"Failed to save audio file on disconnect: {e}")
        
        # 更新会议状态为暂停（用户离开但会议未正式结束）
        try:
            async with factory() as db:
                result = await db.execute(
                    __import__("sqlalchemy").select(MeetingRecord)
                    .where(MeetingRecord.id == meeting_id)
                )
                meeting = result.scalar_one_or_none()
                if meeting and meeting.status == "recording":
                    meeting.status = "paused"
                    meeting.paused_reason = "client_left"
                    meeting.duration_seconds = int(round(total_duration))
                    await db.commit()
                    logger.info(
                        f"Meeting {meeting_id} status updated to paused "
                        f"(client left), duration: {total_duration:.1f}s"
                    )
        except Exception as e:
            logger.error(f"Failed to update meeting status on disconnect: {e}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "data": {"message": f"服务器错误: {str(e)}"}
            })
        except Exception:
            pass
    finally:
        # 清理资源
        # 移除连接跟踪
        with _ws_lock:
            if meeting_id in _ws_connections and user_id in _ws_connections[meeting_id]:
                _ws_connections[meeting_id].discard(user_id)
                if not _ws_connections[meeting_id]:
                    del _ws_connections[meeting_id]

            if meeting_id in _ws_owner_connections:
                stored_connection_id = _ws_owner_connections[meeting_id].get(user_id)
                if stored_connection_id == connection_id:
                    _ws_owner_connections[meeting_id].pop(user_id, None)
                if not _ws_owner_connections[meeting_id]:
                    del _ws_owner_connections[meeting_id]

            if meeting_id in _ws_active_sockets:
                _ws_active_sockets[meeting_id].pop(connection_id, None)
                if not _ws_active_sockets[meeting_id]:
                    del _ws_active_sockets[meeting_id]

        try:
            await websocket.close()
        except Exception:
            pass
        logger.info(
            f"WebSocket closed for meeting {meeting_id}, "
            f"total duration: {total_duration:.1f}s"
        )
