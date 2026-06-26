---
slug: signature-component
status: drafting
intent: clear
pending-action: write .omo/plans/signature-component.md
approach: <fill: the approach you intend to plan>
---

# Draft: signature-component

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
1. canvas-engine - Canvas绘图引擎，处理线条绘制、平滑、性能优化
2. event-handler - 事件处理系统，统一处理鼠标、触摸、指针事件
3. pressure-detector - 压力感应检测，识别设备类型和压力支持
4. mode-controller - 模式切换逻辑，管理传统模式和压力感应模式
5. data-exporter - 数据导出/保存，支持多种格式（PNG、SVG、JSON路径）

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->
1. 使用HTML5 Canvas API而不是SVG - Canvas更适合实时绘图和压力感应
2. 使用Pointer Events API而不是Mouse/Touch Events - Pointer Events统一处理各种输入设备
3. 使用signature_pad库作为基础 - 成熟稳定，支持压力感应
4. 默认签名颜色为黑色 - 简化实现，符合签名场景
5. 默认画布背景为白色 - 标准签名场景
6. 签名数据同时支持PNG和JSON格式 - PNG用于显示，JSON用于回放和编辑
7. 压力感应模式下，移动即绘制（不需要按下） - 符合MacBook触控板使用习惯
8. 自动检测设备类型，提供手动切换选项 - 兼顾易用性和精确控制
9. 使用React wrapper（react-signature-pad-wrapper） - 简化React集成
10. 支持撤销/重做功能 - 提升用户体验

## Findings (cited - path:lines)

### 项目技术栈
- 前端：React 18 + TypeScript 5 + Ant Design 5
- 构建工具：Vite
- 包管理：npm
- 现有依赖：无签名相关库
- 项目中没有现有的签名或手写绘图功能
- 最接近的参考是TopologyManagement.tsx的SVG画布实现

### 技术研究发现
1. **signature_pad库**：成熟稳定，支持压力感应，有React wrapper（react-signature-pad-wrapper）
2. **Pointer Events API**：统一处理鼠标、触摸、指针设备，支持压力感应
3. **设备检测**：通过pointerType属性检测设备类型（mouse、touch、pen）
4. **压力感应**：通过pressure属性获取压力值（0-1范围）
5. **iOS兼容性**：需要特殊处理iOS的Scribble功能
6. **性能优化**：使用requestAnimationFrame和防抖，避免频繁更新
7. **数据格式**：同时支持PNG、SVG和JSON格式

### Metis差距分析发现
1. **矛盾与不一致**：
   - 事件处理策略矛盾：Pointer Events vs 鼠标/触摸事件
   - SVG导出范围矛盾：核心功能 vs 可选功能
   - signature_pad与自定义实现职责重叠

2. **缺失的约束与需求**：
   - 浏览器兼容性边界未定义
   - 性能指标缺失
   - 无障碍访问完全缺失
   - 移动端适配未提及
   - 存储限制未定义
   - 撤销/重做深度未定义
   - 集成接口未明确

3. **潜在范围蔓延**：
   - 签名回放功能复杂度被低估
   - 多格式导出增加维护成本
   - 自定义Hooks可能过度抽象
   - 工具栏功能边界模糊

4. **未验证的假设**：
   - signature_pad压力感应支持未验证
   - Pointer Events Polyfill可靠性未验证
   - "移动即绘制"模式的用户体验假设
   - 自动检测准确性假设
   - 防抖不影响精度的假设

5. **缺失的验收标准**：
   - 功能验收标准缺失
   - 性能验收标准缺失
   - 兼容性验收标准缺失
   - 可访问性验收标准缺失
   - 测试覆盖率目标缺失
   - 集成验收标准缺失

### 组件接口设计
```typescript
interface SignaturePadProps {
  // 基础配置
  width?: number; // 画布宽度
  height?: number; // 画布高度
  backgroundColor?: string; // 背景颜色
  penColor?: string; // 画笔颜色
  
  // 模式配置
  mode?: 'traditional' | 'pressure' | 'auto'; // 签名模式
  pressureSensitivity?: number; // 压力敏感度 (0-1)
  
  // 功能配置
  disabled?: boolean; // 是否禁用
  showToolbar?: boolean; // 是否显示工具栏
  
  // 回调函数
  onSignatureChange?: (data: SignatureData) => void; // 签名变化回调
  onModeChange?: (mode: 'traditional' | 'pressure') => void; // 模式变化回调
}

interface SignatureData {
  png: string; // Base64 PNG数据
  svg: string; // SVG数据
  json: SignaturePath[]; // JSON路径数据
  isEmpty: boolean; // 是否为空
}

interface SignaturePath {
  points: SignaturePoint[];
  color: string;
  minWidth: number;
  maxWidth: number;
}

interface SignaturePoint {
  x: number;
  y: number;
  pressure: number; // 0-1
  timestamp: number;
}
```

### 签名模式设计
1. **传统模式**：
   - 鼠标按下开始绘制
   - 鼠标移动绘制线条
   - 鼠标抬起结束绘制
   - 线条粗细固定

