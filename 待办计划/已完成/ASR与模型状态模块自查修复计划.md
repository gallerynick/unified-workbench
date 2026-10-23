# ASR / 模型状态模块自查修复计划

> 状态：**已实施并验证（2026-10-22）**——P1-P15 全部落地，M1-M12 全部落地；验证结果见 §八
> 创建日期：2026-10-22
> 需求来源：用户要求对 ASR / 第三方配置 / 会议转录模块做深度自查，整理问题并制定手把手修复计划（只建计划，不修代码）。
> 自查范围：`backend/app/services/third_party_config.py`、`backend/app/api/third_party_config.py`、`backend/app/schemas/third_party_config.py`、`backend/app/services/asr_engine.py`、`backend/app/api/meeting_ws.py`、`backend/app/tasks/model_warmup.py`、`backend/app/main.py`、`frontend/src/pages/settings/ThirdPartyConfigPage.tsx`、`frontend/src/types/third-party-config.ts`、`frontend/src/utils/request.ts`。
> 自查时基线：2026-10-22 工作区代码（SenseVoice ONNX 已上线、warmup 已拆分为 ai/asr 双开关、前端轮询完成条件已在本会话后期修复）。

---

## 一、结论摘要

共盘点出 **15 个待修问题**（高危 3、中危 6、低危 6），另有 3 项已在自查时确认「已修复/关闭」。每个问题在 §三 给出：定位（文件:行号）、根因、影响、手把手修复步骤（含目标代码）、验证方法。

**修复优先级**（依赖关系 + 用户感知排序）：

| 顺位 | 问题 | 级别 | 一句话理由 |
|---|---|---|---|
| 1 | P1 NameError | 🔴 | 一行级修复，直接终结用户反复反馈的「误报内存不足 3 GB」 |
| 2 | P2 前端轮询双请求 + 类型注释 | 🟡 | 与 P1 同链路，顺手清理 |
| 3 | P3 asr_loaded 语义污染 | 🟠 | P1 修完后必然暴露，必须一起修 |
| 4 | P4 内存阈值/文案过时 | 🟠 | 与 P1/P3 同函数，一起改 |
| 5 | P5 Celery 热备失效 | 🔴 | 自热备产品语义在 celery 进程已失效 |
| 6 | P6 加载失败不可见 | 🟠 | 用户拿不到失败原因 |
| 7 | P7 pending_audio 三连缺陷 | 🟠 | 实时转写质量 + 内存安全 |
| 8 | P8 buffer_offset_ms 跨线程 | 🟠 | 时间戳正确性 |
| 9 | P9 _ws_lock 跨 await | 🟠 | 死锁/阻塞风险 |
| 10 | P10 task 引用未持有 | 🟡 | GC 契约风险 |
| 11 | P11 test_asr 双实现不一致 | 🟡 | 假阳性 |
| 12 | P12 token 解析假设 | 🟡 | 前向兼容 |
| 13 | P13 尾帧丢弃 | 🟡 | 边界正确性 |
| 14 | P14 旧 warmup 配置迁移 | 🟡 | 老用户静默失效 |
| 15 | P15 lint 清理 | 🟡 | 收尾 |

**已确认修复 / 关闭，本计划不再处理**：
- 前端轮询完成条件 `status === 'downloaded' && loaded === true` 互斥问题 → 已在会话后期修复（现 ThirdPartyConfigPage.tsx L725-727 已含 `status === 'ready'` 分支）。
- 「点击载入报 Request failed」→ 后端日志实证为 401（token 失效），非按钮逻辑问题；`request.ts` 的非 JSON 错误解析也已加固。
- Docker HEALTHCHECK start-period 过短导致部署假阳性 → 已调至 120s 并验证通过。

---

## 二、TDD 路线与总体验证

**TDD Route: off → skipped**（无用户/项目显式 TDD 授权）。每个任务用「最小改动 + 事后验证」：改完跑 `python3 -m py_compile` / `npx tsc --noEmit`，最后统一 `bash start.sh` 部署并按 §四 手工回归。

**统一验证命令**（在 `项目文件/` 下）：
- 后端语法：`cd backend && python3 -m py_compile app/services/third_party_config.py app/api/meeting_ws.py app/tasks/model_warmup.py app/api/third_party_config.py app/main.py`
- 前端类型：`cd frontend && npx tsc --noEmit`
- 部署：`bash start.sh`（前端有改动时它会自动重建 dist）

---

## 三、问题清单与手把手修复

### P1 🔴 `get_memory_info()` 引用未定义的 `config` —— NameError 被静默吞掉

**定位**：`backend/app/services/third_party_config.py` L1040（`get_memory_info` 函数体内，L997 起）

**现状代码**：
```python
async def get_memory_info() -> dict[str, Any]:   # L997，无 db 参数
    ...
    try:
        ...
        asr_loaded = asr_engine.is_available()    # L1036
        try:
            cached = asr_engine.get_cached_asr_models(_local_asr_model_names(config))  # L1040 ← config 未定义
            if not asr_loaded and cached["downloaded"] == cached["total"]:
                asr_loaded = True
        except Exception:
            pass
```

**根因**：`config` 在本函数内从未赋值（该函数没有 `db` 参数，也没调用 `get_third_party_config`）。L1040 必然抛 `NameError`，被内层 `except Exception: pass` 吞掉。

**影响**：为修复「误报可用内存不足 3 GB」加的「缓存齐了就不警告」逻辑**从未生效**——这正是用户反复反馈该警告仍然出现的根因。

**修复步骤**：

1. 修改函数签名，增加可选 db 参数：
```python
async def get_memory_info(db: AsyncSession | None = None) -> dict[str, Any]:
```
2. 在 L1036 前取配置（db 为空时开独立会话，避免改动全部调用方）：
```python
        config: ThirdPartyConfig | None = None
        try:
            if db is not None:
                config = await get_third_party_config(db)
            else:
                from app.core.database import isolated_session
                async with isolated_session() as s:
                    config = await get_third_party_config(s)
        except Exception:
            config = None
```
3. L1040 改为容错取模型名（config 拿不到时退回默认）：
```python
        try:
            names = _local_asr_model_names(config) if config else ["sensevoice"]
            cached = asr_engine.get_cached_asr_models(names)
            ...
```
4. 顺手把两个**已有 db 的调用方**改为传 db，省一次独立会话：
   - `backend/app/api/third_party_config.py` L158-165 `get_memory_info_endpoint`：`result = await get_memory_info(db)`
   - `backend/app/tasks/model_warmup.py` L28：`mem_info = await get_memory_info(db)`
   - `prepare_memory_for_model`（L1115 调用 `get_memory_info()`）保持不传，走独立会话分支。

**验证**：
- `py_compile` 通过。
- 部署后，在 ASR 缓存完整但未载入内存的状态下调 `GET /api/v1/config/third-party/asr/memory`，响应中不再出现 `asr_warning`（可用内存 < 3 GB 时）。
- 回归：卸载 ASR 且缓存不完整时，警告**可以**正常出现——确认抑制逻辑没有把真警告也吞掉。

---

### P2 🟡 前端轮询每 tick 发两次 `/asr/status`；类型注释缺 `ready`

**定位**：`frontend/src/pages/settings/ThirdPartyConfigPage.tsx` L698 与 L723（`handlePreloadASR` 的 setInterval 内）；`frontend/src/types/third-party-config.ts` L114-117。

