# ASR 识别线重构计划（最终执行版）

> 状态：**已完成并上线（2026-10-01）**
> 创建日期：2026-09-30
> 变更：2026-10-01 **改为一次执行**：换引擎 + 纯 ONNX + 说话人分离 + 架构，全部本轮完成
> 变更：2026-10-01 **实施完成**，实测结果见 §六
> 变更：2026-10-01 **会议场景层完成**：句子切分改用 webrtcvad（见 §2.4），实时/离线转写全链路验证通过
> 关联：《本地模型轻量化优化计划》《问题记录/实时语音听写问题诊断与会议场景优化方案》
> 需求来源：ASR 从 `paraformer-zh` 换到 `SenseVoice`，彻底转向、清除遗留，并借变更定下「公用识别线」契约。
> 上位原则：**在达到同等效果的前提下减少资源占用；用不到的不要留。**

---

## 一、目标与约束

### 1.1 核心原则
1. **同等效果下减资源**
2. **彻底转向**：paraformer / ct-punc / cam++ / torch 全部清除，无残留
3. **一次执行**：引擎 + 运行时 + 说话人分离 + 架构，本轮全做完

### 1.2 范围（全部本轮）
| 项 | 说明 | 状态 |
|---|---|---|
| 换引擎 | paraformer-zh → **SenseVoice ONNX** | ✅ 完成 |
| 换运行时 | funasr + torch → **funasr-onnx + onnxruntime**（去 torch） | ✅ 完成 |
| 说话人分离 | cam++ → **sherpa-onnx 声纹分离**（纯 ONNX，免预录聚类） | ✅ 完成 |
| 架构 | 立「公用识别线」契约 | ✅ 完成 |
| 会议场景 | 句子切分 + 时间戳 + 串句修复 | ✅ 完成 |
| 清理 | paraformer / ct-punc / cam++ 模型与代码全删 | ✅ 完成 |

---

## 二、技术方案

### 2.1 引擎与模型（实测）

| 角色 | 旧（torch） | 新（ONNX） | 实测体积 |
|---|---|---|---|
| 主模型 | seaco-paraformer（953 MB） | SenseVoiceSmall ONNX（**230 MB**） | −723 MB |
| 标点 | ct-punc（1132 MB） | **不需要**（`textnorm=withitn` 自带） | −1132 MB |
| 句子切分 | fsmn-vad（4 MB） | **webrtcvad**（纯 C，无模型） | −4 MB |
| 声纹 | cam++（28 MB） | sherpa-onnx 声纹分离（**46 MB**） | +18 MB |
| **模型合计** | **2117 MB** | **277 MB** | **−1840 MB** |
| 运行时 | torch 656 + 相关 ~1.4 GB | onnxruntime ~60 MB | **镜像已去 torch** |

### 2.2 说话人分离（sherpa-onnx，免预录）

`整段音频 → pyannote 分割（检测语音段）→ 3D-Speaker 嵌入（声纹向量）→ 聚类 → [start, end, speaker]`

- **免预录**：当场聚类区分说话人，不识别身份（名字需另行映射）
- **实测**：4 说话人测试音频分 7 类（`cluster_threshold` 可调控制粒度）

### 2.3 公用识别线契约（架构）

`场景层（会议等）→ 统一调用 → 公用识别线 asr_engine（生命周期/转写/切句/契约）`

- **转写只返回文本**（SenseVoice ONNX 无时间戳），句子边界与时间戳由切句层提供

### 2.4 句子切分：webrtcvad（重要决策）

**原方案用 sherpa-onnx Silero VAD 切句，实测发现 OOM**：Silero 与 SenseVoice 各持一个 onnxruntime session，两个 ORT session 并存让进程内存 commit 超 Docker VM overcommit 上限（本机 VM 8.7GB / CommitLimit 5.5GB），推理时被 OOM 杀掉。

**改用 webrtcvad（纯 C 库，不创建 ORT session）**：
- 与 SenseVoice 并存**零额外内存**，无 OOM
- 20ms 帧级语音活性判断，静音超时切句
- 效果优于固定阈值 RMS，低于 Silero（可接受，会议场景够用）

**sherpa-onnx 仅保留用于说话人分离**（会后处理，独立 session，与 ASR 顺序执行）。

---

## 三、执行步骤（全部完成）

- [x] 依赖：pyproject 换 `funasr-onnx` / `onnxruntime` / `sherpa-onnx` / `webrtcvad`，Dockerfile 删 torch
- [x] 模型：SenseVoice ONNX（230 MB）+ sherpa 声纹两件（46 MB）
- [x] 引擎：`asr_engine.py` 重写（SenseVoice ONNX + 标签清洗 + 切句工具）
- [x] 说话人：`speaker_diarization.py` 重写（sherpa-onnx）
- [x] 会议场景：`meeting_ws.py`（webrtcvad 切句 + 串句修复 + 参数生效）
- [x] 离线链路：`tasks/meeting_process.py`（webrtcvad 切句 + 说话人分离 + 纪要）
- [x] 配置：默认 `model=sensevoice`，删 punc/spk 槽位；DB 迁移
- [x] 清理：paraformer / ct-punc / cam++ / fsmn-vad / SenseVoiceSmall(torch) 缓存全删
- [x] 前端：ASRConfig 字段、DEFAULT_CONFIG、模型描述同步
- [x] 死代码：`services/meeting_processor.py` 删除（职责并入 Celery 任务）

## 四、风险与已知边界

| # | 项 | 说明 | 状态 |
|---|----|------|------|
| R1 | SenseVoice ONNX 时间戳 | 实测无时间戳 → 由切句层提供 | ✅ 已定 |
| R2 | 两套运行时并存 | funasr-onnx 与 sherpa-onnx 均装，各自锁版本 | ✅ 已装 |
| R3 | **Silero VAD + SenseVoice OOM** | 两个 ORT session 并存超 VM commit 上限 | ✅ 已解决（webrtcvad） |
| R4 | 说话人只给编号不给名字 | 名字映射需人工/设备来源 | ⚠️ 已知边界 |
| R5 | 说话人聚类偏细 | 4 人分 7 类，`cluster_threshold` 可调 | ⚠️ 参数待调 |
| R6 | webrtcvad 灵敏度低于 Silero | 会议场景够用 | ✅ 接受 |

## 五、验收标准（实测结果）

1. ✅ 效果：真实语音中文准确 + 自带标点（`textnorm=withitn`）
2. ✅ 无双标点
3. ✅ 时间戳：句子级（实时与离线均验证）
4. ✅ 说话人分离：免预录聚类 + 时间戳匹配（21 段分 7 人）
5. ✅ torch 完全移除（镜像 import 失败 = 无 torch）
6. ✅ 资源：模型 2117 → 277 MB；镜像去 torch
7. ✅ 实时转写：WS 链路无 OOM，句子级转录
8. ✅ 离线链路：转写 + 说话人 + 纪要一次跑通（32s）

## 六、实测结果（2026-10-01）

| 项 | 结果 |
|---|---|
| 服务健康 | 全部 healthy |
| SenseVoice 加载 | 2.2s |
| 句子切分（webrtcvad） | 0.05s / 57s 音频 |
| 实时转写 | WS 链路句子级转录 + 时间戳 + 标点 |
| 离线会议处理 | 32s 完成转写 + 说话人 + 纪要 |
| 说话人分离 | 免预录，21 段分 7 人 |
| torch | 镜像中已不存在 |
| 模型缓存 | 3014 MB → 277 MB |
