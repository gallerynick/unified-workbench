# 日志编号 184 - 2026-10-01

### 开发版本
版本号：v2.0.0（未升级）

### 第二轮补充（同日）：会议场景层 + 全链路验证

**句子切分决策（重要）**：原方案用 sherpa-onnx Silero VAD 切句，实测发现与 SenseVoice 两个 ORT session 并存时，
进程内存 commit 超 Docker VM overcommit 上限（VM 8.7GB / CommitLimit 5.5GB），推理被 OOM 杀掉。
**改用 webrtcvad（纯 C 库，无 ORT session）**：零额外内存，20ms 帧级活性判断 + 静音切句。
sherpa-onnx 仅保留用于说话人分离（会后处理，与 ASR 顺序执行）。

**修复的其他问题**：
- Celery 容器缺 modelscope_cache 卷挂载（补上，与 backend 共用模型）
- `generate_minutes_sync` 嵌套 asyncio.run（async 上下文直接 await）
- `_save_transcript_segments` / `_save_minutes` 未 await db.execute（改 async）
- diarize_speakers 时间戳单位（秒 → 毫秒，与转录段匹配）
- `services/meeting_processor.py` 死代码删除（职责并入 Celery 任务）

**实测全链路（4 说话人测试音频）**：
- 实时 WS：句子级转录 + 时间戳 + 标点，无 OOM
- 离线会议处理：32s 完成转写（21 段）+ 说话人分离（7 类）+ 纪要生成
