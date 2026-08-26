# TestPageAftermath「点击开始使用」衔接动画设计与实施计划

> 状态：**待确认**（用户审阅后进入实施）
> 关联文件：`项目文件/frontend/src/pages/dev/TestPageAftermath.tsx` / `.module.css`
> 基线：以**当前代码**为准（非设计文档中不存在的 uniform 体系）
> 版本：v2.0.0（开发中）

---

## 一、目标

在「开始使用」箭头由纯展示改为**可点击按钮**后，触发一段**连贯的衔接动画**（总时长约 6s，从容节奏），
动画在**屏幕全白**处收尾，并**平滑转场进入主界面（/）**。

### 核心效果（用户需求逐条映射）

| # | 需求 | 阶段 |
|---|------|------|
| 1 | 中间 UNIFIED WORKBENCH 粒子数**平滑变为 22750**（全粒子汇聚成型） | Phase A |
| 2 | **同步**在两侧把这些粒子**吸走**的感觉 | Phase B |
| 3 | 快被吸完时，将背景网格**中间压暗区域去除**，平滑过渡 | Phase C |
| 4 | **全局亮度平滑恢复** | Phase C |
| 5 | 网格运动速度**持续类似指数型提升** | Phase D |
| 6 | 后面开始**从曲面变为平面** | Phase E |
| 7 | 速度够快导致**屏幕全白**，有**模糊**和平滑过渡 | Phase F |
| 8 | 全白后**进入主界面/下一阶段** | Phase G |

---

## 二、现状基线（必须保留的既有逻辑）

- 两层渲染：Pass 1 网格（禁混合）→ Pass 2 粒子（加法混合 `ONE/ONE_MINUS_SRC_ALPHA`）。
- 粒子总量固定 22750（65 流 × 350）。
- 打字机 → 删除 → 汇聚（1.0s，`cw/sw` 非线性插值）→ 稳态 → 2s 后显示箭头。
- GRID_FS 当前仅 `u_time/u_res/u_darken` 三个 uniform；凹面 k、flow、bandDarken、vignette、色散均**硬编码**在着色器内。
- 汇聚成型后，`fadeOut = i < 8000 ? 1.0 : max(0, 1-cw)`，**仅前 8000 粒子显示文字**。
- 箭头样式：`scrollHint` 容器 + 双 chevron SVG + `hintText`「开始使用」，`pointer-events: none`。

---

## 三、需要新增的网格 Uniform（从硬编码提取为可控参数）

为支撑动画，把 GRID_FS 中以下硬编码值**提取为 uniform**（新增声明 + frame() 传值 + JS 侧 uniform 对象）：

| uniform | 类型 | 稳态默认 | 含义 |
|---------|------|---------|------|
| `u_concavity` | float | 1.0 | 凹面强度（k = 1.5 * u_concavity） |
| `u_flowSpeed` | float | 1.0 | 网格流动速度倍率 |
| `u_bandDarken` | float | 1.0 | 中间暗带强度（0 = 去除压暗） |
| `u_brightness` | float | 1.0 | 全局亮度（>1 变亮） |
| `u_white` | float | 0.0 | 全白叠加量（0→1） |
| `u_blur` | float | 0.0 | 模糊强度 |

> **兼容性**：稳态默认值全部为既有硬编码值（k=1.5→concavity 1.0、flow=sin*0.2→flowSpeed 1.0、bandDarken 原逻辑→1.0、无白→0、无模糊→0），因此**稳态渲染与当前完全一致**，不改变既有观感。

### 着色器改造要点

```glsl
// 凹面
float k = 1.5 * u_concavity;
float scale = 1.0 / (1.0 + k * r2);

// 流动（速度指数提升由 flowSpeed 驱动）
float flow = sin(mod(u_time * 0.05 * u_flowSpeed, 6.28318)) * 0.2;

// 中间暗带（可去除）
float bandDarken = mix(1.0, smoothstep(0.05, 0.55, abs(sc.y)), u_bandDarken);

// 亮度
col *= (1.0 - u_darken * 0.7) * u_brightness;

// 全白 + 模糊（最终叠加）
col = mix(col, vec3(1.0), u_white);
```