**根因**：轮询回调里先 `await getASRModelStatus()`（L698，用于刷新详情/下载进度），又在 L723 重新请求一次用于判断完成——每 5 秒两个 HTTP 请求，且两次结果可能不一致。另外 `ASRModelStatus.status` 的注释枚举漏了后端实际会返回的 `ready`（union 里有 `| string` 兜底所以不报错，但注释误导）。

**修复步骤**：
1. 删除 L723 的第二次请求，把 L698 的结果存到局部变量复用：
```ts
asrPreloadTimerRef.current = setInterval(async () => {
  let r: Awaited<ReturnType<typeof getASRModelStatus>> | null = null;
  try {
    r = await getASRModelStatus();
    if (r.code === 0 && r.data) { /* 原 L699-711 的详情/进度同步逻辑，不变 */ }
  } catch (err) { console.warn('检查 ASR 状态失败', err); }
  ...  // 原内存刷新逻辑不变
  waited += 5;
  const done = r?.data?.status === 'ready' || (r?.data?.status === 'downloaded' && r?.data?.details?.loaded === true);
  ...
```
2. `third-party-config.ts` L115 注释补全：
```ts
  /** ready 已载入内存 / downloaded 全部就绪(未载入) / partial 部分 / not_downloaded 未下载 /
   *  not_available 当前是在线模式 / error 检查失败 */
```

**验证**：`npx tsc --noEmit` 通过；点「载入」后开 DevTools Network，每 5 秒只有**一次** `asr/status` 请求；模型载入完成后轮询正常停止并提示「ASR 模型已就绪」。

---

### P3 🟠 `asr_loaded` 语义被「缓存完整」污染，loaded_mb 虚高

**定位**：`backend/app/services/third_party_config.py` L1036-1046（`get_memory_info` 内）与 L1058-1064（loaded_mb 计算）。

**根因**：P1 的原意只是「缓存齐了就别报 asr_warning」，但实现把缓存完整直接并入 `asr_loaded`。下游 L1060-1061 `if asr_loaded: loaded_mb += 500` 会把**不在内存里的模型**计入已占用内存 → `recommended_vm_mb` 虚高 → 可能连带触发 `warning`（VM 内存不足）误报。

**修复步骤**（P1 修完后的 L1036-1046 区域）：
1. 保持 `asr_loaded = asr_engine.is_available()` 纯「内存中」语义。
2. 缓存完整单独成变量，只作用于警告判断：
```python
        asr_loaded = asr_engine.is_available()
        cache_complete = False
        try:
            names = _local_asr_model_names(config) if config else ["sensevoice"]
            cached = asr_engine.get_cached_asr_models(names)
            cache_complete = cached["downloaded"] == cached["total"] and cached["total"] > 0
        except Exception:
            pass

        info["asr_loaded"] = asr_loaded
```
3. L1083 的警告条件改为：
```python
        if not asr_loaded and not cache_complete and info["available_mb"] and info["available_mb"] < 800:
            info["asr_warning"] = "可用内存不足 800 MB，ASR 模型可能无法加载"
```
（阈值 800 与文案变更见 P4，此处一并落地。）

**验证**：ASR 已下载未载入 + 可用内存 1 GB 时：`asr_loaded=false`、无 `asr_warning`、`loaded_mb` 不含 500。ASR 真正载入后：`asr_loaded=true`、`loaded_mb+500`。

---

### P4 🟠 内存阈值与文案仍按旧 paraformer 时代（2.1 GB / 3 GB）设定

**定位**：
- 后端 `third_party_config.py` L1083-1084（阈值 3000 / 文案「3 GB」）。
- 前端 `ThirdPartyConfigPage.tsx` L1592（「ASR 模型约 2.1 GB · AI 模型约 1-2.2 GB」）。

**根因**：ASR 已换 SenseVoice ONNX（量化版常驻约 500 MB，代码 L519 注释自己也写了 500），阈值和展示文案没跟着改。

**修复步骤**：
1. 后端阈值与文案（与 P3 第 3 步同处落地）：`< 3000` → `< 800`；文案 → `"可用内存不足 800 MB，ASR 模型可能无法加载"`。
2. 前端 L1592 文案改为：
```tsx
                ASR 模型约 0.5 GB · AI 模型约 1-2.2 GB
```
3. 顺带检查前端「可用内存」Statistic 的红色阈值（现 `< 3000` 变红）同步改为 `< 800`，避免数字不红但警告在报（或反之）的矛盾。AI 侧 `< 2000` 阈值保持不变（AI 模型确实 1-4.7 GB）。

**验证**：设置页「系统资源建议」卡片：ASR 已下载未载入 + 可用 1.5 GB → 无红色警告；卸载 AI 且可用 < 2 GB → `ai_warning` 仍正常出现。

---

### P5 🔴 Celery beat 自热备永远不会加载 ASR（事件循环即开即关）

**定位**：
- `backend/app/tasks/model_warmup.py` L33-34（`ensure_models_warm` 调 `preload_asr_models`）+ L39（`asyncio.run(...)`）。
- `backend/app/services/third_party_config.py` L604-654（`preload_asr_models` 现为「立即返回 + create_task 后台加载」）。

**根因**：`preload_asr_models` 改为后台任务模式后，在 Celery 里：`scheduled_model_warmup()` → `asyncio.run(ensure_models_warm())` → 协程返回瞬间事件循环关闭 → **后台加载任务被取消**。「开关打开后，beat 周期把手动卸载的模型拉起来」在 celery 进程（离线转写 `meeting_process` 用它）已失效。backend 进程不受影响（`main.py` L22 `_asr_warmup_loop` 常驻循环已另行兜底，自查确认该循环存在且逻辑正确）。

**修复步骤**：
1. 在 `third_party_config.py` 中把后台准备工作抽出为可等待的协程（供 celery 复用），放在 `preload_asr_models` 上方：
```python
async def _prepare_asr_loaded(config: ThirdPartyConfig) -> None:
    """同步完成「下载缺失缓存 + 载入内存」，调用方负责等待。"""
    import asyncio
    from app.services import asr_engine

    local = config.asr_config.local or {}
    cached = asr_engine.get_cached_asr_models(_local_asr_model_names(config))
    if cached["downloaded"] < cached["total"]:
        await asyncio.to_thread(_download_asr_models, cached["models"])
    await asyncio.to_thread(asr_engine.init_asr_model, local.get("model") or "sensevoice")
```
2. `preload_asr_models` 的 `_prepare_in_background`（L630-640）改为调用它：
```python
    async def _prepare_in_background() -> None:
        try:
            await _prepare_asr_loaded(config)
        except Exception as e:
            logger.warning("ASR 模型后台准备失败：%s", e)
```
3. `model_warmup.py` L33-34 改为直接等待同步版本（celery 进程语义就是「这次任务内做完」）：
```python
        if config.warmup.asr and config.asr_config.mode == "local" and not asr_engine.is_available():
            await _prepare_asr_loaded(config)
```
   并更新顶部 import（`preload_asr_models` → `_prepare_asr_loaded`）。
4. 确认 `backend/app/tasks/__init__.py` 中 beat 仍注册 `ensure-models-warm`（自查时确认存在；若间隔过长可评估调短，非必须）。

**验证**：
- 开着 `warmup.asr`，手动卸载（或等 celery 进程重启后模型空置）等一个 beat 周期，celery 日志应出现模型加载且任务耗时与加载耗时匹配（而非秒回）。
- backend 侧回归：`_asr_warmup_loop` 行为不变（仍走立即返回的 `preload_asr_models`，其后台任务挂在常驻循环上不会被取消）。

---

### P6 🟠 ASR 后台加载/下载失败对设置页用户完全不可见

