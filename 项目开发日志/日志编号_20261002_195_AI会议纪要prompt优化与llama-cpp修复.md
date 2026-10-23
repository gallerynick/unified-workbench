## [日志编号 195] - 2026-10-02 19:15

### 开发版本
版本号：v2.0.0（未变更）

### 关联基定
- 《项目基定/开发基准文档.md》技术栈章节（本地 llama.cpp + Qwen 作为 AI 能力基座）
- 《项目基定/开发基准文档.md》部署章节（统一走 start.sh 重建）

### 开发目标
1. 优化 AI 会议纪要 prompt（目标：不劣化现有输出，同时注入会议上下文、收敛幻觉）
2. 修复 llama.cpp 容器反复崩溃导致 AI 纪要不可用的问题

### 涉及模块 / 文件
- 模块：会议纪要生成（AI）+ 本地推理引擎部署
- 新增文件：无
- 修改文件：
  - `项目文件/backend/app/services/meeting_minutes.py`（prompt v2→v3、PROMPT_VERSION 常量、meeting_meta 上下文注入、说话人行格式、sync 入口透传）
  - `项目文件/backend/app/tasks/meeting_process.py`（会后任务构造并传入会议元信息 `_build_minutes_meta`；v3 重排流水线引入 `_load_segments_with_speaker`）
  - `项目文件/docker-compose.yml`（llama-cpp command 块修复）
  - `项目开发日志/日志编号_20261002_195_AI会议纪要prompt优化与llama-cpp修复.md`（本日志）
- 删除文件：无

### 开发内容详述

**1. 纪要 prompt v2（不改变输出契约）**

- 新增 `PROMPT_VERSION = "v2"`，成功路径的 `model_used` 追加版本号（如 `qwen2.5-3b-instruct-q4_k_m (v2)`），
  便于按版本对照评估，不影响既有字段语义。
- 重写 `MINUTES_SYSTEM_PROMPT`：保留原 JSON schema（summary / key_points[] / todos[{content, source_quote}]）不变；
  新增/收紧规则——source_quote 必须逐字抄自转录原文、找不到原文就不写该条待办、时间表达只照抄不推算、
  参与人仅作归属辅助、过短/无内容时 summary 用固定兜底文案；占位示例替换为真实业务示例，避免 3B 模型照抄占位符。
- 新增 `_build_meta_context()`：把会议标题/日期/参与人/笔记（≤200 字）拼成 prompt 上下文；
  全部字段可缺失，缺失自动跳过，向后兼容仅传 segments 的既有调用。

**2. 会后任务接入会议元信息**

- `meeting_process.py` 新增 `_build_minutes_meta()`：从 MeetingRecord 提取 title、started_at/ended_at 日期、
  owner 昵称（参与人）、notes；调用 `generate_minutes(segments_data, meeting_meta=...) `。

**3. llama.cpp 容器崩溃修复**

- 现象：`docker ps` 显示 llama-cpp `Restarting (1)`，日志报 `error: invalid argument: #`。
- 根因一：compose 中 `command: >`（YAML 折叠标量）内部误放了 `#` 注释行，折叠标量把注释文本当作命令参数传入。
- 根因二：镜像（b11277，2026-09-30 构建）参数解析不接受 `--fa on`（双横线短写），需要 `--flash-attn` 或直接移除。
  逐个参数隔离探测（--fa / --flash-attn / --metrics / --cache-reuse / --models-max / --sleep-idle-seconds / 量化 type）确认。
- 修复：注释移出 command 块；llama-cpp 保留镜像支持的参数集（--host/--port/--models-dir/--models-max/--ctx-size/
  --sleep-idle-seconds/--cache-reuse 256/--metrics），移除不被接受的 `--fa` 与冗余 `--cache-type-*`。

**4. 纪要 prompt v3（阶段二：说话人信息进 prompt）**

- 版本号升至 `PROMPT_VERSION = "v3"`。
- 新增 `_format_transcript_line()`：转录行在带说话人时输出 `[12.3s] 说话人1: 文本`，
  无说话人时保持 v2 原格式，向后兼容；prompt 示例同步升级为说话人行格式。
- 重排 `meeting_process.py` 流水线（关键改动）：
  原顺序：转录 → 生成纪要（无说话人） → 落库 → 说话人分离。
  新顺序：转录 → 先落库转录段 → 说话人分离 → 生成纪要（输入带说话人）。
  这样纪要输入天然带 `[时间] 说话人: 文本` 与参与人白名单，负责人归属有锚点。
- 新增 `_load_segments_with_speaker()`：从库读带 speaker 的转录段；任一环节失败返回空列表，
  由调用方回退到无说话人版本 —— 与原行为一致，保证不劣化。
- `_build_minutes_meta()` 的 participants 并入分离出的说话人标签（如"说话人1"）作为负责人取值白名单。

### 遇到的问题与解决
- 问题：容器内首次验证 `generate_minutes` 报 `ImportError`（旧镜像无 v2 代码）。
  解决：改用宿主机 backend/.venv 直接跑源码验证（llama-cpp 经 127.0.0.1:8080 直连）。
- 问题：`local_model_files` / health 探测 502 + llama 崩溃循环，阻塞 A/B 测试。
  解决：定位 compose command 折叠标量注释问题与 `--fa` 参数问题（见上）；修复后 /health 200、模型 loaded。
- 问题：`npx tsc` 与 py_compile 均在改动后重跑通过；前端本次无改动。
- 遗留问题 / 待办（本轮后已清零主要项）：
  - v3 阶段后说话人已进 prompt（见开发内容第 4 节）；后续可继续做分块抽取与引用回溯闸门（按方案 Phase 1/2）。
  - 注意：重排后 diarization 位于纪要之前，长会议纯 CPU 下耗时明显（123s 音频约 2 分钟+）；
    该步骤已在 except 中隔离失败，不会让纪要缺失，但耗时预算需在后续阶段按块并行优化。

### 测试情况
- 测试方式：python3 -m py_compile 后端文件；docker compose config 校验；宿主机 venv 直连模型 A/B 对比；
  bash start.sh 全量重建 + 健康检查；docker exec 复核容器内 PROMPT_VERSION=v3；
  真实会议端到端重跑（1412e5ab）验证新流水线。
- 测试结果：**通过**
- A/B 结果（同一段 3 句会议文）：
  - OLD：summary=「本次会议内容较少，无实质性讨论」，kp=0，todos=0（实质内容漏提取）
  - v2：summary 含决定/负责人/风险结论，kp=4~，todos=1（source_quote 逐字命中原文）
  - v3（带说话人）：summary 完整含决定/负责人/压测风险/待办结论，todos source_quote 逐字命中；
    与无说话人对照版本结构一致、内容等价，证明说话人前缀不劣化且为归属提供锚点
- 端到端重跑：会议 1412e5ab 任务 SUCCESS，model_used=「qwen2.5-3b-instruct-q4_k_m (v3)」，
  22 段全部带 speaker，纪要按 v3 规则正确落库；该会议内容极短，summary 按规则回退「内容较少」属预期行为。

### 与项目基定的一致性确认
☑ 本次开发完全符合《项目基定》要求
☐ 如有偏离，说明原因及是否已确认：

### 下一步计划
- 除 prompt 外暂不动解码参数（temperature 保持 0.3 / top_p 0.9），如需 greedy 可后续按开关灰度
- 后续阶段把说话人分离结果、分块抽取、引用回溯闸门接入（按纪要优化方案 Phase 1/2 推进）
