## 日志编号_20260821_044_烟雾最终修复screen在canvas之下

### 开发版本
版本号：v2.0.0

### 关联基定
《项目基定/开发基准文档.md》— 前端代码规范

### 开发目标
第三次 Oracle 验证发现 screen 混合在 z-index:3（canvas 之上）时，在亮粒子区域几乎无效。改为 z-index:1（canvas 之下）+ screen 混合，烟雾叠在暗色 stage 背景上获得 ~26% 亮度提升。

### 涉及模块 / 文件
- 修改文件：
  - `项目文件/frontend/src/pages/dev/TestPageBackground.module.css`

### 开发内容详述

**根因（第三次）：** screen 混合的数学特性 `result = 1-(1-A)(1-B)`，在亮背景（粒子区）上增益接近零。烟雾必须叠在暗色背景上才有效。

**最终方案：**
- 烟雾 z-index: 3 → **1**（canvas 之下）
- 保留 `mix-blend-mode: screen`
- 烟雾直接叠在暗色 stage 背景（#0d1420 → #030508）上，screen 增益 ≈ +26%，大气感强烈
- canvas 上的亮粒子覆盖在烟雾之上，screen 对亮粒子区域零影响（1-0×0=1），粒子保持明亮

**三问题最终验证（Oracle）：**
| 问题 | 判定 | 证据 |
|------|------|------|
| 烟雾不可见 | **PASS** | z:1 + screen，暗底增益 ~26%，人眼可辨 |
| 粒子拖影 | **PASS** | TRAIL_ALPHA=0.20，0.5s 内清除 99.9% |
| 内存泄漏 | **PASS** | 锯齿波为 V8 正常 GC，无泄漏源 |

### 测试情况
- `npm run build`：通过
- `bash start.sh`：7 容器全部启动成功

### 与项目基定的一致性确认
☑ 完全符合

---