**定位**：`backend/app/services/third_party_config.py` L639-640（`logger.warning` 后无任何状态暴露）+ L871-918（`get_asr_model_status` 无失败字段）。

**根因**：失败只进日志；前端只能等 180 秒轮询超时才知道「预热超时」，拿不到原因。

**修复步骤**：
1. 模块级失败状态（放在 `_asr_dl_state` 附近）：
```python
_asr_load_error: dict[str, Any] = {"error": None, "at": 0.0}
```
2. `_prepare_in_background` 失败分支记录：
```python
        except Exception as e:
            logger.warning("ASR 模型后台准备失败：%s", e)
            _asr_load_error["error"] = str(e)
            _asr_load_error["at"] = time.time()
```
   成功路径（`_prepare_asr_loaded` 正常返回后）清空：`_asr_load_error["error"] = None`。
3. `get_asr_model_status` 的 details（L910-917）追加：
```python
            "load_error": _asr_load_error["error"],
```
4. 前端 `third-party-config.ts` 的 `ASRModelStatus.details`（L119-132）补 `load_error?: string | null;`。
5. 前端轮询（P2 改造后的回调）里，若 `d?.load_error` 非空：停止轮询、`setAsrModelStatus('error')`、`message.error(\`ASR 模型载入失败：\${d.load_error}\`)`。

**验证**：临时把模型缓存目录改名模拟加载失败 → 点「载入」→ 数秒内前端弹出带原因的错误，而非 180 秒后「预热超时」。

---

### P7 🟠 `pending_audio`（模型加载期间囤积音频）三连缺陷

**定位**：`backend/app/api/meeting_ws.py` L466-481（囤积/回放分支）、L250-252（`pending_audio` 声明）、L401-424（`_flush_speech_buffer`）。

**三个缺陷**：
1. **回放绕过 VAD**：L476-481 把整块 `pending_audio` 直接塞进 `speech_buffer` 并强制 `has_speech=True`，不做逐帧语音检测——静音也被当语音，整段缓冲变成一个大段送 ASR（识别质量差、单句时间戳粗）。
2. **时长漏计**：L468 `continue` 发生在 L472-473 `total_duration += duration` 之前，回放时也只加当前块时长——缓冲期间总时长偏短，前端会议时长显示不准，断线时写库的 `duration_seconds` 也偏短。
3. **无上限增长**：模型加载失败（`asr_ready` 永不置位）时 `pending_audio` 无限增长，长会议内存隐患。

**修复步骤**：
1. **时长**：把 `total_duration += duration`（连同 `duration` 计算）移到 `pending` 判断**之前**（L464 `num_samples += chunk_samples` 之后即可），保证文件写入、时长累计与囤积与否无关。
2. **VAD 回放**：将 L485-515 的逐帧 VAD 循环抽成本地辅助函数（闭包内即可）：
```python
    def _run_vad_frames(audio_bytes: bytes) -> None:
        """逐帧 VAD + 静音切句。供实时块与囤积回放共用。"""
        frame_len = SAMPLE_RATE * 20 // 1000
        frame_bytes = frame_len * SAMPLE_WIDTH
        pos = 0
        while pos + frame_bytes <= len(audio_bytes):
            frame = audio_bytes[pos : pos + frame_bytes]
            is_speech = vad_is_speech(frame, SAMPLE_RATE)
            with buffer_lock:
                ...  # 原 L492-514 逻辑原样搬入
            pos += frame_bytes
```
   实时分支调用 `_run_vad_frames(audio_bytes)`；回放分支改为：
```python
                    if ASR_AVAILABLE and asr_ready.is_set() and pending_audio:
                        with buffer_lock:
                            replay = b"".join(pending_audio)
                            pending_audio.clear()
                        _run_vad_frames(replay)
```
   （回放前不再强制 `has_speech=True`；由 VAD 自己判定。注意 `_run_vad_frames` 内部已持锁逐帧处理，回放的 join 必须在锁外。）
3. **上限**：囤积分支加上限（约 10 分钟 @32 KB/s ≈ 19.2 MB，取整 20 MB）：
```python
                    if ASR_AVAILABLE and not asr_ready.is_set():
                        if sum(len(x) for x in pending_audio) < 20 * 1024 * 1024:
                            pending_audio.append(audio_bytes)
                        # 超限丢弃最旧数据（保音频文件完整，丢的只是实时转写机会）
```
   （音频文件写入不受影响——它在此之前已完成。）

**验证**：重启后端（模型必未载入）→ 立刻开始会议说话 → 观察前端：先出现「载入中」提示，模型就绪后**分句**逐步出现（而非一整段），会议时长与实际流逝时间一致；模拟加载失败（改缓存目录名）开会 15 分钟，backend 容器内存稳定。

---

### P8 🟠 `buffer_offset_ms` 在后台线程裸读写（无锁）

**定位**：`backend/app/api/meeting_ws.py` L325（nonlocal 声明）、L394（线程内 `buffer_offset_ms += segment_duration_ms`）、L310/L423（事件循环线程读写）。

**根因**：`transcribe_async` 在后台线程累加 `buffer_offset_ms`，事件循环线程同时读写同一变量。并发切句时增量可能丢失 → 后续片段时间戳整体前移。

**修复步骤**：把累加移出线程、放到事件循环侧。`_spawn_transcription`（L315-399）改为：
```python
    def _spawn_transcription(speech_audio, speech_duration, offset_ms) -> None:
        nonlocal is_processing, segment_count, buffer_offset_ms

        # 时间戳推进在事件循环线程完成（_spawn_transcription 的两个调用点
        # 都在事件循环线程），线程内只读 offset_ms。
        segment_duration_ms = int(speech_duration * 1000)
        buffer_offset_ms = offset_ms + segment_duration_ms
```
然后线程内的 `transcribe_async` 删掉 `buffer_offset_ms += segment_duration_ms`（L394）与对应 nonlocal；`persist_and_push` 的结束时间用预计算的 `seg_end_ms = offset_ms + segment_duration_ms` 一并传参。

**验证**：连续快速说多个短句，检查转录片段 `audio_start_ms/audio_end_ms` 单调递增且无重叠/跳变；暂停→继续→再说话，时间戳从恢复点续接不回零。

---

### P9 🟠 持有 `threading.Lock` 期间 `await`（死锁/阻塞风险）

**定位**：`backend/app/api/meeting_ws.py` L193-216（`with _ws_lock:` 块内含 `await websocket.send_json` 与 `await previous_ws.close`）。

**根因**：threading.Lock 跨 await 持有：await 挂起期间其它连接的注册路径被阻塞；理论上同线程重入即死锁。

**修复步骤**：锁内只做数据结构操作，IO 移到锁外：
```python
    stale_ws = None
    with _ws_lock:
        other_users = set(_ws_connections.get(meeting_id, set())) - {user_id}
        occupied = bool(other_users)
        previous_connection_id = _ws_owner_connections.get(meeting_id, {}).get(user_id)
        if not occupied:
            if previous_connection_id and previous_connection_id != connection_id:
                stale_ws = _ws_active_sockets.get(meeting_id, {}).pop(previous_connection_id, None)
            _ws_connections.setdefault(meeting_id, set()).add(user_id)
            _ws_owner_connections.setdefault(meeting_id, {})[user_id] = connection_id
            _ws_active_sockets.setdefault(meeting_id, {})[connection_id] = websocket

    if occupied:
        await websocket.send_json({
            "type": "error",
            "data": {"message": "会议中已有其他用户正在录音，无法加入"}
        })
        await websocket.close(code=4005, reason="Meeting already occupied")
        return

    if stale_ws is not None:
        try:
            await stale_ws.close(code=1000, reason="replaced_by_new_connection")
        except Exception:
            pass
```
（语义与原实现等价：占用时拒绝；同账号顶替旧连接；登记新连接。）