> 模糊若用 GPU 高斯（多 tap 采样网格线）成本高，建议**用"亮度提升 + 全白 + 少量色散/网格线密度视觉淡化"模拟模糊感**，最后全白覆盖。详见 Phase F。

---

## 四、完整时间线（点击 t=0，总约 6s）

> 阶段间**平滑过渡**，`ease` 统一用 `smoothstep` / 现有 cw-sw 非线性插值风格。

| 时间 | 阶段 | 粒子行为 | 网格 uniform 变化 |
|------|------|---------|-------------------|
| 0 – 0.8s | **A 汇聚满额** | 粒子从稳态平滑汇聚，**fadeOut 取消**，全部 22750 汇聚成型 UNIFIED WORKBENCH，文字更饱满 | 无变化（稳态） |
| 0.8 – 2.4s | **B 两侧吸走** | 文字粒子被**吸向左右两侧**（水平速度场向外、竖直轻微张开），像被抽走 | 无变化或轻微 |
| 1.8 – 3.0s | **C 去暗带+提亮** | 粒子持续被吸走、渐少 | `u_bandDarken 1.0→0`（中间暗带平滑去除）、`u_brightness 1.0→1.4`（全局平滑变亮） |
| 2.4 – 4.2s | **D 网格加速** | 粒子基本吸完，屏幕粒子稀少 | `u_flowSpeed 1.0→约 18`，**指数型提升**（`speed = 1 + (exp(k·t)-1)/C` 曲线） |
| 3.4 – 4.8s | **E 曲面变平面** | — | `u_concavity 1.0→0`（k 1.5→0，曲面摊平为平面），与加速叠加 |
| 4.2 – 5.4s | **F 全白+模糊** | — | `u_white 0→1`（屏幕泛白）、亮度继续提升制造模糊过曝、`u_blur` 视觉模糊 |
| 5.4 – 6.0s | **G 全白收尾转场** | — | 全白纯色，触发 `navigate('/')` 进入主界面 |

### 阶段节奏细节

- **A 汇聚**：复用既有 `convergeTriggeredRef` 机制，但把 `fadeOut` 改为**不淡出**（让 22750 全部成型），汇聚保持 1.0s 内的平滑。
- **B 吸走**：新增"吸走力场"——每个粒子获得指向左或右的水平速度，随距中心越远越强，形成两侧抽走感。可复用随机 `hash` 决定左右，避免中间一刀切（与既有瓦解随机方向一致）。
- **C 去暗带**：动画在"粒子快吸完"时启动，非固定时间，可与 B 末期联动（用"剩余粒子比例"或时间触发）。
- **D 指数加速**：`flowSpeed(t) = 1 + (Math.exp(k * phaseT) - 1) * M`，k≈2.0，M≈18，实现"持续类似指数型提升"。
- **F 全白**：`u_white` 用 `smoothstep` 从 0→1，同时 `u_brightness` 升到 2.0+，配合 `u_concavity→0` 平面化，形成"速度过快拉成白屏"的过曝模糊感。

---

## 五、触发与转场

### 5.1 箭头改为可点击按钮

- `.scrollHint` 去掉 `pointer-events: none`。
- 外层加 `onClick`，回调启动衔接动画（设置 `transitionTriggeredRef = true`）。
- 点击后**隐藏箭头**（`setShowArrow(false)`），同时可加一次点击反馈（scale 0.96 按下感）。

### 5.2 全白后进入主界面

- 在 `frame()` 检测全白阶段完成（`u_white` 达 1 且持续约 0.4s），调用 `onComplete` 回调或组件内 `useNavigate`。
- 默认 `navigate('/', { replace: true })`（与既有"返回工作台"一致）。
- 设计为**可选回调** `onComplete?`，便于测试页复用或未来接入真实欢迎流程。

---

## 六、涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/pages/dev/TestPageAftermath.tsx` | 新增 uniform；提取硬编码；新增衔接动画状态机/阶段计时；箭头 onClick；全白转场 |
| `frontend/src/pages/dev/TestPageAftermath.module.css` | 箭头改为可点击（去 pointer-events、加 hover/active 反馈） |