2. **压力感应模式**：
   - 移动即开始绘制（不需要按下）
   - 压力控制线条粗细
   - 压力越大线条越粗
   - 适合MacBook触控板和数位板

3. **自动检测模式**：
   - 检测输入设备类型
   - 鼠标：自动切换到传统模式
   - 触控板/数位板：自动切换到压力感应模式
   - 提供手动切换选项

### 实现细节
1. **Canvas配置**：
   - 使用devicePixelRatio处理高DPI屏幕
   - 设置Canvas尺寸为CSS尺寸的devicePixelRatio倍
   - 使用getContext('2d')获取绘图上下文

2. **事件处理**：
   - 使用Pointer Events API统一处理各种输入设备
   - 通过pointerType属性检测设备类型
   - 通过pressure属性获取压力值
   - 使用setPointerCapture确保事件连续性

3. **绘图优化**：
   - 使用贝塞尔曲线平滑线条
   - 使用requestAnimationFrame优化绘图性能
   - 使用防抖避免频繁更新

4. **数据导出**：
   - 使用canvas.toDataURL('image/png')导出PNG
   - 使用自定义函数导出SVG
   - 使用内部数据结构导出JSON

5. **状态管理**：
   - 使用useState管理UI状态
   - 使用useRef管理Canvas和签名板实例
   - 使用useCallback优化事件处理函数

6. **错误处理**：
   - 检测设备兼容性
   - 提供降级方案
   - 显示友好的错误信息

### 参考资源
1. **signature_pad库文档**：https://github.com/szimek/signature_pad
2. **react-signature-pad-wrapper**：https://github.com/michaeldzjap/react-signature-pad-wrapper
3. **Pointer Events API**：https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
4. **Canvas API**：https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
5. **签名组件最佳实践**：https://web.dev/articles/mobile-touchandmouse

## Decisions (with rationale)

### 测试策略
采用TDD（测试驱动开发）方式：
1. 先编写单元测试，定义组件行为
2. 实现组件功能
3. 编写集成测试，测试组件交互
4. 编写端到端测试，测试用户场景

理由：签名组件涉及复杂的用户交互和压力感应，TDD可以确保功能正确性和边界情况处理。

### 技术选型决策
1. **绘图引擎选择**：使用signature_pad库
   - 理由：成熟稳定，支持压力感应，性能优化良好
   - 备选：从头实现Canvas绘图引擎
   - 风险：signature_pad可能不支持所有压力感应设备
   - **验证需求**：需要先验证signature_pad的压力感应API

2. **事件处理选择**：使用Pointer Events API为主，Mouse/Touch事件为降级方案
   - 理由：统一处理鼠标、触摸、指针设备，支持压力感应
   - 备选：分别处理Mouse和Touch事件
   - 风险：旧浏览器不支持Pointer Events
   - **决策**：Pointer Events为主，Mouse/Touch为降级方案

3. **数据格式选择**：同时支持PNG和JSON，SVG作为可选功能
   - 理由：PNG用于显示和下载，JSON用于回放和编辑
   - 备选：只支持PNG
   - 风险：JSON格式可能较大
   - **决策**：SVG移出核心功能，作为可选扩展

4. **模式切换策略**：自动检测 + 手动切换
   - 理由：自动检测提供良好用户体验，手动切换提供精确控制
   - 备选：只支持手动切换
   - 风险：自动检测可能不准确
   - **决策**：添加设备检测fallback和用户确认机制

### 实现策略
1. **组件设计**：采用组合模式，将功能拆分为多个子组件
   - 理由：提高代码可维护性和可测试性
   - 风险：可能增加组件间通信复杂度
   - **决策**：先实现为单一hook，根据实际复杂度再拆分

2. **状态管理**：使用React hooks管理状态
   - 理由：签名组件状态相对简单，不需要复杂的状态管理
   - 风险：可能不适合复杂的状态逻辑

3. **性能优化**：使用requestAnimationFrame和防抖
   - 理由：确保绘图流畅，避免性能问题
   - 风险：可能影响绘图精度
   - **决策**：测试不同防抖延迟对签名质量的影响

4. **错误处理**：提供详细的错误信息和降级方案
   - 理由：提升用户体验，处理设备不兼容情况
   - 风险：可能增加代码复杂度

### Metis差距解决决策
1. **解决事件处理矛盾**：
   - 决策：Pointer Events为主事件系统，Mouse/Touch作为降级方案
   - 理由：确保兼容性，同时保持代码简洁

2. **解决SVG导出矛盾**：
   - 决策：SVG作为可选功能，移出核心Scope IN
   - 理由：减少维护成本，优先保证PNG和JSON的稳定性

3. **解决signature_pad与自定义实现重叠**：
   - 决策：充分利用signature_pad内置功能，仅扩展必要的自定义功能
   - 理由：避免重复实现，减少维护成本

4. **补充缺失的约束**：
   - 决策：定义浏览器兼容性矩阵、性能指标、无障碍访问要求
   - 理由：确保产品质量和用户体验

5. **防止范围蔓延**：
   - 决策：明确定义签名回放功能边界，限制工具栏功能
   - 理由：控制复杂度，确保按时交付