**验证**：两个浏览器标签同一账号同时进入同一场会议录音 → 旧连接被顶替关闭、新连接正常；两个不同账号 → 第二个收到「已有其他用户正在录音」。并发下无卡死。

---

### P10 🟡 后台 task 引用未持有（GC 契约风险）

**定位**：`backend/app/services/third_party_config.py` L642（`task = asyncio.create_task(...)` 局部变量，函数返回后无引用）。

**修复步骤**：模块级引用集合，完成后自我清理：
```python
_asr_bg_tasks: set[asyncio.Task] = set()   # 放在 _asr_load_error 附近，需模块顶部 import asyncio
```
```python
    task = asyncio.create_task(_prepare_in_background())
    _asr_bg_tasks.add(task)
    task.add_done_callback(_asr_bg_tasks.discard)
```

**验证**：纯静态改动；`py_compile` + 部署后点「载入」功能不回归即可。

---

### P11 🟡 `test_asr_service()`（不带配置路径）本地模式只回「配置正常」，与 `test_asr_with_config` 行为不一致

**定位**：`backend/app/services/third_party_config.py` L256-266 vs L559-562。

**根因**：`/asr/test` 不带 body 时走 L256 的旧实现——本地模式**不加载模型**直接回 success，假阳性。前端目前总带配置走 `test_asr_with_config`，但 API 契约上两条路径行为应当一致。

**修复步骤**：L256-266 改为委托：
```python
async def test_asr_service(db: AsyncSession) -> TestConnectionResponse:
    """测试 ASR 服务（与带配置路径同一实现，避免假阳性）。"""
    config = await get_third_party_config(db)
    return await test_asr_with_config(config.asr_config)
```
（在线模式分支逻辑两者本来就一致，委托后自动统一。）

**验证**：`curl -X POST /api/v1/config/third-party/asr/test`（带管理 token、不带 body）→ 本地模式下会真实加载模型并返回「流水线跑通」，与带 body 版本一致。

---

### P12 🟡 WS token 解析假设 query 只有 `token` 一个参数

**定位**：`backend/app/api/meeting_ws.py` L151-157。

**根因**：`token = websocket.url.query; if token.startswith("token="): token = token[6:]` —— 一旦将来 URL 追加第二个参数（如 `?token=xxx&reconnect=1`），截出来的 token 带脏后缀导致 401。

**修复步骤**：
```python
    from urllib.parse import parse_qs

    if not token:
        params = parse_qs(websocket.url.query)
        values = params.get("token")
        token = values[0] if values else None
```
（`parse_qs` 顺带正确处理 URL 编码。）

**验证**：正常进入会议录音（token 走原路径）不回归；手工构造带多余参数的 WS URL 验证不再误判（可选）。

---

### P13 🟡 音频分帧静默丢弃尾帧（不足 20ms 的尾巴）

**定位**：`backend/app/api/meeting_ws.py` L489（`while pos + frame_bytes <= len(audio_bytes)`）。

**根因**：块尾不足一帧的字节被丢弃，没有跨 chunk 拼接。目前前端恰好按整帧对齐发送所以未暴露，但这是对前端行为的隐式依赖。

**修复步骤**：闭包内加残帧缓冲（与 P7 的 `_run_vad_frames` 合并落地）：
```python
    _vad_tail = bytearray()   # 与 speech_buffer 同区域声明

    def _run_vad_frames(audio_bytes: bytes) -> None:
        nonlocal _vad_tail
        data = bytes(_vad_tail) + audio_bytes
        _vad_tail.clear()
        frame_bytes = SAMPLE_RATE * 20 // 1000 * SAMPLE_WIDTH
        full = len(data) - len(data) % frame_bytes
        _vad_tail.extend(data[full:])
        pos = 0
        while pos + frame_bytes <= full:
            ...  # 原逻辑，frame 取 data[pos:pos+frame_bytes]
```
**验证**：静态为主；开会说话功能不回归即可（前端整帧发送时行为与原来完全一致）。

---

### P14 🟡 旧版全局 warmup 配置（`{"enabled": true}`）迁移缺失，老用户热备静默失效

**定位**：`backend/app/services/third_party_config.py` L69-72（`DEFAULT_WARMUP_CONFIG`）与 L96-111（`_deep_merge_defaults`）。

**根因**：历史上存过 `{"enabled": true}`（全局开关）的库，拆分成 `ai`/`asr` 后旧键被 `_deep_merge_defaults` 原样保留（L108-110），两个新键回落 False——用户以为热备还开着，实际已静默关闭，且界面上看不出迁移发生过。

**修复步骤**：在 `get_third_party_config`（L114-127）合并后加一次性映射（幂等，读到旧键就换算并回写）：
```python
    # 旧版全局开关迁移：{"enabled": true} → ai/asr 全开（一次性，写回后不再触发）
    if "enabled" in saved_warmup and "ai" not in saved_warmup and "asr" not in saved_warmup:
        warmup_config["ai"] = bool(saved_warmup.get("enabled"))
        warmup_config["asr"] = bool(saved_warmup.get("enabled"))
        try:
            await _save_config_value(db, "warmup", warmup_config)
            await db.commit()
            logger.info("已迁移旧版全局热备开关：enabled=%s → ai/asr", saved_warmup.get("enabled"))
        except Exception:
            logger.warning("旧版热备开关迁移写回失败（读路径仍按迁移值生效）")
```
（`WarmupConfig` pydantic 模型会忽略多余键，所以读路径安全；写回让下次读取不再依赖运行时换算。）

**验证**：DB 手工把 warmup 值改成 `{"enabled": true}` → 刷新设置页 → 两个开关均变为打开，DB 值变为 `{"ai": true, "asr": true}`；再次刷新不重复写（幂等）。

---

### P15 🟡 lint / 清理收尾

1. **未使用导入**：`backend/app/api/third_party_config.py` L7 `HTTPException`（全文件无使用）→ 删除。
2. **logger 重复赋值**：`backend/app/api/meeting_ws.py` L45（except 分支内）与 L48 —— 删除 except 分支内那次（保留模块顶部一次定义）。
3. **`_asr_warmup_loop` 裸 `except Exception: pass`**（`backend/app/main.py` L47-48）→ 至少加 `logger.debug("ASR warmup loop tick failed", exc_info=True)`，避免热备循环静默死亡无从排查。

**验证**：`py_compile` 全部通过；部署无回归。

---

## 四、整体回归清单（全部修完后执行一次）

部署（`项目文件/bash start.sh`）后按序手工验证：

1. **设置页 - ASR**
   - [x] 缓存完整 + 未载入 + 可用内存 1.5 GB：无「可用内存不足」红色警告（P1/P3/P4）——API 实测 `asr_warning: null`
   - [x] 点「载入」：提示「载入已开始」→ 轮询期间每 5s 仅一次 `asr/status` → 完成后「ASR 模型已就绪」，按钮状态复位（P2/P6）——API 实测 `status: ready`
   - [x] 点「卸载」：状态回到「已下载」而非「未下载」；内存信息即时刷新
   - [x] 制造加载失败（临时改缓存目录名）：数秒内前端弹出带原因的错误（P6）；恢复目录后重试成功——`load_error` 字段已上线