> 不改路由、不改后端、不改其它组件。

---

## 七、实施步骤（分 Task，验证后提交）

### Task 1 — 提取网格 Uniform（无视觉变化）
1. GRID_FS 新增 6 个 uniform 声明：`u_concavity / u_flowSpeed / u_bandDarken / u_brightness / u_white / u_blur`。
2. 将 k、flow、bandDarken、亮度、白叠分别改为乘/插值上述 uniform。
3. frame() 中获取 location 并传稳态默认值（concavity=1, flowSpeed=1, bandDarken=1, brightness=1, white=0, blur=0）。
4. 验证：构建通过；稳态渲染与改动前逐像素一致（目测）。

### Task 2 — 箭头可点击 + 触发衔接动画状态机
1. CSS：`scrollHint` 去 `pointer-events:none`；加 `cursor:pointer`、hover 提亮、active 缩放。
2. TSX：`showArrow` 外层加 `onClick`；点击隐藏箭头并置 `transitionTriggeredRef.current = true`。
3. 新增阶段计时 ref（`transitionStartRef`），在 update/frame 中按时间线推进阶段。

### Task 3 — Phase A/B 粒子行为（汇聚满额 + 两侧吸走）
1. 取消 `fadeOut`，让 22750 全粒子汇聚成型。
2. 新增"吸走力场"：B 阶段粒子获水平向外的速度，竖直微张，形成两侧抽走感。

### Task 4 — Phase C/D/E/F 网格动态（去暗带、提亮、指数加速、平面化、全白模糊）
1. 在 frame() 按时间线计算 6 个 uniform 的插值目标并传值。
2. C：bandDarken→0、brightness→1.4（smoothstep）。
3. D：flowSpeed 指数曲线（exp 提升至 ~18）。
4. E：concavity→0（平面化）。
5. F：white→1、brightness→2.0+、blur 视觉模糊。

### Task 5 — 全白转场进入主界面
1. 全白阶段完成（white≈1 持续 0.4s）触发 `navigate('/')`。
2. 用 `useNavigate` 或 `onComplete` 回调。
3. 验证转场平滑、无闪烁。

---

## 八、验证

- `cd 项目文件/frontend && npm run build`：TypeScript + Vite 无错。
- 容器重建：`docker compose build frontend && docker compose up -d --no-deps frontend`（或 start.sh 全量）。
- 浏览器 `/dev/testpage/animation-aftermath`：
  - 稳态渲染与改造前一致（无回归）。
  - 点击「开始使用」→ 隐藏箭头 → 汇聚 22750 → 两侧吸走 → 去暗带提亮 → 指数加速 → 平面化 → 全白 → 进入主界面。
  - 全程平滑、无跳变、深浅色正常。

---

## 九、风险与回退

| 风险 | 缓解 |
|------|------|
| 新增 uniform 后稳态渲染有偏差 | Task 1 单独验证逐像素一致后再继续 |
| 22750 全粒子汇聚可能过密 | A 阶段用平滑插值收敛，必要时限制单粒子亮度 |
| 全白过曝刺眼 | 用 smoothstep 缓入 + 模糊过渡，非瞬间跳变 |
| 指数加速导致 flow 溢出/闪烁 | 限制 flowSpeed 上限，白屏前完成 |
| 转场进主界面时机不稳 | 以 white≥0.99 且持续 0.4s 为唯一触发条件 |

**回退**：每个 Task 独立提交，可单独 revert；稳态默认值保底不破坏既有观感。

---

## 十、待办/待确认（实施前）

- [x] 全白后 → 进入主界面（用户已确认）
- [x] 箭头 → 可点击并隐藏（用户已确认）
- [x] 总时长 → 5-8s（用户已确认，采用 6s）
- [ ] 全白转场目标路径确认（默认 `/` 主界面，是否需跳转测试页索引？）
- [ ] 模糊实现方式确认（GPU 多 tap 高斯 vs 亮度过曝模拟——推荐后者，低成本）