6. **验证假设**：
   - 决策：先进行signature_pad技术验证，测试Pointer Events Polyfill
   - 理由：避免后期返工，确保技术可行性

7. **定义验收标准**：
   - 决策：定义功能、性能、兼容性、可访问性验收标准
   - 理由：确保产品质量，明确完成定义

## Scope IN

### 功能范围
1. Canvas绘图引擎
   - 线条绘制（贝塞尔曲线平滑）
   - 线条粗细变化（基于压力）
   - 撤销/重做功能
   - 清除画布功能

2. 事件处理系统
   - 鼠标事件（mousedown, mousemove, mouseup）
   - 触摸事件（touchstart, touchmove, touchend）
   - 指针事件（pointerdown, pointermove, pointerup）
   - 压力感应（pointer event的pressure属性）

3. 模式切换
   - 传统模式：点击并按住左键签名
   - 压力感应模式：移动即签名，压力控制粗细
   - 自动检测设备类型
   - 手动切换模式

4. 数据导出
   - PNG图片导出
   - SVG矢量导出
   - JSON路径数据导出
   - 签名回放数据

5. 用户界面
   - 签名区域组件
   - 工具栏（清除、撤销、重做、切换模式）
   - 状态显示（当前模式、压力感应状态）

### 组件结构
```
src/components/SignaturePad/
├── index.tsx              # 主组件
├── SignatureCanvas.tsx    # Canvas绘图组件
├── SignatureToolbar.tsx   # 工具栏组件
├── SignaturePreview.tsx   # 签名预览组件
├── hooks/
│   ├── useSignaturePad.ts # 签名板逻辑hook
│   ├── usePressure.ts     # 压力感应hook
│   └── useDeviceDetection.ts # 设备检测hook
├── types.ts               # 类型定义
└── utils.ts               # 工具函数
```

### 依赖关系
1. 新增依赖：signature_pad（核心绘图库）
2. 新增依赖：react-signature-pad-wrapper（React wrapper）
3. 使用现有依赖：antd（UI组件）
4. 使用现有依赖：react（核心框架）

## Scope OUT (Must NOT have)

1. 不支持签名识别（手写转文字）
2. 不支持多用户协作签名
3. 不支持签名验证（与数据库中的签名比对）
4. 不支持复杂的绘图工具（只支持签名笔触）
5. 不支持图层管理
6. 不支持颜色选择（默认黑色）
7. 不支持画笔样式选择（默认实线）
8. 不支持签名动画效果
9. 不支持签名模板
10. 不支持签名批注功能

## Open questions（已全部解决）

1. 是否使用现有的签名库（如signature_pad）还是从头实现？
   - 决策：使用signature_pad库，通过React wrapper集成（Todo 1, 4）

2. 如何检测设备类型（鼠标、触控板、数位板）？
   - 决策：自动检测pointerType + 手动切换，提供降级方案（Todo 9, 10）

3. 压力感应的精度要求是什么？
   - 决策：支持0-1范围，使用VelocityPressureBehavior配置（Todo 2, 8）

4. 签名数据的存储格式（PNG、SVG、JSON路径）？
   - 决策：同时支持PNG和JSON，SVG作为可选功能（Todo 14）

5. 是否需要支持签名回放功能？
   - 决策：支持基本回放功能，使用JSON数据格式（Todo 14）

6. 如何处理不同浏览器的兼容性？
   - 决策：使用Pointer Events polyfill，提供Mouse/Touch降级方案（Todo 6）

7. 如何处理压力感应模式下的误触问题？
   - 决策：提供可配置的压力阈值，默认值0.1（Todo 8）

8. 如何优化绘图性能？
   - 决策：使用requestAnimationFrame和防抖，通过Performance API测量60fps（Todo 19）

## Approval gate
status: approved
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->

### 待批准事项
1. 技术选型：使用signature_pad库 + React wrapper（react-signature-pad-wrapper）
2. 模式设计：支持传统模式、压力感应模式、自动检测模式
3. 数据格式：同时支持PNG和JSON格式
4. 组件结构：采用组合模式，拆分为多个子组件
5. 测试策略：采用TDD方式

### 批准后行动
1. 运行scaffold-plan脚本生成计划文件（已完成）
2. 启动Metis进行差距分析（已完成）
3. 添加详细的todo批次（已完成）
4. 填写人类可读的TL;DR（已完成）
5. 运行Momus高精度审查（已完成）
6. 根据Momus审查结果修复3个阻塞性问题（已完成）：
   - QA场景：添加具体工具+可执行命令+明确预期结果
   - 验收标准：改为具体验证命令+可测量结果
   - 参考引用：指向草稿具体章节或项目具体文件
7. 修复4个重要问题（已完成）：
   - 草稿与计划不一致：同步更新Open questions
   - Wave分配与依赖矩阵不一致：重新对齐Wave分配
   - Metis风险未体现在验收标准中：在Todo 2和6中添加风险验证
   - 性能指标缺乏测量方法：在Todo 19中定义Performance API测量方法