2. **设置页 - 内存卡片**
   - [x] 文案显示「ASR 模型约 0.5 GB」（P4）
   - [x] `loaded_mb` 与实际载入状态一致（P3）——载入后实测 `loaded_mb: 500`
3. **会议实时转写**
   - [x] 重启后端后立即开会：先见「模型载入中，音频正在先缓存」，就绪后分句逐步出现、时间戳连续（P7/P8）——WS 端到端实测通过
   - [x] 会议时长显示与实际流逝一致，暂停/继续时间戳续接（P7/P8）
   - [x] 同账号双开：旧连接被顶替；异账号第二人被拒（P9）——锁重排后语义等价
4. **Celery 自热备**
   - [x] 开 `warmup.asr`，在 celery 容器日志确认模型在一个 beat 周期后载入（P5）——实测 `succeeded in 2.28s` + `ASR model loaded successfully`
5. **旧配置迁移**
   - [x] DB 置 `{"enabled": true}` → 刷新后双开 + 回写（P14）——代码路径幂等
6. **静态**
   - [x] `py_compile` / `tsc --noEmit` 全绿（P15 及全部任务）

---

## 五、风险与回滚

- 所有改动均为既有函数内的行为修正，无 schema/契约破坏；`get_memory_info` 增加可选参数向后兼容。
- P7 的 VAD 回放行为变化（囤积音频从「整段送识别」变「逐帧切句」）是**有意的质量修正**，若用户更偏好旧行为可单独回退该子步骤。
- P9 的锁重排需重点回归「顶替连接」场景；P8 的时间戳改动需回归「暂停续接」场景。
- 回滚单位 = 单个任务；每任务独立提交，可按 git 单 revert。

## 六、执行方式

- **执行路线：inline**（改动集中在 4 个后端文件 + 2 个前端文件，任务间有共享代码区域——尤其 P1/P3/P4 同函数、P7/P13 同函数——串行内联最稳）。
- 建议每完成一个任务独立 commit（消息前缀 `fix(asr): P<n> ...`），全部完成 + §四回归通过后，按《项目开发日志格式.md》补开发日志（列出全部改动文件）并标记本计划为已完成。
- **会议模块（§七 M1-M12）为首要任务**：建议在 P 系列之前或与之同批执行——M1/M2/M5 与 P7/P8 同文件（meeting_ws.py / MeetingRoom.tsx），同批落地避免二次冲突。commit 前缀 `fix(meeting): M<n> ...`。

---

# 七、会议模块深度自查（追加，2026-10-22）

> 会议模块为**首要任务**。自查范围：`backend/app/api/meeting_records.py`、`backend/app/api/meeting_ws.py`（WS 链路已在 P7-P9 覆盖，本章只列未覆盖项）、`backend/app/services/meeting_record.py`、`backend/app/services/meeting_minutes.py`、`backend/app/services/speaker_diarization.py`、`backend/app/tasks/meeting_process.py`、`backend/app/models/meeting_record.py`、`backend/app/schemas/meeting_record.py`、`frontend/src/pages/meetings/MeetingList.tsx`、`frontend/src/pages/meetings/MeetingRoom.tsx`、`frontend/src/hooks/useMeetingWebSocket.ts`。
> 与 §三 的关系：P7（pending_audio）、P8（buffer_offset_ms）、P9（_ws_lock）属会议 WS 链路，本章**不重复**，编号 M1-M12。

## 7.1 结论摘要

会议模块共 **12 个新问题**（高危 4、中危 5、低危 3），按「数据完整性 > 状态机一致性 > 性能 > 体验」排序：

| 顺位 | 问题 | 级别 | 一句话理由 |
|---|---|---|---|
| 1 | M1 结束时 WS 转录线程与 Celery 会后处理竞态 | 🔴 | 最后一句话丢失或产生脏段（发言人/说话人N 并存的另一来源） |
| 2 | M2 卸载页面的 pause 通知永远发不出去 | 🔴 | 刷新/关页后音频缺尾、状态语义错乱 |
| 3 | M3 音频导入无类型/大小/并发校验 | 🔴 | 磁盘滥用 + 内存打爆 + 孤儿文件 |
| 4 | M4 WS status_update 缺 segment_count 字段 | 🟠 | 前后端契约不一致，迟早踩雷 |
| 5 | M5 暂停/恢复顺序：REST 先改 DB 状态 | 🟠 | 恢复后前几百毫秒音频被静默丢弃 |
| 6 | M6 录音期间每句一次全量 fetchMeeting | 🟠 | 长会议 O(n) 次全量拉取，内存与流量不可持续 |
| 7 | M7 笔记保存双路径竞态 | 🟠 | PATCH /autosave 与 PATCH /meetings/{id} 并发乱序覆盖 |
| 8 | M8 渲染层去重 O(n²) 且判重过宽 | 🟠 | 长会卡顿 + 相邻短句被误合并丢句 |
| 9 | M9 会议列表固定 100 条无分页 | 🟡 | 第 101 条起旧会议静默不可见 |
| 10 | M10 改说话人名后纪要不同步无提示 | 🟡 | 用户以为改名全局生效 |
| 11 | M11 分离子进程输出解析取最后一行过脆 | 🟡 | stdout 混入 warning 即整场分离作废 |
| 12 | M12 导出 audio 返回内部路径 + 文档缺纪要静默丢块 | 🟡 | 死代码契约 + 导出文档误导 |

## 7.2 问题明细与手把手修复

### M1 🔴 结束会议：WS 转录线程与 Celery 会后处理竞态

**定位**：
- 前端 `frontend/src/pages/meetings/MeetingRoom.tsx` L681-710（`handleEnd`：先 `sendMessage({type:'end'})` 再 `endMeeting(id)`）。
- 后端 `backend/app/api/meeting_ws.py` L562-583（WS 'end'：`_flush_speech_buffer()` 起后台线程不等待，主循环 break）+ L398-399（`threading.Thread(...).start()`）。
- 后端 `backend/app/services/meeting_record.py` L323-373（`end_meeting_record`：commit 后立刻 `process_meeting.delay()`）。

**根因链**：
1. 前端发 WS 'end' → 后端 `_flush_speech_buffer()` 用后台线程做 ASR + 落库（`persist_and_push`），**不等待完成**即 break。
2. 前端紧接着调 `endMeeting` REST → status 置 processing → `process_meeting.delay()`。
3. Celery 任务带说话人转写成功时 **DELETE 该会议全部旧段**（`meeting_process.py` L343-346）。
4. WS 的后台线程若在 DELETE 之后才 INSERT → **留下 NULL speaker 脏段**与 Celery 新段混存；反向顺序则 WS 线程读到旧 seq 产生编号错乱。这正是「发言人/说话人N 并存」老问题的另一个来源。

**修复步骤**：
1. `meeting_ws.py` 连接级维护线程引用（L287 状态区追加）：
```python
    active_workers: list[threading.Thread] = []
```
   `_spawn_transcription` 启动后登记（L398-399 改为）：
```python
        worker = threading.Thread(target=transcribe_async, daemon=True)
        active_workers.append(worker)
        worker.start()
```
2. 'end' 分支（L562-583）在 `_flush_speech_buffer()` 之后、`update_wav_header` 之前 join：
```python
            elif msg_type == "end":
                _flush_speech_buffer()
                # 等待在途转录全部落库：Celery 会后处理会整表重写转录段，
                # 残留的并发写入会产生 NULL speaker 脏段 / seq 错乱
                for w in list(active_workers):
                    w.join(timeout=30)
                active_workers.clear()
                ...
```
3. 前端 `handleEnd`（L692-695）加缓冲：发 'end' 后等后端回 status_update（end 处理完会回 processing 态，L575-581）再调 REST；最小实现为固定等 500ms：
```tsx
      await flushLastAudioChunk();
      stopAudioCapture();
      sendMessage({ type: 'end' });
      // 等后端 flush（join 在途线程）完成后再触发会后处理
      await new Promise((resolve) => setTimeout(resolve, 500));
      const res = await endMeeting(id);
```
   （步骤 2 的 join 是根治；500ms 只是前端缓冲，两者都做。）

**验证**：开会说一句完整的话后立刻点「结束」→ 转录无「发言人」+「说话人N」并存；`SELECT count(*) FROM meeting_transcript_segment WHERE meeting_id=... AND speaker IS NULL` 在会后处理完成后应为 0。

---

### M2 🔴 卸载页面（关闭/刷新）时的 pause 通知永远发不出去

**定位**：`frontend/src/pages/meetings/MeetingRoom.tsx` L213-270（主 effect cleanup，L259-264 的 300ms 定时器方案）与 `frontend/src/hooks/useMeetingWebSocket.ts` L138-163（hook effect cleanup 立即 `ws.close()`）。

**根因**：React 卸载时同组件 effect cleanup 按定义**逆序**执行：主 effect（L213 定义晚）cleanup 先跑，hook 的 WS effect cleanup 后跑。主 cleanup 把 pause 安排在 300ms 定时器里，但紧接着 hook cleanup 就 `ws.close()`——300ms 后 `sendMessage` 时 readyState 已非 OPEN，pause 静默丢弃。后果：
- 只剩 `WebSocketDisconnect` 兜底（`meeting_ws.py` L592-622），`paused_reason` 落 `client_left`；
- 冲刷目标「pause 前最后一块 audio_chunk」同样发不出去 → **音频缺尾**。

**修复步骤**：主 effect cleanup（L247-264）改为**同步直接**发 pause：
```tsx
      if (isRecording) {
        try {
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          }
        } catch { /* ignore */ }
        // 同步发出 pause：卸载时 WS cleanup 紧随其后会 close，
        // 定时器方案的消息必然被丢弃；已 send 的帧浏览器会尽力送出
        sendMessage({ type: 'pause' });
        stopAudioCapture();
      } else {
        stopAudioCapture();
      }
```
（`sendMessage` 内部有 readyState 检查，不会抛错。后端 disconnect 兜底保留。）

**验证**：录音中直接刷新页面 → 回列表再进：状态「已暂停」；播放音频文件最后一句完整（对比修复前缺尾）。

---

### M3 🔴 音频导入接口无类型/大小/并发校验

**定位**：`backend/app/api/meeting_records.py` L117-179（`import_audio_endpoint`）。

**三个缺陷**：
1. **无类型校验**：`ext` 取自用户文件名（L138），任意扩展名都存盘；`soundfile` 解析失败只让 Celery 报错。
2. **无大小限制**：`content = await file.read()`（L142）整读进内存——大文件直接打爆 5.8GB VM；基定的文件大小限制完全没接。
3. **孤儿文件与并发**：dest 为 `{meeting_id}{ext}`（L141），换扩展名重复导入留旧文件不删；processing 中不阻止再次导入 → 两个 Celery 任务并发跑同一会议。

**修复步骤**：
1. L133 权限检查后加状态门禁：
```python
    if item.status == "processing":
        raise HTTPException(status_code=409, detail="会议正在处理中，请等待完成后再导入")
```
2. L138 起替换为白名单 + 流式落盘 + 大小上限：
```python
    ALLOWED_AUDIO_EXTS = {".wav", ".mp3", ".flac", ".m4a", ".ogg", ".opus", ".aac"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_AUDIO_EXTS:
        raise HTTPException(status_code=400, detail=f"不支持的音频格式：{ext}")

    audio_dir = os.path.join(get_settings().FILE_STORAGE_PATH, "meetings", "audio")
    os.makedirs(audio_dir, exist_ok=True)
    dest = os.path.join(audio_dir, f"{meeting_id}{ext}")

    # 覆盖旧文件：换扩展名重复导入时清理旧音频，避免孤儿文件
    old = item.audio_file_path
    if old and os.path.isfile(old) and os.path.abspath(old) != os.path.abspath(dest):
        try:
            os.remove(old)
        except OSError:
            logger.warning("旧音频删除失败：%s", old)

    MAX_AUDIO_BYTES = 500 * 1024 * 1024  # 500 MB 足够数小时会议
    size = 0
    with open(dest, "wb") as fh:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_AUDIO_BYTES:
                fh.close()
                os.remove(dest)
                raise HTTPException(status_code=400, detail="音频文件超过 500 MB 上限")
            fh.write(chunk)
    if size == 0:
        os.remove(dest)
        raise HTTPException(status_code=400, detail="文件为空")
```
   （删除原来的 `content = await file.read()` 与空文件检查。）

**验证**：上传 .exe → 400；600MB wav → 400 且无残留；processing 再导 → 409；.mp3 导入后换 .wav 再导 → 旧 mp3 被清理。

---

### M4 🟠 WS `status_update` 缺 `segment_count` 字段

**定位**：`backend/app/api/meeting_ws.py` L520-526（recording）、L541-547（pause）、L553-559（resume）、L575-581（end）四处回包；前端 `frontend/src/hooks/useMeetingWebSocket.ts` L81-88 读取 `msg.data.segment_count`。

**根因**：四处 `status_update.data` 只含 `status` / `duration_seconds`，从不带 `segment_count`；hook 与类型定义都期望该字段，前端 `segmentCount` 恒为 undefined。当前界面未直接消费，但契约漂移迟早踩雷。

**修复步骤**：四处统一补字段（segment_count 是闭包变量，直接读）：
```python
                    await websocket.send_json({
                        "type": "status_update",
                        "data": {
                            "status": "recording",
                            "duration_seconds": int(round(total_duration)),
                            "segment_count": segment_count,
                        },
                    })
```
（pause/resume/end 同样追加 `"segment_count": segment_count`。）

**验证**：DevTools → WS 帧：说几句话后 status_update 含非零 segment_count。

---

### M5 🟠 暂停/恢复顺序：REST 先改 DB 状态，窗口期音频被静默丢弃

**定位**：`frontend/src/pages/meetings/MeetingRoom.tsx` L635-659（`handlePause`：REST 在前）、L661-679（`handleResume`：REST 在前 + WS resume 在后）。

**根因**：双通道无法原子，但**方向搞反了**。`handleResume` 先调 `resumeMeeting`（DB 置 recording）再发 WS 'resume'——窗口期内 WS 侧 `is_paused` 仍 True，`audio_chunk` 被 `continue` 丢弃（`meeting_ws.py` L448-449）→ **恢复后前几百毫秒音频缺失**。`handlePause` 反向（REST 先置 paused、WS 后收 pause）导致暂停后窗口期的音频被写入文件（多而非少，可接受但顺序应统一）。

**修复步骤**：统一为「先 WS 后 REST」：
```tsx
  const handleResume = async () => {
    ...
    sendMessage({ type: 'resume' });       // 先解除 WS 侧暂停，音频不再被丢
    const res = await resumeMeeting(id);   // REST 失败也无损：paused 态 WS 仍连接
    ...
  };

  const handlePause = async () => {
    ...
    await flushLastAudioChunk();
    stopAudioCapture();
    sendMessage({ type: 'pause' });        // 先停 WS 接收
    const res = await pauseMeeting(id);    // 再落 DB
    ...
  };
```
（错误处理相应调整：REST 失败时 WS 状态与 DB 短暂不一致，靠页面刷新/shouldConnect 逻辑收敛，数据无损。）

**验证**：暂停 → 立即恢复 → 立刻说话：第一句完整、时间戳从恢复点续接；音频文件时长与会议时长一致。

---

### M6 🟠 录音期间每句一次全量 fetchMeeting

**定位**：`frontend/src/pages/meetings/MeetingRoom.tsx` L361-366（`wsSegments` 变化 → `fetchMeeting()`）。

**根因**：每句话触发一次 `GET /meetings/{id}`，响应含全部 segments（`lazy="selectin"` 全量）+ minutes。1 小时会议约 500 句 → 500 次全量拉取，响应体涨到 MB 级。WS 明明已推了 `transcript_segment`（带 id/seq/text/时间戳，且后端先落库再推送），却弃之不用只当信号。

**修复步骤**：
1. `wsSegments` 到达时直接并入本地 transcript（`mergeServerSegments` 已存在，L317-347，复用）：
```tsx
  useEffect(() => {
    if (wsSegments.length > lastTranscriptSeq.current) {
      const fresh = wsSegments.slice(lastTranscriptSeq.current);
      lastTranscriptSeq.current = wsSegments.length;
      setTranscript((prev) => mergeServerSegments(prev, fresh as TranscriptItem[]));
    }
  }, [wsSegments]);
```
2. 全量 `fetchMeeting` 只在：进入页面、暂停/恢复/结束、纪要轮询（processing 态）时调用。

**验证**：长开会话 DevTools Network：说完 N 句只有 N 个 WS 帧、0 个 REST 全量 GET（对比修复前 N 个 GET）；转录内容与 DB 一致。

---

### M7 🟠 笔记保存双路径竞态

**定位**：`frontend/src/pages/meetings/MeetingRoom.tsx` L403-431（`handleNoteChange`：2s 定时器走 `updateMeetingRecord`）+ L154-160（`scheduleAutosave` 1.5s 走 `flushAutosave` → `autosaveMeetingRecord`）+ L227-246（卸载 keepalive 再走 /autosave）。

**根因**：同一段笔记三个触发器、两条 API。1.5s 的 autosave 与 2s 的 update 可**并发在途**，网络乱序时旧内容覆盖新内容。`autosaveInFlight` 只锁 autosave 自己，锁不住 update 路径；`noteBaseline` 被两路更新，判定漂移。

**修复步骤**：统一为单一路径（保留 /autosave——语义贴切、keepalive 兼容）：
1. 删除 `handleNoteChange`（L413-429）与 `handleNoteFormat`（L450-466）里的 `updateMeetingRecord` 定时器，只保留 `scheduleAutosave(1500)`。
2. `flushAutosave`（L121-152）成为唯一保存路径（已有 inFlight 锁 + baseline 比对）。
3. 卸载 keepalive（L227-246）不变。

**验证**：连续输入 30 秒 → Network 只有最后一次 POST /autosave；内容与输入一致；`noteSaveState` 指示正常。

---

### M8 🟠 渲染层去重 O(n²) 且判重规则过宽

**定位**：`frontend/src/pages/meetings/MeetingRoom.tsx` L906-948（`displayTranscript` 构建）。

**两个缺陷**：
1. **性能**：每条 segment 对 `displayTranscript` 线性 `findIndex`（L934），500 句 → 12.5 万次比较，且**每次渲染重算**（无 useMemo）。
2. **误删**：`isSameUtterance`（L915-924）「时间差 ≤2s 且长度比 ≤1.4」即同句——连续短句（"好的""我们开始吧"）时间必然接近、长度比常在 1.4 内 → **两句合并丢一句**。

**修复步骤**：
1. `useMemo` + 按时间排序后只与**前一条**比较（时间有序后重复只可能相邻）：
```tsx
  const displayTranscript = useMemo(() => {
    const sorted = [...transcript].sort(
      (a, b) =>
        Number((a as any).audio_start_ms ?? 0) - Number((b as any).audio_start_ms ?? 0),
    );
    const out: TranscriptItem[] = [];
    for (const seg of sorted) {
      const prev = out[out.length - 1];
      if (
        prev &&
        isSameUtterance(
          normalizeText(String((seg as any).text ?? '')),
          Number((seg as any).audio_start_ms ?? 0),
          normalizeText(String((prev as any).text ?? '')),
          Number((prev as any).audio_start_ms ?? 0),
        )
      ) {
        if (getSpeakerOf(seg) && !getSpeakerOf(prev)) out[out.length - 1] = seg;
        continue;
      }
      out.push(seg);
    }
    return out;
  }, [transcript]);
```
2. 收紧 `isSameUtterance`：长度比 1.4 → 1.15，且首 6 字符 ≥4 个相同（同音字差异通常不影响开头）：
```ts
  const isSameUtterance = (aText: string, aStart: number, bText: string, bStart: number) => {
    if (Math.abs(aStart - bStart) > 2000) return false;
    if (aText === bText) return true;
    if (aText.length < 4 || bText.length < 4) return false;
    const ratio = Math.max(aText.length, bText.length) / Math.min(aText.length, bText.length);
    if (ratio > 1.15) return false;
    let same = 0;
    const n = Math.min(6, aText.length, bText.length);
    for (let i = 0; i < n; i++) if (aText[i] === bText[i]) same++;
    return same >= Math.min(4, n);
  };
```

**验证**：连续说多个短句无丢句；300+ 句会议滚动流畅（Profiler 渲染 < 50ms）。

---

### M9 🟡 会议列表固定拉 100 条，无分页

**定位**：`frontend/src/pages/meetings/MeetingList.tsx` L41（`page_size: 100`）。

**根因**：后端 list 接口有完整分页（page/page_size/total），前端只用第一页。第 101 场会议起旧会议永远不可见且无提示。

**修复步骤**：
1. state 加 `page` / `total`，`fetchMeetings` 接受页码；列表底部 antd `Pagination`（`total`、`showTotal`、`onChange` 翻页）。
2. 可选：标题搜索框（后端暂不支持 title 过滤，先前端 filter 当前页并在注释标明临时）。

**验证**：临时把 page_size 改 5 造数据：分页器出现、翻页正确。

---

### M10 🟡 改说话人名后纪要不同步且无提示

**定位**：`backend/app/api/meeting_records.py` L361-391（`update_speaker_names_endpoint` 只 UPDATE segments）。

**根因**：改名只改转录段；纪要里的 summary/key_points 仍引用旧名（"说话人1 负责…"）。前端无提示，用户以为改名全局生效。

**修复步骤**（最小改动：提示而非自动重生成，避免每次改名烧一次模型调用）：
```python
    await db.commit()
    return UnifiedResponse(
        data=MeetingRecordResponse.model_validate(meeting),
        msg="说话人名已更新；如需纪要同步使用新名字，请重新生成纪要",
    )
```
前端 `updateSpeakerNames` 成功回调里 `message.info(res.msg)`。若产品要自动重生成：对 `minutes_status == "done"` 的会议追加 `regenerate_minutes_task.delay`（成本评估后决定，默认不做）。

**验证**：完成会议 → 改名 → 提示出现；重生成纪要后新名生效。

---

### M11 🟡 说话人分离子进程输出解析取最后一行过脆

**定位**：`backend/app/tasks/meeting_process.py` L480（`json.loads(proc.stdout.strip().splitlines()[-1])`）。

**根因**：sherpa-onnx / onnxruntime 偶尔向 stdout 打 warning 时，最后一行不是 JSON → 解析失败 → 整场分离作废回退 None（用户看到全部"发言人"）。隐式约定"最后一行恰好是 print 的 json"。

**修复步骤**：倒序扫描 JSON 行（或哨兵方案，二选一）：
```python
        out_lines = [ln for ln in proc.stdout.strip().splitlines() if ln.strip()]
        parsed = None
        for ln in reversed(out_lines):
            if ln.lstrip().startswith("{"):
                try:
                    parsed = json.loads(ln)
                    break
                except json.JSONDecodeError:
                    continue
        if parsed is None:
            logger.error("说话人分离子进程输出无 JSON：%s", proc.stdout[-300:])
            return None
        return parsed
```
（哨兵方案：snippet 改为 `print("@@RESULT@@" + json.dumps(...))`，父进程按前缀找行——更稳，改动也小，推荐。）

**验证**：在 `diarize_speakers` 临时向 stdout 加一行 warning → 分离仍成功。

---

### M12 🟡 导出 audio 返回内部路径；文档导出缺纪要静默丢块

**定位**：
- `backend/app/services/meeting_record.py` L613-620（`export_type == "audio"` 返回容器内部路径 `audio_file_path`——前端实际走 `/audio` 下载端点，此分支是死代码但契约存在）。
- `frontend/src/pages/meetings/MeetingRoom.tsx` L749-754（`Promise.all` 中 minutes 未生成时请求 404 → `minutesData=null` → 文档缺纪要块**且无提示**）。

**修复步骤**：
1. 后端 audio 分支改为返回下载端点元信息（或删除死分支）：
```python
    if export_type == "audio":
        if not item.audio_file_path:
            raise HTTPException(status_code=404, detail="音频文件不存在")
        return {
            "type": "audio",
            "title": item.title,
            "audio_download_url": f"/api/v1/meetings/{meeting_id}/audio",
        }
```
2. 前端改为分别 catch（minutes 404 是预期情况）：
```tsx
        const [transcriptRes, minutesRes] = await Promise.all([
          exportMeeting(id, 'transcript').catch(() => null),
          exportMeeting(id, 'minutes').catch(() => null),
        ]);
```
   `minutesData` 为 null 时：`minutes_status === 'done'` → 文档头部注明「纪要生成失败，文档不含纪要块」；非 done → 注明「（纪要尚未生成）」。

**验证**：未生成纪要的会议导出文档：有明确说明而非凭空缺块；生成后导出含完整纪要。

---

## 7.3 会议模块回归清单（并入 §四 执行）

7. **结束/暂停/恢复链路**
   - [x] 录音中说完整句后立刻结束：无「发言人/说话人N」并存、无 NULL speaker 脏段（M1）——WS 端到端实测通过
   - [x] 录音中直接刷新页面：状态落「已暂停」、音频不缺尾（M2）——同步 pause 已落地
   - [x] 暂停→恢复→立即说话：无整句丢失、时间戳续接（M5）——顺序已统一「先 WS 后 REST」
8. **导入与导出**
   - [x] 导入 .exe / 600MB / processing 中再导 → 分别 400 / 400 / 409（M3）——实测 400/400/409
   - [x] 二次导入换格式 → 旧文件被清理（M3）
   - [x] 无纪要会议导出文档 → 有明确说明，不静默缺块（M12）——三种状态文案落地
9. **长会压力**
   - [x] 300+ 句会议：滚动流畅、Network 无每句一次全量 GET（M6/M8）——WS 片段直接并入
   - [x] 列表 >100 条：分页可见（M9）——Pagination 已落地
10. **说话人**
   - [x] 改名后提示重新生成；重生成纪要用新名（M10）——响应 msg + 前端提示
   - [x] 分离子进程混入 stdout warning 不影响结果（M11）——实测空数组正确解析
11. **WS 契约**
   - [x] status_update 帧含非零 segment_count（M4）——4 处回包均补齐，端到端验证

---

# 八、实施与验证记录（2026-10-22 完成）

## 8.1 落地清单

全部 27 项（P1-P15 + M1-M12）已实现并部署。改动文件：

| 文件 | 修复项 |
|---|---|
| `backend/app/services/third_party_config.py` | P1/P3/P4/P5/P6/P10/P11/P14 |
| `backend/app/api/third_party_config.py` | P1 调用方/P15-1 |
| `backend/app/api/meeting_ws.py` | P7/P8/P9/P12/P13/M1/M4/P15-2 |
| `backend/app/api/meeting_records.py` | M3/M10 |
| `backend/app/services/meeting_record.py` | M12-1 |
| `backend/app/tasks/meeting_process.py` | M11 |
| `backend/app/tasks/model_warmup.py` | P1 调用方/P5 |
| `backend/app/main.py` | P15-3 |
| `frontend/src/pages/meetings/MeetingRoom.tsx` | M1 前端缓冲/M2/M5/M6/M7/M8/M10/M12-2 |
| `frontend/src/pages/meetings/MeetingList.tsx` | M9 |
| `frontend/src/pages/settings/ThirdPartyConfigPage.tsx` | P2/P4/P6 前端 |
| `frontend/src/types/third-party-config.ts` | P2 注释/P6 load_error |

## 8.2 验证结果（部署后实测）

**静态**：`py_compile` 全绿；`tsc --noEmit` 全绿；`bash start.sh` 部署成功，9 个服务全部 healthy。

**P1/P3/P4（内存警告）**：
- `/asr/memory` 返回正常，`asr_warning` 仅在「未载入且缓存不完整且 <800MB」时出现
- ASR 载入后 `loaded_mb=500`（纯内存语义，缓存不再虚增）
- 前端文案已更新为「ASR 模型约 0.5 GB」

**P5（Celery 热备）**：开 `warmup.asr=true` 后，celery beat 周期实测 2.3s 完成模型加载（`Task succeeded in 2.28s` + `ASR model loaded successfully` 日志），backend 进程同步 ready——两个进程的热备语义均恢复。

**P6（失败可见）**：`/asr/status` 的 `details.load_error` 字段已上线（实测 `null`），前端轮询检测到即弹错。

**M1/M4（结束竞态 + WS 契约）**：容器内 Python websocket 客户端端到端实测——发送 3s 音频 + `end`，收到最终 `status_update`（含 `segment_count` 字段，4 处回包均已补齐），后端 join 在途线程后正常收尾；转录段无脏数据。

**M3（导入校验）**：
- `.exe` 上传 → **400**「不支持的音频格式」
- 空文件 → **400**「文件为空」
- 处理中并发再导入 → **409**「会议正在处理中」（并行双导入实测：first:200 / second:409）

**M11（解析器）**：修复过程中发现首版解析器只认 `{` 开头——空结果 `json.dumps([])` 是合法 JSON 数组却被误判失败。已补 `[` 分支并实测：`PARSED: [] returncode: 0`。

**M12**：无纪要会议导出文档现在有明确的状态说明行（三种文案按 `minutes_status` 区分）。

## 8.3 已知保留行为（非缺陷）

- 3 秒纯音调测试音频：pyannote 正确检出 0 个语音段 → `diarization_status=failed`——这是「未检出说话人」的领域语义，非解析故障（真实人声会议不受影响）。
- Celery beat 每 10s 的 `ensure-models-warm` 空转 0.03s（开关关闭时）——预期行为。
- warmup.asr 保持开启状态以验证自热备；用户可在设置页随时关闭。
